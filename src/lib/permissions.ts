import type { UserRole, ShareTokenPayload } from "./types";

export const ROLES = { OWNER: "owner", EDITOR: "editor", COMMENTER: "commenter", VIEWER: "viewer" } as const;
export const ROLE_RANKS: Record<string, number> = { owner: 4, editor: 3, commenter: 2, viewer: 1 };

export function normalizeRole(role?: string | null): UserRole {
    const r = (role || "").trim().toLowerCase();
    return (r === "owner" || r === "editor" || r === "commenter" || r === "viewer") ? r : "viewer";
}
export function isValidRole(role?: string | null): boolean { return ["owner", "editor", "commenter", "viewer"].includes(role as string); }
export function compareRoles(a: string, b: string): number { return (ROLE_RANKS[normalizeRole(a)] || 0) - (ROLE_RANKS[normalizeRole(b)] || 0); }
export function isRoleHigher(a: string, b: string): boolean { return compareRoles(a, b) > 0; }

export class AccessControl {
    static canEdit(r: string) { return ["owner", "editor"].includes(normalizeRole(r)) && isValidRole(r); }
    static canComment(r: string) { return ["owner", "editor", "commenter"].includes(normalizeRole(r)) && isValidRole(r); }
    static canShare(r: string) { return ["owner", "editor"].includes(normalizeRole(r)) && isValidRole(r); }
    static canDelete(r: string) { return normalizeRole(r) === "owner" && isValidRole(r); }
    static canManagePermissions(r: string) { return normalizeRole(r) === "owner" && isValidRole(r); }
    static canView(r: string) { return isValidRole(r); }
    static canExport(r: string) { return isValidRole(r); }
    static getPermissions(r: string) {
        const role = normalizeRole(r);
        return { canEdit: this.canEdit(role), canComment: this.canComment(role), canShare: this.canShare(role), canDelete: this.canDelete(role), canManagePermissions: this.canManagePermissions(role), canView: this.canView(role), canExport: this.canExport(role) };
    }
}

export class PermissionManager {
    private role: UserRole;
    private listeners: Record<string, Function[]> = {};
    private pending: Map<string, any> = new Map();
    constructor(initial: UserRole = "viewer") { this.role = normalizeRole(initial); }
    getRole() { return this.role; }
    setRole(r: UserRole) { this.role = normalizeRole(r); this.emit("roleChanged", { newRole: this.role }); }
    canEdit() { return AccessControl.canEdit(this.role); }
    canComment() { return AccessControl.canComment(this.role); }
    canShare() { return AccessControl.canShare(this.role); }
    on(event: string, fn: Function) { (this.listeners[event] = this.listeners[event] || []).push(fn); }
    emit(event: string, data: any) { (this.listeners[event] || []).forEach(f => f(data)); }
    requestRoleElevation(req: { requestedRole: UserRole; reason?: string; user: any }) {
        const id = `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const full = { id, ...req, status: "pending" };
        this.pending.set(id, full);
        this.emit("elevationRequested", full);
        return id;
    }
    approveRoleElevation(reqId: string, _approverId: string, approverRole: UserRole): boolean {
        if (!["owner", "editor"].includes(approverRole)) return false;
        const req = this.pending.get(reqId);
        if (!req) return false;
        this.setRole(req.requestedRole);
        this.pending.delete(reqId);
        this.emit("elevationApproved", { reqId, newRole: req.requestedRole });
        return true;
    }
    rejectRoleElevation(reqId: string, _rejectorId: string, reason: string): boolean {
        const req = this.pending.get(reqId);
        if (!req) return false;
        this.pending.delete(reqId);
        this.emit("elevationRejected", { reqId, reason });
        return true;
    }
}

export function generateShareUrl(opts: { baseUrl: string; docId: string; role?: UserRole; userName?: string; format?: "hash" | "query" }): string {
    const base = `${opts.baseUrl.replace(/\/$/, "")}/doc/${opts.docId}`;
    const p = new URLSearchParams();
    if (opts.role) p.set("role", opts.role);
    if (opts.userName) p.set("user", opts.userName);
    return opts.format === "hash" ? `${base}#${p.toString()}` : `${base}?${p.toString()}`;
}

export function parseShareUrl(urlStr: string) {
    try {
        const u = new URL(urlStr, "https://dummy.local");
        const m = u.pathname.match(/\/doc\/([^/?#]+)/);
        const hashP = new URLSearchParams(u.hash.replace(/^#/, ""));
        return {
            docId: m ? m[1] : "",
            role: normalizeRole(hashP.get("role") || u.searchParams.get("role")),
            user: hashP.get("user") || u.searchParams.get("user") || null,
            token: hashP.get("token") || u.searchParams.get("token") || null
        };
    } catch { return { docId: "", role: "viewer" as UserRole, user: null, token: null }; }
}

export function generateShareToken(docId: string, role: UserRole, expiresInMs = 86400000, secret = "docsie-key"): string {
    const payload: ShareTokenPayload = { docId, role, exp: Date.now() + expiresInMs };
    const b64 = typeof Buffer !== "undefined" ? Buffer.from(JSON.stringify(payload)).toString("base64url") : btoa(JSON.stringify(payload));
    return `${b64}.${secret.length}`;
}

export function verifyShareToken(token: string, _secret = "docsie-key"): { valid: boolean; docId?: string; role?: UserRole } {
    try {
        const [b64] = token.split(".");
        const raw = typeof Buffer !== "undefined" ? Buffer.from(b64, "base64url").toString("utf-8") : atob(b64);
        const p: ShareTokenPayload = JSON.parse(raw);
        return { valid: p.exp > Date.now(), docId: p.docId, role: p.role };
    } catch { return { valid: false }; }
}

export class CollaboratorListManager {
    private map = new Map<string, any>();
    private listeners: Function[] = [];
    on(_evt: "change", fn: Function) { this.listeners.push(fn); }
    private emit() { this.listeners.forEach(f => f(this.list())); }
    addCollaborator(c: any) { this.map.set(c.id, c); this.emit(); }
    updateRole(id: string, role: UserRole) { const c = this.map.get(id); if (c) { c.role = role; this.emit(); } }
    removeCollaborator(id: string) { const res = this.map.delete(id); if (res) this.emit(); return res; }
    getCollaborator(id: string) { return this.map.get(id); }
    list() { return Array.from(this.map.values()); }
    count() { return this.map.size; }
    toJSON() { return JSON.stringify(this.list()); }
    loadFromJSON(json: string) { try { (JSON.parse(json) || []).forEach((c: any) => this.map.set(c.id, c)); this.emit(); } catch { } }
}
