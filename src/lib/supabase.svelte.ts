import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { Observable } from "lib0/observable";
import type { UserProfile } from "./types";


if (typeof globalThis !== "undefined" && typeof (globalThis as any).$state === "undefined") {
    (globalThis as any).$state = <T>(val: T): T => val;
}

export const BASE_PATH = "/Docsie";
export function getBasePath(): string { return (typeof window !== "undefined" && window.location.pathname.startsWith(BASE_PATH)) ? BASE_PATH : BASE_PATH; }
export function getAuthRedirectUrl(route = "/"): string { return typeof window === "undefined" ? `${BASE_PATH}${route}` : `${window.location.origin}${getBasePath()}${route.startsWith("/") ? route : `/${route}`}`; }

const URL = (typeof import.meta !== "undefined" && import.meta.env?.PUBLIC_SUPABASE_URL) || "https://vdfprwerslivqcmbsvlc.supabase.co";
const KEY = (typeof import.meta !== "undefined" && import.meta.env?.PUBLIC_SUPABASE_ANON_KEY) || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkZnByd2Vyc2xpdnFjbWJzdmxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxNzM2ODksImV4cCI6MjEwMjc0OTY4OX0.dCcf_Stlw_dK-Q7ZSwpzp3lLALyQyRyvBSPjBrs5m9Q";

export function isSupabaseConfigured() { return Boolean(URL && KEY && URL.startsWith("http") && !URL.includes("your-project")); }

let client: SupabaseClient | null = null;
export function createClient(): SupabaseClient {
    if (typeof window === "undefined" || !isSupabaseConfigured()) return createMockBrowserClient();
    return client || (client = createSupabaseClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true } }));
}

export function createMockBrowserClient(): SupabaseClient {
    const user = { id: "local-user", email: "local@example.com", user_metadata: { name: "Local User" } };
    const query: any = {
        select: () => query, eq: () => query, order: () => query, limit: () => query,
        single: async () => ({ data: null, error: null }), maybeSingle: async () => ({ data: null, error: null }),
        then: (r: any) => r({ data: [], error: null }), insert: (d: any) => ({ select: () => ({ single: async () => ({ data: Array.isArray(d) ? d[0] : d, error: null }) }) }),
        update: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }) }), delete: () => ({ eq: async () => ({ data: null, error: null }) })
    };
    return {
        auth: { getUser: async () => ({ data: { user }, error: null }), getSession: async () => ({ data: { session: { user, access_token: "m" } }, error: null }), signInWithPassword: async () => ({ data: { user }, error: null }), signInWithOAuth: async () => ({ data: { url: "/" }, error: null }), signOut: async () => ({ error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }) },
        from: () => query, channel: () => ({ on: () => ({ subscribe: () => { } }), send: () => { }, unsubscribe: () => { } }), removeChannel: () => { }
    } as unknown as SupabaseClient;
}

export class AwarenessManager {
    public awareness: awarenessProtocol.Awareness;
    private lastMap = new Map<number, number>();
    constructor(public doc: Y.Doc, a?: awarenessProtocol.Awareness) {
        this.awareness = a || new awarenessProtocol.Awareness(doc);
        this.awareness.on("change", ({ added, updated }: any) => { const n = Date.now(); for (const c of added.concat(updated)) this.lastMap.set(c, n); });
    }
    setUser(u: UserProfile) { this.awareness.setLocalStateField("user", u); this.awareness.setLocalStateField("lastUpdated", Date.now()); }
    evictStaleClients(timeout = 30000) {
        const stale: number[] = [], now = Date.now();
        this.awareness.getStates().forEach((s, c) => { if (c !== this.doc.clientID && now - ((s as any)?.lastUpdated || this.lastMap.get(c) || 0) > timeout) stale.push(c); });
        if (stale.length) awarenessProtocol.removeAwarenessStates(this.awareness, stale, "timeout");
        return stale;
    }
    destroy() { this.awareness.destroy(); }
}

export function uint8ArrayToHex(b: Uint8Array): string {
    if (typeof Buffer !== "undefined") return "\\x" + Buffer.from(b).toString("hex");
    return b.reduce((s, byte) => s + byte.toString(16).padStart(2, "0"), "\\x");
}

export function parseByteaToUint8Array(val: unknown): Uint8Array | null {
    if (!val) return null;
    if (val instanceof Uint8Array) return val;
    if (Array.isArray(val)) return new Uint8Array(val);
    if (typeof val === "string") {
        if (val.startsWith("\\x") || val.startsWith("0x")) { const m = val.slice(2).match(/.{1,2}/g); return m ? new Uint8Array(m.map(b => parseInt(b, 16))) : new Uint8Array(0); }
        try { return typeof Buffer !== "undefined" ? new Uint8Array(Buffer.from(val, "base64")) : new Uint8Array([...atob(val)].map(c => c.charCodeAt(0))); } catch { return new TextEncoder().encode(val); }
    }
    return null;
}
export const parseHexToUint8Array = parseByteaToUint8Array;
export function base64ToUint8Array(b: string) { return parseByteaToUint8Array(b) || new Uint8Array(0); }
export function uint8ArrayToBase64(b: Uint8Array) { return typeof Buffer !== "undefined" ? Buffer.from(b).toString("base64") : btoa(String.fromCharCode(...b)); }

export class SupabaseYjsProvider extends Observable<string> {
    awareness: awarenessProtocol.Awareness;
    supabase: SupabaseClient;
    channel: RealtimeChannel | null = null;
    status: "syncing" | "saved" | "offline" = $state("offline");
    synced = $state(false);
    get roomName() { return this.room; }
    private _upHandler: any;
    private _awHandler: any;

    constructor(public room: string, public doc: Y.Doc, opts: any = {}) {
        super();
        this.awareness = opts.awareness || new awarenessProtocol.Awareness(doc);
        this.supabase = opts.supabase || createClient();
        if (opts.user) this.awareness.setLocalStateField("user", opts.user);

        this._upHandler = (u: Uint8Array, o: any) => {
            if (o !== this) {
                const enc = encoding.createEncoder();
                encoding.writeVarUint(enc, 0); syncProtocol.writeUpdate(enc, u);
                this.bcast(encoding.toUint8Array(enc));
            }
        };
        this.doc.on("update", this._upHandler);

        this._awHandler = ({ added, updated, removed }: any, o: any) => {
            if (o !== this) {
                const enc = encoding.createEncoder();
                encoding.writeVarUint(enc, 1);
                encoding.writeVarUint8Array(enc, awarenessProtocol.encodeAwarenessUpdate(this.awareness, added.concat(updated, removed)));
                this.bcast(encoding.toUint8Array(enc));
            }
            this.emit("awareness", [{ states: this.awareness.getStates() }]);
        };
        this.awareness.on("update", this._awHandler);
        if (opts.connect !== false) this.connect();
    }

    connect() {
        try {
            this.channel = this.supabase.channel(`room_${this.room}`).on("broadcast", { event: "yjs" }, (p: any) => {
                const b = parseByteaToUint8Array(p.payload?.data); if (b) this.msg(b);
            }).subscribe((st: string) => {
                if (st === "SUBSCRIBED") {
                    this.synced = true; this.status = "saved";
                    const enc = encoding.createEncoder();
                    encoding.writeVarUint(enc, 0); syncProtocol.writeSyncStep1(enc, this.doc);
                    this.bcast(encoding.toUint8Array(enc));
                }
            });
        } catch { this.status = "offline"; }
    }

    private bcast(data: Uint8Array) {
        if (this.channel) try { this.channel.send({ type: "broadcast", event: "yjs", payload: { data: uint8ArrayToBase64(data) } }); } catch { }
    }

    private msg(data: Uint8Array) {
        const dec = decoding.createDecoder(data), type = decoding.readVarUint(dec);
        if (type === 0) {
            const enc = encoding.createEncoder();
            encoding.writeVarUint(enc, 0);
            syncProtocol.readSyncMessage(dec, enc, this.doc, this);
            if (encoding.length(enc) > 1) this.bcast(encoding.toUint8Array(enc));
        } else if (type === 1) awarenessProtocol.applyAwarenessUpdate(this.awareness, decoding.readVarUint8Array(dec), this);
    }

    async saveSnapshot() {
        try {
            await this.supabase.from("yjs_documents").upsert({ room: this.room, state: uint8ArrayToHex(Y.encodeStateAsUpdate(this.doc)) });
            this.status = "saved"; return true;
        } catch { return false; }
    }

    async hydrate() {
        try {
            const res = await this.supabase.from("yjs_documents").select("state").eq("room", this.room).maybeSingle?.();
            if (res?.data?.state) {
                const b = parseByteaToUint8Array(res.data.state);
                if (b) { Y.applyUpdate(this.doc, b, this); this.synced = true; this.status = "saved"; return true; }
            }
        } catch { }
        return false;
    }

    override destroy() {
        super.destroy();
        this.doc.off("update", this._upHandler); this.awareness.off("update", this._awHandler);
        if (this.channel) { this.supabase.removeChannel(this.channel); this.channel = null; }
    }
}
