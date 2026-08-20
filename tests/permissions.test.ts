import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ROLES,
  ROLE_RANKS,
  normalizeRole,
  isValidRole,
  compareRoles,
  isRoleHigher,
  AccessControl,
  PermissionManager,
  generateShareUrl,
  parseShareUrl,
  generateShareToken,
  verifyShareToken,
  CollaboratorListManager,
} from "../lib/permissions";

describe("Permissions & Access Control System", () => {
  describe("Role Hierarchy & Normalization", () => {
    it("should define standard Google Docs roles with correct rank hierarchy", () => {
      assert.strictEqual(ROLES.OWNER, "owner");
      assert.strictEqual(ROLES.EDITOR, "editor");
      assert.strictEqual(ROLES.COMMENTER, "commenter");
      assert.strictEqual(ROLES.VIEWER, "viewer");

      assert.strictEqual(ROLE_RANKS.owner, 4);
      assert.strictEqual(ROLE_RANKS.editor, 3);
      assert.strictEqual(ROLE_RANKS.commenter, 2);
      assert.strictEqual(ROLE_RANKS.viewer, 1);
    });

    it("should evaluate role comparisons and rank ordering correctly (Owner > Editor > Commenter > Viewer)", () => {
      assert.ok(isRoleHigher("owner", "editor"));
      assert.ok(isRoleHigher("editor", "commenter"));
      assert.ok(isRoleHigher("commenter", "viewer"));

      assert.strictEqual(isRoleHigher("viewer", "editor"), false);
      assert.strictEqual(isRoleHigher("editor", "owner"), false);
      assert.strictEqual(isRoleHigher("editor", "editor"), false);

      assert.ok(compareRoles("owner", "viewer") > 0);
      assert.ok(compareRoles("viewer", "owner") < 0);
      assert.strictEqual(compareRoles("editor", "editor"), 0);
    });

    it("should normalize role strings with whitespace, mixed casing, or invalid values", () => {
      assert.strictEqual(normalizeRole("OWNER"), "owner");
      assert.strictEqual(normalizeRole("  Editor  "), "editor");
      assert.strictEqual(normalizeRole("Commenter"), "commenter");
      assert.strictEqual(normalizeRole("VIEWER"), "viewer");

      // Invalid or empty roles fallback to viewer
      assert.strictEqual(normalizeRole("superadmin"), "viewer");
      assert.strictEqual(normalizeRole(""), "viewer");
      assert.strictEqual(normalizeRole(null), "viewer");
      assert.strictEqual(normalizeRole(undefined, "editor"), "editor");
    });

    it("should validate recognized role strings", () => {
      assert.strictEqual(isValidRole("owner"), true);
      assert.strictEqual(isValidRole("editor"), true);
      assert.strictEqual(isValidRole("commenter"), true);
      assert.strictEqual(isValidRole("viewer"), true);
      assert.strictEqual(isValidRole("admin"), false);
      assert.strictEqual(isValidRole("guest"), false);
      assert.strictEqual(isValidRole(null), false);
    });
  });

  describe("Access Control Matrix & Permission Rules", () => {
    it("should enforce canEdit rules (Owner, Editor: true; Commenter, Viewer: false)", () => {
      assert.strictEqual(AccessControl.canEdit("owner"), true);
      assert.strictEqual(AccessControl.canEdit("editor"), true);
      assert.strictEqual(AccessControl.canEdit("commenter"), false);
      assert.strictEqual(AccessControl.canEdit("viewer"), false);
      assert.strictEqual(AccessControl.canEdit("unknown"), false);
    });

    it("should enforce canComment rules (Owner, Editor, Commenter: true; Viewer: false)", () => {
      assert.strictEqual(AccessControl.canComment("owner"), true);
      assert.strictEqual(AccessControl.canComment("editor"), true);
      assert.strictEqual(AccessControl.canComment("commenter"), true);
      assert.strictEqual(AccessControl.canComment("viewer"), false);
      assert.strictEqual(AccessControl.canComment(null), false);
    });

    it("should enforce canShare rules (Owner, Editor: true; Commenter, Viewer: false)", () => {
      assert.strictEqual(AccessControl.canShare("owner"), true);
      assert.strictEqual(AccessControl.canShare("editor"), true);
      assert.strictEqual(AccessControl.canShare("commenter"), false);
      assert.strictEqual(AccessControl.canShare("viewer"), false);
    });

    it("should enforce canDelete and canManagePermissions rules (Owner only)", () => {
      assert.strictEqual(AccessControl.canDelete("owner"), true);
      assert.strictEqual(AccessControl.canDelete("editor"), false);
      assert.strictEqual(AccessControl.canDelete("commenter"), false);
      assert.strictEqual(AccessControl.canDelete("viewer"), false);

      assert.strictEqual(AccessControl.canManagePermissions("owner"), true);
      assert.strictEqual(AccessControl.canManagePermissions("editor"), false);
      assert.strictEqual(AccessControl.canManagePermissions("commenter"), false);
      assert.strictEqual(AccessControl.canManagePermissions("viewer"), false);
    });

    it("should allow all valid roles to export and view documents", () => {
      for (const role of ["owner", "editor", "commenter", "viewer"]) {
        assert.strictEqual(AccessControl.canExport(role), true);
        assert.strictEqual(AccessControl.canView(role), true);
      }
    });

    it("should return complete permissions object for any given role", () => {
      const editorPerms = AccessControl.getPermissions("editor");
      assert.deepStrictEqual(editorPerms, {
        role: "editor",
        canEdit: true,
        canComment: true,
        canShare: true,
        canDelete: false,
        canManagePermissions: false,
        canExport: true,
        canView: true,
      });

      const viewerPerms = AccessControl.getPermissions("viewer");
      assert.deepStrictEqual(viewerPerms, {
        role: "viewer",
        canEdit: false,
        canComment: false,
        canShare: false,
        canDelete: false,
        canManagePermissions: false,
        canExport: true,
        canView: true,
      });
    });
  });

  describe("PermissionManager & Role Elevation Workflow", () => {
    it("should initialize with specified role and emit roleChanged event on modification", () => {
      const pm = new PermissionManager("viewer", "usr-1");
      assert.strictEqual(pm.getRole(), "viewer");
      assert.strictEqual(pm.canEdit(), false);

      let eventReceived: any = null;
      pm.on("roleChanged", (data: any) => {
        eventReceived = data;
      });

      pm.setRole("editor");
      assert.strictEqual(pm.getRole(), "editor");
      assert.strictEqual(pm.canEdit(), true);
      assert.ok(eventReceived !== null);
      assert.strictEqual(eventReceived.previousRole, "viewer");
      assert.strictEqual(eventReceived.currentRole, "editor");
      assert.strictEqual(eventReceived.permissions.canEdit, true);
    });

    it("should handle role elevation request and approval by owner", () => {
      const pm = new PermissionManager("viewer", "usr-charlie");

      let requestNotification: any = null;
      pm.on("elevationRequested", (req: any) => {
        requestNotification = req;
      });

      // Viewer requests elevation to editor
      const req = pm.requestRoleElevation({
        requestedRole: "editor",
        reason: "Need to fix typo in section 3",
        user: { id: "usr-charlie", name: "Charlie" },
      });

      assert.ok(req.id.startsWith("req_"));
      assert.strictEqual(req.status, "pending");
      assert.strictEqual(req.requestedRole, "editor");
      assert.strictEqual(requestNotification?.id, req.id);

      // Owner approves elevation
      const approved = pm.approveRoleElevation(req.id, "usr-owner", "owner");
      assert.strictEqual(approved.status, "approved");
      assert.strictEqual(pm.getRole(), "editor");
      assert.strictEqual(pm.canEdit(), true);
    });

    it("should prevent unauthorized users from approving role elevation", () => {
      const pm = new PermissionManager("viewer", "usr-guest");
      const req = pm.requestRoleElevation({ requestedRole: "editor" });

      // Viewer tries to approve own or peer request
      assert.throws(() => {
        pm.approveRoleElevation(req.id, "usr-viewer", "viewer");
      }, /Unauthorized/);

      assert.strictEqual(req.status, "pending");
      assert.strictEqual(pm.getRole(), "viewer");
    });

    it("should handle role elevation rejection with reason", () => {
      const pm = new PermissionManager("viewer", "usr-dana");
      const req = pm.requestRoleElevation({ requestedRole: "editor" });

      let rejectNotification: any = null;
      pm.on("elevationRejected", (r: any) => {
        rejectNotification = r;
      });

      pm.rejectRoleElevation(req.id, "usr-owner", "Document is frozen for review");

      assert.strictEqual(req.status, "rejected");
      assert.strictEqual(req.rejectionReason, "Document is frozen for review");
      assert.strictEqual(rejectNotification?.id, req.id);
      assert.strictEqual(pm.getRole(), "viewer");
    });
  });

  describe("Share URL Token Generation, Parsing, and Validation", () => {
    it("should generate share URLs in hash format and query parameter format", () => {
      const hashUrl = generateShareUrl({
        baseUrl: "https://docs.google.com/doc/abc",
        docId: "doc-123",
        role: "editor",
        userName: "Alice",
        format: "hash",
      });

      assert.ok(hashUrl.includes("https://docs.google.com/doc/abc#"));
      assert.ok(hashUrl.includes("doc=doc-123"));
      assert.ok(hashUrl.includes("role=editor"));
      assert.ok(hashUrl.includes("user=Alice"));

      const queryUrl = generateShareUrl({
        baseUrl: "https://docs.google.com/doc/abc",
        docId: "doc-456",
        role: "viewer",
        format: "query",
      });

      assert.ok(queryUrl.includes("https://docs.google.com/doc/abc?"));
      assert.ok(queryUrl.includes("doc=doc-456"));
      assert.ok(queryUrl.includes("role=viewer"));
    });

    it("should parse share URLs extracting docId, role, user, and token", () => {
      const fullUrl = "https://example.com/document#doc=doc-789&role=commenter&user=Bob";
      const parsed = parseShareUrl(fullUrl);

      assert.strictEqual(parsed.docId, "doc-789");
      assert.strictEqual(parsed.role, "commenter");
      assert.strictEqual(parsed.user, "Bob");
      assert.strictEqual(parsed.isValidRole, true);

      // Query format URL
      const queryParsed = parseShareUrl("https://example.com/doc?docId=doc-999&role=editor");
      assert.strictEqual(queryParsed.docId, "doc-999");
      assert.strictEqual(queryParsed.role, "editor");

      // Malformed / invalid URL fallback
      const emptyParsed = parseShareUrl("");
      assert.strictEqual(emptyParsed.docId, null);
      assert.strictEqual(emptyParsed.role, "viewer");
    });

    it("should sign and verify share tokens with expiration timestamps", () => {
      const secret = "super-secret-key-123";
      const token = generateShareToken("doc-secure-1", "editor", 3600000, secret); // 1 hour expiration

      assert.ok(typeof token === "string");
      assert.ok(token.length > 10);

      // Verify valid token
      const verification = verifyShareToken(token, secret);
      assert.strictEqual(verification.valid, true);
      assert.strictEqual(verification.docId, "doc-secure-1");
      assert.strictEqual(verification.role, "editor");
      assert.strictEqual(verification.expired, false);

      // Verify invalid secret fails verification
      const invalidSec = verifyShareToken(token, "wrong-secret");
      assert.strictEqual(invalidSec.valid, false);
      assert.strictEqual(invalidSec.reason, "Invalid token signature");

      // Verify expired token
      const expiredToken = generateShareToken("doc-secure-1", "viewer", -1000, secret);
      const expiredVerif = verifyShareToken(expiredToken, secret);
      assert.strictEqual(expiredVerif.valid, false);
      assert.strictEqual(expiredVerif.expired, true);
      assert.strictEqual(expiredVerif.reason, "Token expired");
    });
  });

  describe("CollaboratorListManager & Collaborator Roster Management", () => {
    it("should add, update, list and remove collaborators with change events", () => {
      const manager = new CollaboratorListManager();

      const events: string[] = [];
      manager.on("add", (c: any) => events.push("add:" + c.name));
      manager.on("update", (c: any) => events.push("update:" + c.name + ":" + c.role));
      manager.on("remove", (c: any) => events.push("remove:" + c.name));

      // Add collaborator
      const c1 = manager.addCollaborator({
        id: "collab-1",
        name: "Alice",
        email: "alice@example.com",
        role: "editor",
      });

      assert.strictEqual(manager.count(), 1);
      assert.strictEqual(manager.hasCollaborator("collab-1"), true);
      assert.strictEqual(c1.role, "editor");

      // Update role
      manager.updateRole("collab-1", "owner");
      assert.strictEqual(manager.getCollaborator("collab-1")?.role, "owner");

      // Query by role
      const owners = manager.getByRole("owner");
      assert.strictEqual(owners.length, 1);
      assert.strictEqual(owners[0].name, "Alice");

      // Remove collaborator
      const removed = manager.removeCollaborator("collab-1");
      assert.strictEqual(removed, true);
      assert.strictEqual(manager.count(), 0);

      assert.deepStrictEqual(events, [
        "add:Alice",
        "update:Alice:owner",
        "remove:Alice",
      ]);
    });

    it("should serialize to JSON and reload from JSON cleanly", () => {
      const initial = [
        { id: "u1", name: "Alice", email: "alice@test.com", role: "owner" as const },
        { id: "u2", name: "Bob", email: "bob@test.com", role: "editor" as const },
      ];

      const manager = new CollaboratorListManager(initial);
      assert.strictEqual(manager.count(), 2);

      const json = manager.toJSON();
      assert.strictEqual(json.length, 2);

      const newManager = new CollaboratorListManager();
      newManager.loadFromJSON(json);
      assert.strictEqual(newManager.count(), 2);
      assert.strictEqual(newManager.getCollaborator("u2")?.role, "editor");
    });
  });
});
