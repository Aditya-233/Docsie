/**
 * Permission and Role Access Control for Google Docs Clone
 */

import type { UserRole, UserProfile } from "../types/index";

export const ROLES: Record<string, UserRole> = Object.freeze({
  OWNER: "owner",
  EDITOR: "editor",
  COMMENTER: "commenter",
  VIEWER: "viewer",
});

export const ROLE_RANKS: Record<UserRole, number> = Object.freeze({
  owner: 4,
  editor: 3,
  commenter: 2,
  viewer: 1,
});

export interface RolePermissions {
  role: UserRole;
  canEdit: boolean;
  canComment: boolean;
  canShare: boolean;
  canDelete: boolean;
  canManagePermissions: boolean;
  canExport: boolean;
  canView: boolean;
}

export interface ElevationRequest {
  id: string;
  userId: string;
  user: UserProfile | { id: string; name?: string; color?: string; email?: string };
  currentRole: UserRole;
  requestedRole: UserRole;
  reason: string;
  status: "pending" | "approved" | "rejected";
  timestamp: number;
  respondedAt: number | null;
  respondedBy: string | null;
  rejectionReason?: string;
}

/**
 * Normalize role string to lowercase standard role.
 */
export function normalizeRole(role: unknown, defaultRole: UserRole = ROLES.VIEWER): UserRole {
  if (!role || typeof role !== "string") return defaultRole;
  const lower = role.trim().toLowerCase() as UserRole;
  return Object.values(ROLES).includes(lower) ? lower : defaultRole;
}

/**
 * Check if a role string is a recognized valid role.
 */
export function isValidRole(role: unknown): boolean {
  if (!role || typeof role !== "string") return false;
  return Object.values(ROLES).includes(role.trim().toLowerCase() as UserRole);
}

/**
 * Get numeric rank of a role for comparison.
 */
export function getRoleRank(role: unknown): number {
  const norm = normalizeRole(role, ROLES.VIEWER);
  return ROLE_RANKS[norm] || 0;
}

/**
 * Compare two roles. Returns > 0 if roleA > roleB, 0 if equal, < 0 if roleA < roleB.
 */
export function compareRoles(roleA: unknown, roleB: unknown): number {
  return getRoleRank(roleA) - getRoleRank(roleB);
}

/**
 * Check if roleA is strictly higher than roleB.
 */
export function isRoleHigher(roleA: unknown, roleB: unknown): boolean {
  return compareRoles(roleA, roleB) > 0;
}

/**
 * Access Control Matrix static check functions.
 */
export const AccessControl = Object.freeze({
  canEdit(role: unknown): boolean {
    const norm = normalizeRole(role);
    return norm === ROLES.OWNER || norm === ROLES.EDITOR;
  },

  canComment(role: unknown): boolean {
    const norm = normalizeRole(role);
    return norm === ROLES.OWNER || norm === ROLES.EDITOR || norm === ROLES.COMMENTER;
  },

  canShare(role: unknown): boolean {
    const norm = normalizeRole(role);
    return norm === ROLES.OWNER || norm === ROLES.EDITOR;
  },

  canDelete(role: unknown): boolean {
    const norm = normalizeRole(role);
    return norm === ROLES.OWNER;
  },

  canManagePermissions(role: unknown): boolean {
    const norm = normalizeRole(role);
    return norm === ROLES.OWNER;
  },

  canExport(_role?: unknown): boolean {
    return true; // All authenticated / viewing roles can export
  },

  canView(_role?: unknown): boolean {
    return true; // All recognized roles can view
  },

  getPermissions(role: unknown): RolePermissions {
    const norm = normalizeRole(role);
    return {
      role: norm,
      canEdit: AccessControl.canEdit(norm),
      canComment: AccessControl.canComment(norm),
      canShare: AccessControl.canShare(norm),
      canDelete: AccessControl.canDelete(norm),
      canManagePermissions: AccessControl.canManagePermissions(norm),
      canExport: AccessControl.canExport(norm),
      canView: AccessControl.canView(norm),
    };
  },
});

/**
 * Dynamic Permission and Role Elevation Manager.
 */
export class PermissionManager {
  public currentRole: UserRole;
  public userId: string | null;
  public elevationRequests: Map<string, ElevationRequest>;
  public listeners: Map<string, Set<Function>>;

  constructor(initialRole: unknown = ROLES.VIEWER, userId: string | null = null) {
    this.currentRole = normalizeRole(initialRole, ROLES.VIEWER);
    this.userId = userId;
    this.elevationRequests = new Map();
    this.listeners = new Map();
  }

  on(event: string, callback: Function): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(callback);
    return () => this.off(event, callback);
  }

  off(event: string, callback: Function): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
    }
  }

  emit(event: string, ...args: unknown[]): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const cb of set) {
        try {
          cb(...args);
        } catch (err) {
          console.error(`Error in PermissionManager listener for "${event}":`, err);
        }
      }
    }
  }

  getRole(): UserRole {
    return this.currentRole;
  }

  setRole(newRole: unknown): UserRole {
    const prevRole = this.currentRole;
    this.currentRole = normalizeRole(newRole, prevRole);
    if (prevRole !== this.currentRole) {
      this.emit("roleChanged", {
        previousRole: prevRole,
        currentRole: this.currentRole,
        permissions: this.getPermissions(),
      });
    }
    return this.currentRole;
  }

  canEdit(role: unknown = this.currentRole): boolean {
    return AccessControl.canEdit(role);
  }

  canComment(role: unknown = this.currentRole): boolean {
    return AccessControl.canComment(role);
  }

  canShare(role: unknown = this.currentRole): boolean {
    return AccessControl.canShare(role);
  }

  canDelete(role: unknown = this.currentRole): boolean {
    return AccessControl.canDelete(role);
  }

  canManagePermissions(role: unknown = this.currentRole): boolean {
    return AccessControl.canManagePermissions(role);
  }

  canExport(role: unknown = this.currentRole): boolean {
    return AccessControl.canExport(role);
  }

  canView(role: unknown = this.currentRole): boolean {
    return AccessControl.canView(role);
  }

  getPermissions(role: unknown = this.currentRole): RolePermissions {
    return AccessControl.getPermissions(role);
  }

  requestRoleElevation({
    requestedRole = ROLES.EDITOR,
    reason = "",
    user = null,
  }: {
    requestedRole?: unknown;
    reason?: string;
    user?: UserProfile | { id: string; name?: string; color?: string; email?: string } | null;
  } = {}): ElevationRequest {
    const targetRole = normalizeRole(requestedRole, ROLES.EDITOR);
    const requestingUser = user || { id: this.userId || "anonymous" };
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const request: ElevationRequest = {
      id: requestId,
      userId: requestingUser.id,
      user: requestingUser,
      currentRole: this.currentRole,
      requestedRole: targetRole,
      reason,
      status: "pending",
      timestamp: Date.now(),
      respondedAt: null,
      respondedBy: null,
    };

    this.elevationRequests.set(requestId, request);
    this.emit("elevationRequested", request);
    return request;
  }

  approveRoleElevation(
    requestId: string,
    approverUser: UserProfile | { id: string } | string | null = null,
    approverRole: unknown = this.currentRole
  ): ElevationRequest {
    if (!this.canManagePermissions(approverRole) && !this.canEdit(approverRole)) {
      throw new Error("Unauthorized: Insufficient permissions to approve role elevation");
    }

    const request = this.elevationRequests.get(requestId);
    if (!request) {
      throw new Error(`Elevation request "${requestId}" not found`);
    }

    request.status = "approved";
    request.respondedAt = Date.now();
    request.respondedBy = approverUser
      ? typeof approverUser === "object"
        ? approverUser.id
        : String(approverUser)
      : "owner";

    if (request.userId === this.userId) {
      this.setRole(request.requestedRole);
    }

    this.emit("elevationApproved", request);
    return request;
  }

  rejectRoleElevation(
    requestId: string,
    approverUser: UserProfile | { id: string } | string | null = null,
    reason: string = ""
  ): ElevationRequest {
    const request = this.elevationRequests.get(requestId);
    if (!request) {
      throw new Error(`Elevation request "${requestId}" not found`);
    }

    request.status = "rejected";
    request.rejectionReason = reason;
    request.respondedAt = Date.now();
    request.respondedBy = approverUser
      ? typeof approverUser === "object"
        ? approverUser.id
        : String(approverUser)
      : "owner";

    this.emit("elevationRejected", request);
    return request;
  }

  getRequestById(requestId: string): ElevationRequest | null {
    return this.elevationRequests.get(requestId) || null;
  }

  getElevationRequests(status: string = "all"): ElevationRequest[] {
    const all = Array.from(this.elevationRequests.values());
    if (status === "all") return all;
    return all.filter((r) => r.status === status);
  }
}

export interface GenerateShareUrlOptions {
  baseUrl?: string;
  docId?: string;
  role?: UserRole | string;
  user?: string;
  userName?: string;
  format?: "hash" | "query";
  token?: string;
}

export function generateShareUrl(options: GenerateShareUrlOptions = {}): string {
  const {
    docId = "doc_master",
    role = ROLES.VIEWER,
    user,
    userName,
    format = "hash",
    token,
  } = options;

  let baseUrl = options.baseUrl;
  if (!baseUrl) {
    if (typeof window !== "undefined" && window.location) {
      baseUrl = window.location.origin + window.location.pathname;
    } else {
      baseUrl = "";
    }
  }

  const normRole = normalizeRole(role, ROLES.VIEWER);
  const name = userName || user || "";

  const params = new URLSearchParams();
  params.set("doc", docId);
  params.set("role", normRole);
  if (name) {
    params.set("user", name);
  }
  if (token) {
    params.set("token", token);
  }

  const paramString = params.toString();

  if (format === "query") {
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}${paramString}`;
  } else {
    return `${baseUrl}#${paramString}`;
  }
}

export interface ParsedShareUrl {
  docId: string | null;
  role: UserRole;
  user: string | null;
  token: string | null;
  isValidRole: boolean;
  rawParams: Record<string, string>;
}

export function parseShareUrl(urlOrString: string = ""): ParsedShareUrl {
  const rawParams: Record<string, string> = {};
  if (!urlOrString || typeof urlOrString !== "string") {
    return {
      docId: null,
      role: ROLES.VIEWER,
      user: null,
      token: null,
      isValidRole: false,
      rawParams,
    };
  }

  let searchParams: URLSearchParams | null = null;

  try {
    if (urlOrString.startsWith("http://") || urlOrString.startsWith("https://")) {
      const url = new URL(urlOrString);
      if (url.hash && url.hash.length > 1) {
        searchParams = new URLSearchParams(url.hash.replace(/^#/, ""));
      } else if (url.search && url.search.length > 1) {
        searchParams = new URLSearchParams(url.search.replace(/^\?/, ""));
      }
    }
  } catch {
    // Fall back to direct regex/string parsing
  }

  if (!searchParams) {
    let clean = urlOrString;
    if (clean.includes("#")) {
      clean = clean.split("#")[1];
    } else if (clean.includes("?")) {
      clean = clean.split("?")[1];
    }
    searchParams = new URLSearchParams(clean);
  }

  for (const [key, val] of searchParams.entries()) {
    rawParams[key] = val;
  }

  const docId = searchParams.get("doc") || searchParams.get("docId") || null;
  const rawRole = searchParams.get("role");
  const roleValid = isValidRole(rawRole);
  const role = rawRole ? normalizeRole(rawRole, ROLES.VIEWER) : ROLES.VIEWER;
  const user = searchParams.get("user") || searchParams.get("userName") || null;
  const token = searchParams.get("token") || null;

  return {
    docId,
    role,
    user,
    token,
    isValidRole: roleValid,
    rawParams,
  };
}

/**
 * Generate a lightweight signed share token with expiration timestamp.
 */
export function generateShareToken(
  docId: string,
  role: UserRole = ROLES.VIEWER,
  expiresInMs: number = 86400000,
  secret: string = "docs-share-secret"
): string {
  const expiresAt = Date.now() + expiresInMs;
  const payload = `${docId}:${role}:${expiresAt}`;
  
  let hash = 0;
  const full = `${payload}:${secret}`;
  for (let i = 0; i < full.length; i++) {
    hash = (hash << 5) - hash + full.charCodeAt(i);
    hash |= 0;
  }
  
  const tokenData = JSON.stringify({ docId, role, expiresAt, sig: hash.toString(36) });
  if (typeof Buffer !== "undefined") {
    return Buffer.from(tokenData).toString("base64url");
  }
  return btoa(tokenData).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Validate and unpack share token.
 */
export function verifyShareToken(
  token: string,
  secret: string = "docs-share-secret"
): { valid: boolean; docId?: string; role?: UserRole; expired?: boolean; reason?: string } {
  if (!token || typeof token !== "string") {
    return { valid: false, reason: "Missing token" };
  }

  try {
    let jsonStr: string;
    if (typeof Buffer !== "undefined") {
      jsonStr = Buffer.from(token, "base64url").toString("utf8");
    } else {
      let base64 = token.replace(/-/g, "+").replace(/_/g, "/");
      while (base64.length % 4) base64 += "=";
      jsonStr = atob(base64);
    }

    const { docId, role, expiresAt, sig } = JSON.parse(jsonStr);

    if (!docId || !role || !expiresAt || !sig) {
      return { valid: false, reason: "Malformed token payload" };
    }

    if (Date.now() > expiresAt) {
      return { valid: false, expired: true, docId, role: normalizeRole(role), reason: "Token expired" };
    }

    const payload = `${docId}:${role}:${expiresAt}`;
    let expectedHash = 0;
    const full = `${payload}:${secret}`;
    for (let i = 0; i < full.length; i++) {
      expectedHash = (expectedHash << 5) - expectedHash + full.charCodeAt(i);
      expectedHash |= 0;
    }

    if (sig !== expectedHash.toString(36)) {
      return { valid: false, reason: "Invalid token signature" };
    }

    return { valid: true, docId, role: normalizeRole(role), expired: false };
  } catch {
    return { valid: false, reason: "Failed to decode token" };
  }
}

export interface CollaboratorRecord {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string | null;
  addedAt: number;
  updatedAt: number;
}

export class CollaboratorListManager {
  private collaborators: Map<string, CollaboratorRecord>;
  private listeners: Map<string, Set<Function>>;

  constructor(initialCollaborators: Partial<CollaboratorRecord>[] = []) {
    this.collaborators = new Map();
    this.listeners = new Map();
    if (Array.isArray(initialCollaborators)) {
      this.loadFromJSON(initialCollaborators);
    }
  }

  on(event: string, callback: Function): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(callback);
    return () => this.off(event, callback);
  }

  off(event: string, callback: Function): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
    }
  }

  emit(event: string, ...args: unknown[]): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const cb of set) {
        try {
          cb(...args);
        } catch (e) {
          console.error(`Error in CollaboratorListManager listener for "${event}":`, e);
        }
      }
    }
  }

  addCollaborator(
    data: Partial<CollaboratorRecord> | (Partial<UserProfile> & { role?: string; avatar?: string | null }) = {}
  ): CollaboratorRecord {
    const id = data.id || `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const role = normalizeRole((data as any).role, ROLES.VIEWER);
    const isNew = !this.collaborators.has(id);
    const existing = this.collaborators.get(id);

    const collaborator: CollaboratorRecord = {
      id,
      name: data.name || (data as any).full_name || existing?.name || "Anonymous Collaborator",
      email: data.email || existing?.email || "",
      role,
      avatar: (data as any).avatar || (data as any).avatar_url || existing?.avatar || null,
      addedAt: existing?.addedAt || Date.now(),
      updatedAt: Date.now(),
    };

    this.collaborators.set(id, collaborator);

    if (isNew) {
      this.emit("add", collaborator);
    } else {
      this.emit("update", collaborator);
    }
    this.emit("change", this.getAllCollaborators());

    return collaborator;
  }

  updateRole(userId: string, newRole: unknown): CollaboratorRecord | null {
    const collaborator = this.collaborators.get(userId);
    if (!collaborator) {
      return null;
    }
    collaborator.role = normalizeRole(newRole, collaborator.role);
    collaborator.updatedAt = Date.now();

    this.emit("update", collaborator);
    this.emit("change", this.getAllCollaborators());
    return collaborator;
  }

  removeCollaborator(userId: string): boolean {
    const removed = this.collaborators.get(userId);
    if (removed) {
      this.collaborators.delete(userId);
      this.emit("remove", removed);
      this.emit("change", this.getAllCollaborators());
      return true;
    }
    return false;
  }

  getCollaborator(userId: string): CollaboratorRecord | null {
    return this.collaborators.get(userId) || null;
  }

  hasCollaborator(userId: string): boolean {
    return this.collaborators.has(userId);
  }

  getAllCollaborators(): CollaboratorRecord[] {
    return Array.from(this.collaborators.values());
  }

  getByRole(role: unknown): CollaboratorRecord[] {
    const norm = normalizeRole(role);
    return this.getAllCollaborators().filter((c) => c.role === norm);
  }

  count(): number {
    return this.collaborators.size;
  }

  toJSON(): CollaboratorRecord[] {
    return this.getAllCollaborators();
  }

  loadFromJSON(array: Partial<CollaboratorRecord>[] = []): void {
    this.collaborators.clear();
    if (Array.isArray(array)) {
      for (const item of array) {
        if (item && (item.id || item.email || item.name)) {
          const id = item.id || `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          this.collaborators.set(id, {
            id,
            name: item.name || "Anonymous Collaborator",
            email: item.email || "",
            role: normalizeRole(item.role, ROLES.VIEWER),
            avatar: item.avatar || null,
            addedAt: item.addedAt || Date.now(),
            updatedAt: item.updatedAt || Date.now(),
          });
        }
      }
    }
    this.emit("change", this.getAllCollaborators());
  }
}

export class ShareManager {
  public docId: string;
  public collaborators: CollaboratorListManager;

  constructor(
    docId: string = "doc_master",
    initialCollaborators: Partial<CollaboratorRecord>[] = []
  ) {
    this.docId = docId;
    this.collaborators = new CollaboratorListManager(initialCollaborators);
  }

  createShareLink(
    role: UserRole = ROLES.VIEWER,
    options: Partial<GenerateShareUrlOptions> = {}
  ): string {
    return generateShareUrl({
      docId: this.docId,
      role,
      ...options,
    });
  }

  static generateShareUrl = generateShareUrl;
  static parseShareUrl = parseShareUrl;
  static generateShareToken = generateShareToken;
  static verifyShareToken = verifyShareToken;
  static CollaboratorListManager = CollaboratorListManager;
}
