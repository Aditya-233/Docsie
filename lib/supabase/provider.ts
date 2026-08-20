import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { Observable } from 'lib0/observable';
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { createClient, isSupabaseConfigured } from './client';

export const MESSAGE_SYNC = 0;
export const MESSAGE_AWARENESS = 1;
export const MESSAGE_AUTH = 2;
export const MESSAGE_QUERY_AWARENESS = 3;

export interface SupabaseYjsProviderOptions {
  supabase?: SupabaseClient;
  awareness?: awarenessProtocol.Awareness;
  connect?: boolean;
  saveInterval?: number;
  debounceWait?: number;
  user?: {
    id?: string;
    name?: string;
    email?: string;
    color?: string;
    avatar_url?: string;
    [key: string]: any;
  };
}

/**
 * Helper: Convert Uint8Array to Postgres BYTEA hex format ('\x...')
 */
export function uint8ArrayToHex(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return "\\x" + Buffer.from(bytes).toString("hex");
  }
  return bytes.reduce((s, b) => s + b.toString(16).padStart(2, "0"), "\\x");
}

/**
 * Helper: Convert Postgres BYTEA / Base64 / array representation to Uint8Array
 */
export function parseByteaToUint8Array(val: unknown): Uint8Array | null {
  if (!val) return null;
  if (val instanceof Uint8Array) return val;
  if (Array.isArray(val)) return new Uint8Array(val);

  if (typeof val === 'string') {
    // Postgres hex format: \x... or 0x...
    if (val.startsWith('\\x') || val.startsWith('0x')) {
      const cleanHex = val.startsWith('\\x') ? val.slice(2) : val.slice(2);
      const matches = cleanHex.match(/.{1,2}/g);
      if (!matches) return new Uint8Array(0);
      return new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
    }

    // Try Base64 format
    try {
      if (typeof Buffer !== 'undefined') {
        return new Uint8Array(Buffer.from(val, 'base64'));
      }
      const binary = atob(val);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    } catch {
      // Plain string fallback
      return new TextEncoder().encode(val);
    }
  }

  return null;
}

/**
 * Helper: Convert Uint8Array to base64 string for Realtime payload transport
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Helper: Convert base64 string back to Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * SupabaseYjsProvider connects a Yjs document with Supabase Realtime and Postgres persistence.
 * Implements 2-step sync protocol, awareness protocol, hydration, debounced snapshots, and local fallback.
 */
export class SupabaseYjsProvider extends Observable<string> {
  public roomName: string;
  public doc: Y.Doc;
  public awareness: awarenessProtocol.Awareness;
  public supabase: SupabaseClient;
  public connected: boolean = false;
  public synced: boolean = false;
  public shouldConnect: boolean = true;

  private channel: RealtimeChannel | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private awarenessHeartbeatInterval: ReturnType<typeof setInterval> | null = null;
  public saveInterval: number;
  public userConfig: Record<string, any> | null = null;
  private isDirty: boolean = false;
  private debounceWait: number;
  private isDestroyed: boolean = false;

  private boundOnDocUpdate: (update: Uint8Array, origin: any) => void;
  private boundOnAwarenessUpdate: (
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin: any
  ) => void;
  private boundBeforeUnload: () => void;

  constructor(roomName: string, doc: Y.Doc, options: SupabaseYjsProviderOptions = {}) {
    super();
    this.roomName = roomName;
    this.doc = doc;
    this.awareness = options.awareness || new awarenessProtocol.Awareness(doc);
    this.supabase = options.supabase || createClient();
    this.debounceWait = options.debounceWait ?? 500;
    this.saveInterval = options.saveInterval ?? 3000;
    this.shouldConnect = options.connect !== false;

    if (options.user) {
      this.userConfig = options.user;
      this.awareness.setLocalStateField('user', options.user);
    }

    // Bind listeners
    this.boundOnDocUpdate = this.onDocUpdate.bind(this);
    this.boundOnAwarenessUpdate = this.onAwarenessUpdate.bind(this);
    this.boundBeforeUnload = this.onBeforeUnload.bind(this);

    this.doc.on('update', this.boundOnDocUpdate);
    this.awareness.on('update', this.boundOnAwarenessUpdate);

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.boundBeforeUnload);
    }

    if (this.shouldConnect) {
      this.connect();
    }
  }

  /**
   * Update the local user info and notify awareness listeners.
   */
  public setUser(user: Record<string, any>): void {
    this.userConfig = user;
    this.awareness.setLocalStateField('user', user);
  }

  /**
   * Cold-start hydration from Postgres yjs_documents table or local storage.
   */
  public async hydrate(): Promise<void> {
    try {
      let stateBytes: Uint8Array | null = null;

      if (this.supabase) {
        const { data, error } = await this.supabase
          .from('yjs_documents')
          .select('state')
          .eq('room', this.roomName)
          .maybeSingle();

        if (!error && data?.state) {
          stateBytes = parseByteaToUint8Array(data.state);
        }
      }

      // Fallback to localStorage if state was not loaded from Postgres
      if (!stateBytes && typeof window !== 'undefined') {
        try {
          const cached = window.localStorage.getItem(`yjs_snapshot_${this.roomName}`);
          if (cached) {
            stateBytes = base64ToUint8Array(cached);
          }
        } catch {
          // ignore storage error
        }
      }

      if (stateBytes && stateBytes.length > 0) {
        Y.applyUpdate(this.doc, stateBytes, this);
      }

      this.synced = true;
      this.emit('sync', [true]);
      this.emit('synced', [true]);
    } catch (err) {
      console.warn(`[SupabaseYjsProvider] Error hydrating room ${this.roomName}:`, err);
      this.synced = true;
      this.emit('sync', [true]);
      this.emit('synced', [true]);
    }
  }

  /**
   * Connect to Supabase Realtime channel and BroadcastChannel fallback.
   */
  public async connect(): Promise<void> {
    if (this.connected || this.isDestroyed) return;

    this.emit('status', [{ status: 'connecting' }]);

    // Setup local browser tab BroadcastChannel
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel(`yjs_bc_${this.roomName}`);
        this.broadcastChannel.onmessage = (event: MessageEvent) => {
          if (event.data) {
            const bytes =
              typeof event.data === 'string'
                ? base64ToUint8Array(event.data)
                : event.data instanceof Uint8Array
                ? event.data
                : new Uint8Array(event.data);
            this.handleIncomingMessage(bytes);
          }
        };
      } catch (e) {
        console.warn('[SupabaseYjsProvider] BroadcastChannel unavailable:', e);
      }
    }

    // Hydrate existing document state from database
    await this.hydrate();

    // Subscribe to Supabase Realtime channel
    const channelName = `doc_${this.roomName}`;
    this.channel = this.supabase.channel(channelName, {
      config: {
        broadcast: { ack: false, self: false },
        presence: { key: String(this.doc.clientID) },
      },
    });

    this.channel
      .on('broadcast', { event: 'yjs_raw' }, (payload: any) => {
        const rawData =
          payload?.payload?.data ||
          payload?.data ||
          (typeof payload?.payload === 'string' ? payload.payload : null) ||
          (typeof payload === 'string' ? payload : null);

        if (rawData) {
          const bytes = base64ToUint8Array(rawData);
          this.handleIncomingMessage(bytes);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          this.connected = true;
          this.emit('status', [{ status: 'connected' }]);

          // Send Sync Step 1
          this.sendSyncStep1();

          // Broadcast local awareness state
          this.broadcastAwarenessState();
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          this.connected = false;
          this.emit('status', [{ status: 'disconnected' }]);
        }
      });

    // Send initial sync step 1 over BroadcastChannel as well
    this.sendSyncStep1();
    this.broadcastAwarenessState();

    // Start 15s awareness heartbeat to keep remote cursors active during idle periods
    if (!this.awarenessHeartbeatInterval && typeof window !== 'undefined') {
      this.awarenessHeartbeatInterval = setInterval(() => {
        if (this.connected) {
          this.broadcastAwarenessState();
        }
      }, 15000);
    }
  }

  /**
   * Broadcast message over Supabase Realtime and local BroadcastChannel.
   */
  private broadcastMessage(bytes: Uint8Array): void {
    const base64 = uint8ArrayToBase64(bytes);

    // 1. Send via Supabase Realtime channel
    if (this.channel && this.connected) {
      this.channel.send({
        type: 'broadcast',
        event: 'yjs_raw',
        payload: { data: base64 },
      });
    }

    // 2. Send via browser BroadcastChannel
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(base64);
      } catch {
        // ignore
      }
    }
  }

  /**
   * Process incoming binary message from peer.
   */
  private handleIncomingMessage(bytes: Uint8Array): void {
    if (bytes.length === 0) return;

    try {
      const decoder = decoding.createDecoder(bytes);
      const messageType = decoding.readVarUint(decoder);

      switch (messageType) {
        case MESSAGE_SYNC: {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, MESSAGE_SYNC);
          syncProtocol.readSyncMessage(decoder, encoder, this.doc, this);
          if (encoding.length(encoder) > 1) {
            this.broadcastMessage(encoding.toUint8Array(encoder));
          }
          break;
        }
        case MESSAGE_AWARENESS: {
          awarenessProtocol.applyAwarenessUpdate(
            this.awareness,
            decoding.readVarUint8Array(decoder),
            this
          );
          break;
        }
        case MESSAGE_QUERY_AWARENESS: {
          this.broadcastAwarenessState();
          break;
        }
        default:
          break;
      }
    } catch (err) {
      console.warn('[SupabaseYjsProvider] Error handling message:', err);
    }
  }

  /**
   * Send Yjs Sync Step 1 to initiate synchronization handshake.
   */
  private sendSyncStep1(): void {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, this.doc);
    this.broadcastMessage(encoding.toUint8Array(encoder));
  }

  /**
   * Broadcast current local awareness state.
   */
  private broadcastAwarenessState(): void {
    const localState = this.awareness.getLocalState();
    if (localState !== null) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, [this.doc.clientID])
      );
      this.broadcastMessage(encoding.toUint8Array(encoder));
    }
  }

  /**
   * Handle document updates: broadcast update and schedule snapshot save.
   */
  private onDocUpdate(update: Uint8Array, origin: any): void {
    if (origin !== this) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      this.broadcastMessage(encoding.toUint8Array(encoder));
    }

    this.isDirty = true;
    this.scheduleSave();
  }

  /**
   * Handle awareness changes: broadcast awareness update.
   */
  private onAwarenessUpdate(
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: any
  ): void {
    if (origin !== this) {
      const changedClients = added.concat(updated, removed);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients)
      );
      this.broadcastMessage(encoding.toUint8Array(encoder));
    }
  }

  /**
   * Debounced schedule for persisting document snapshot to Postgres / localStorage.
   */
  private scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.saveSnapshot().catch((err) =>
        console.warn('[SupabaseYjsProvider] Failed to save snapshot:', err)
      );
    }, this.debounceWait);
  }

  /**
   * Persist current document state to Postgres yjs_documents table and localStorage.
   */
  public async saveSnapshot(): Promise<void> {
    if (!this.isDirty && this.synced) return;

    const state = Y.encodeStateAsUpdate(this.doc);
    const hexState = uint8ArrayToHex(state);
    const base64State = uint8ArrayToBase64(state);

    // Save to local storage for quick offline recovery
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(`yjs_snapshot_${this.roomName}`, base64State);
      } catch {
        // ignore
      }
    }

    // Save to Supabase Postgres
    if (isSupabaseConfigured()) {
      try {
        await this.supabase.from('yjs_documents').upsert(
          {
            room: this.roomName,
            state: hexState,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'room' }
        );
        this.isDirty = false;
      } catch (e) {
        console.warn('[SupabaseYjsProvider] Supabase snapshot save error:', e);
      }
    } else {
      this.isDirty = false;
    }
  }

  /**
   * Save on page unload.
   */
  private onBeforeUnload(): void {
    awarenessProtocol.removeAwarenessStates(this.awareness, [this.doc.clientID], 'unload');
    if (this.isDirty) {
      const state = Y.encodeStateAsUpdate(this.doc);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(
            `yjs_snapshot_${this.roomName}`,
            uint8ArrayToBase64(state)
          );
        } catch {
          // ignore
        }
      }
    }
  }

  /**
   * Disconnect from Supabase Realtime and BroadcastChannel.
   */
  public disconnect(): void {
    if (!this.connected && !this.channel) return;

    // Remove awareness for this client
    awarenessProtocol.removeAwarenessStates(this.awareness, [this.doc.clientID], 'disconnect');

    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }

    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }

    if (this.awarenessHeartbeatInterval) {
      clearInterval(this.awarenessHeartbeatInterval);
      this.awarenessHeartbeatInterval = null;
    }

    this.connected = false;
    this.emit('status', [{ status: 'disconnected' }]);
  }

  /**
   * Destroy provider and cleanup all resources.
   */
  public override destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.boundBeforeUnload);
    }

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    // Save final snapshot synchronously to localStorage
    if (this.isDirty) {
      const state = Y.encodeStateAsUpdate(this.doc);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(
            `yjs_snapshot_${this.roomName}`,
            uint8ArrayToBase64(state)
          );
        } catch {
          // ignore
        }
      }
    }

    this.doc.off('update', this.boundOnDocUpdate);
    this.awareness.off('update', this.boundOnAwarenessUpdate);

    this.disconnect();
    super.destroy();
  }
}
