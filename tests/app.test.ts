import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import fs from "node:fs";
import path from "node:path";
import { ROLES, ROLE_RANKS, normalizeRole, isValidRole, isRoleHigher, AccessControl, PermissionManager, generateShareUrl, parseShareUrl, generateShareToken, verifyShareToken, CollaboratorListManager } from "../src/lib/permissions";
import { slugifyHeading, extractHeadings, buildHeadingTree, calculateStats, OutlineExtractor } from "../src/lib/outline";
import { exportMarkdown, generateHtmlDocument, extractPlainText, generateDocxBuffer } from "../src/lib/export";
import { extractSpaRedirectTarget, buildSpaRedirectUrl, resolveHistoryPath } from "../src/lib/utils";
import { uint8ArrayToHex, parseByteaToUint8Array, uint8ArrayToBase64, base64ToUint8Array, SupabaseYjsProvider, AwarenessManager, createClient as createBrowserClient, getBasePath, getAuthRedirectUrl } from "../src/lib/supabase.svelte";
import { createClient as createServerClient, createMockServerClient } from "../src/lib/supabase.server";

describe("Docsie Full-Stack Test Suite", () => {
    describe("Permissions & Access Control Matrix", () => {
        it("should evaluate role hierarchy and normalization correctly", () => {
            assert.strictEqual(ROLES.OWNER, "owner"); assert.strictEqual(ROLE_RANKS.owner, 4); assert.strictEqual(ROLE_RANKS.viewer, 1);
            assert.ok(isRoleHigher("owner", "editor")); assert.ok(isRoleHigher("editor", "commenter")); assert.strictEqual(isRoleHigher("viewer", "editor"), false);
            assert.strictEqual(normalizeRole("OWNER"), "owner"); assert.strictEqual(normalizeRole("  Editor  "), "editor"); assert.strictEqual(normalizeRole("invalid"), "viewer");
            ["owner", "editor", "commenter", "viewer"].forEach(r => assert.ok(isValidRole(r)));
            ["admin", "guest", null].forEach(r => assert.strictEqual(isValidRole(r), false));
        });

        it("should enforce access control permissions correctly", () => {
            assert.strictEqual(AccessControl.canEdit("owner"), true); assert.strictEqual(AccessControl.canEdit("viewer"), false);
            assert.strictEqual(AccessControl.canComment("commenter"), true); assert.strictEqual(AccessControl.canComment("viewer"), false);
            assert.strictEqual(AccessControl.canShare("editor"), true); assert.strictEqual(AccessControl.canShare("viewer"), false);
            assert.strictEqual(AccessControl.canDelete("owner"), true); assert.strictEqual(AccessControl.canDelete("editor"), false);
            ["owner", "editor", "commenter", "viewer"].forEach((r) => { assert.strictEqual(AccessControl.canView(r as any), true); assert.strictEqual(AccessControl.canExport(r as any), true); });
            assert.strictEqual(AccessControl.canView("invalid"), false);
            const ownerPerms = AccessControl.getPermissions("owner"); assert.strictEqual(ownerPerms.canEdit, true); assert.strictEqual(ownerPerms.canDelete, true);
        });

        it("should manage role elevation workflow", () => {
            const pm = new PermissionManager("viewer");
            assert.strictEqual(pm.getRole(), "viewer");
            pm.setRole("editor"); assert.strictEqual(pm.getRole(), "editor");
            const reqId = pm.requestRoleElevation({ requestedRole: "editor", user: { id: "u1" } });
            assert.ok(reqId);
            assert.strictEqual(pm.approveRoleElevation(reqId, "owner-id", "viewer"), false);
            assert.strictEqual(pm.approveRoleElevation(reqId, "owner-id", "owner"), true);
            assert.strictEqual(pm.getRole(), "editor");
            const reqId2 = pm.requestRoleElevation({ requestedRole: "editor", user: { id: "u2" } });
            assert.strictEqual(pm.rejectRoleElevation(reqId2, "owner", "denied"), true);
        });

        it("should generate, parse, sign, and verify share tokens", () => {
            const url = generateShareUrl({ baseUrl: "https://example.com/Docsie", docId: "doc-1", role: "editor", format: "hash" });
            assert.ok(url.includes("/doc/doc-1#role=editor"));
            const parsed = parseShareUrl(url); assert.strictEqual(parsed.docId, "doc-1"); assert.strictEqual(parsed.role, "editor");
            const token = generateShareToken("doc-test", "editor", 60000, "secret");
            const verified = verifyShareToken(token, "secret");
            assert.strictEqual(verified.valid, true); assert.strictEqual(verified.docId, "doc-test"); assert.strictEqual(verified.role, "editor");
        });

        it("should manage collaborator roster and serialization", () => {
            const clm = new CollaboratorListManager();
            clm.addCollaborator({ id: "c1", role: "editor" }); assert.strictEqual(clm.count(), 1);
            clm.updateRole("c1", "viewer"); assert.strictEqual(clm.getCollaborator("c1")?.role, "viewer");
            const json = clm.toJSON();
            const clm2 = new CollaboratorListManager(); clm2.loadFromJSON(json); assert.strictEqual(clm2.count(), 1);
            assert.strictEqual(clm.removeCollaborator("c1"), true); assert.strictEqual(clm.count(), 0);
        });
    });

    describe("Document Outline & Statistics", () => {
        it("should handle heading slugs and tree extraction", () => {
            assert.strictEqual(slugifyHeading("Project Proposal 2026!"), "project-proposal-2026");
            const seen = new Set<string>(); assert.strictEqual(slugifyHeading("A", seen), "a"); assert.strictEqual(slugifyHeading("A", seen), "a-1");
            const h = extractHeadings("<h1>Doc</h1><p>Text</p><h2>Section</h2>", { maxLevel: 3 }); assert.strictEqual(h.length, 2);
            const tree = buildHeadingTree(h); assert.strictEqual(tree.length, 1); assert.strictEqual(tree[0].children.length, 1);
            const ext = new OutlineExtractor(); const res = ext.extract("<h1>Intro</h1><p>Some words here.</p><h2>Details</h2>");
            assert.strictEqual(res.headings.length, 2); assert.strictEqual(res.stats.words, 5);
        });

        it("should calculate accurate document statistics", () => {
            const stats = calculateStats("The quick brown fox jumps over the lazy dog.");
            assert.strictEqual(stats.words, 9); assert.strictEqual(stats.characters, 44);
            const pStats = calculateStats("<p>First paragraph with text.</p><p></p><p>Second paragraph.</p>");
            assert.strictEqual(pStats.words, 6); assert.strictEqual(pStats.paragraphs, 2);
            const empty = calculateStats("   "); assert.strictEqual(empty.words, 0); assert.strictEqual(empty.characters, 0);
        });
    });

    describe("Document Exporters", () => {
        it("should generate Markdown, HTML, Plain Text and DOCX", async () => {
            const json = {
                type: "doc", content: [
                    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Title" }] },
                    { type: "paragraph", content: [{ type: "text", text: "bold", marks: [{ type: "bold" }] }] },
                    { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Item" }] }] }] },
                    { type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Cell" }] }] }] }] }
                ]
            };
            const md = exportMarkdown(json); assert.ok(md.includes("# Title")); assert.ok(md.includes("**bold**")); assert.ok(md.includes("- Item"));
            assert.ok(generateHtmlDocument("<p>Test</p>", "Title").includes("<!DOCTYPE html>"));
            assert.ok(extractPlainText(json).includes("Title"));
            const docx = await generateDocxBuffer(json, "DOCX Export"); assert.ok(docx instanceof Buffer); assert.strictEqual(docx[0], 0x50);
        });
    });

    describe("Yjs CRDT & Supabase State Sync", () => {
        it("should encode and decode BYTEA hex snapshots", () => {
            const b = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
            const hex = uint8ArrayToHex(b); assert.strictEqual(hex, "\\xdeadbeef");
            assert.deepStrictEqual(Array.from(parseByteaToUint8Array(hex)!), [0xde, 0xad, 0xbe, 0xef]);
            assert.deepStrictEqual(base64ToUint8Array(uint8ArrayToBase64(b)), b);
        });

        it("should perform 2-step sync handshake and multi-peer delta sync", () => {
            const docA = new Y.Doc(), docB = new Y.Doc();
            docA.getText("t").insert(0, "Data A "); docB.getText("t").insert(0, "Data B ");
            const enc1 = encoding.createEncoder(); syncProtocol.writeSyncStep1(enc1, docA);
            const enc2 = encoding.createEncoder(); syncProtocol.readSyncMessage(decoding.createDecoder(encoding.toUint8Array(enc1)), enc2, docB, "b");
            syncProtocol.readSyncMessage(decoding.createDecoder(encoding.toUint8Array(enc2)), encoding.createEncoder(), docA, "a");
            assert.ok(docA.getText("t").toString().includes("Data B"));
            docA.destroy(); docB.destroy();
        });

        it("should manage awareness presence and provider lifecycle", async () => {
            const doc = new Y.Doc();
            const a = new awarenessProtocol.Awareness(doc);
            const mgr = new AwarenessManager(doc, a);
            mgr.setUser({ id: "u1", name: "Alice" });
            assert.strictEqual(a.getLocalState()?.user?.name, "Alice");
            const provider = new SupabaseYjsProvider("room-1", doc, { connect: false, awareness: a });
            assert.strictEqual(provider.roomName, "room-1");
            await provider.saveSnapshot();
            provider.destroy(); mgr.destroy(); doc.destroy();
        });
    });

    describe("SPA Routing & Supabase Schema Verification", () => {
        it("should sanitize SPA redirect paths and build 404 URLs", () => {
            assert.strictEqual(extractSpaRedirectTarget("/doc/test"), "/doc/test");
            assert.strictEqual(extractSpaRedirectTarget("//bad.com"), null);
            assert.strictEqual(buildSpaRedirectUrl("/Docsie/doc/1", "", "", "/Docsie"), "/Docsie/?p=%2Fdoc%2F1");
            assert.strictEqual(resolveHistoryPath("/doc/1", "/Docsie/", "/Docsie"), "/Docsie/doc/1");
            assert.strictEqual(getBasePath(), "/Docsie");
            assert.ok(getAuthRedirectUrl("/login").includes("/Docsie/login"));
        });

        it("should verify valid clients and schema SQL", () => {
            assert.ok(createBrowserClient().auth);
            assert.ok(createServerClient().auth);
            assert.ok(createMockServerClient().from);
            const schemaSql = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20260820000000_initial_schema.sql"), "utf-8");
            assert.ok(schemaSql.includes("CREATE TABLE IF NOT EXISTS public.yjs_documents"));
            assert.ok(schemaSql.includes("CREATE TABLE IF NOT EXISTS public.documents"));
            assert.ok(schemaSql.includes("CREATE TABLE IF NOT EXISTS public.document_collaborators"));
            assert.ok(schemaSql.includes("ENABLE ROW LEVEL SECURITY"));
        });

        it("should verify Google OAuth configuration in supabase/config.toml", () => {
            const configToml = fs.readFileSync(path.join(process.cwd(), "supabase/config.toml"), "utf-8");
            assert.ok(configToml.includes("[auth.external.google]"));
            assert.ok(configToml.includes("client_id = \"env(GOOGLE_CLIENT_ID)\""));
            assert.ok(configToml.includes("https://aditya-233.github.io/Docsie/**"));
            assert.ok(configToml.includes("http://localhost:5173/**"));
        });
    });
});
