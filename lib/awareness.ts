/**
 * Awareness and Collaborative Presence Management for Yjs CRDT
 */

import type * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";
import type { CollaboratorPeer, CursorPosition, UserProfile } from "../types/index";

export const DEFAULT_AWARENESS_TIMEOUT = 30000; // 30 seconds stale timeout

export interface AwarenessUserState {
  user: UserProfile;
  cursor?: CursorPosition | null;
  selection?: { anchor: number; head: number } | null;
  lastUpdated?: number;
  [key: string]: any;
}

export class AwarenessManager {
  public awareness: awarenessProtocol.Awareness;
  public doc: Y.Doc;
  private staleCheckInterval: ReturnType<typeof setInterval> | null = null;
  private lastActivityMap: Map<number, number> = new Map();

  constructor(doc: Y.Doc, existingAwareness?: awarenessProtocol.Awareness) {
    this.doc = doc;
    this.awareness = existingAwareness || new awarenessProtocol.Awareness(doc);

    // Track activity timestamps
    this.awareness.on("change", ({ added, updated }: { added: number[]; updated: number[] }) => {
      const now = Date.now();
      for (const client of added.concat(updated)) {
        this.lastActivityMap.set(client, now);
      }
    });
  }

  /**
   * Set or update current client user profile
   */
  public setUser(user: UserProfile): void {
    this.awareness.setLocalStateField("user", user);
    this.awareness.setLocalStateField("lastUpdated", Date.now());
    this.lastActivityMap.set(this.doc.clientID, Date.now());
  }

  /**
   * Set or update current client cursor position
   */
  public setCursor(cursor: CursorPosition | null): void {
    this.awareness.setLocalStateField("cursor", cursor);
    this.awareness.setLocalStateField("lastUpdated", Date.now());
    this.lastActivityMap.set(this.doc.clientID, Date.now());
  }

  /**
   * Set selection range
   */
  public setSelection(selection: { anchor: number; head: number } | null): void {
    this.awareness.setLocalStateField("selection", selection);
    this.awareness.setLocalStateField("lastUpdated", Date.now());
    this.lastActivityMap.set(this.doc.clientID, Date.now());
  }

  /**
   * Get all active collaborators as CollaboratorPeer list
   */
  public getActivePeers(): CollaboratorPeer[] {
    const states = this.awareness.getStates();
    const peers: CollaboratorPeer[] = [];

    states.forEach((state, clientId) => {
      if (state && (state.user || state.cursor)) {
        peers.push({
          clientId,
          user: state.user || {
            id: "anonymous-" + clientId,
            name: "Anonymous User",
            color: "#4285F4",
          },
          cursor: state.cursor || null,
          selection: state.selection || null,
          color: state.user?.color || "#4285F4",
          lastUpdated: state.lastUpdated || this.lastActivityMap.get(clientId) || Date.now(),
        });
      }
    });

    return peers;
  }

  /**
   * Evict stale clients that have not sent updates within timeoutMs
   */
  public evictStaleClients(timeoutMs: number = DEFAULT_AWARENESS_TIMEOUT, currentTime: number = Date.now()): number[] {
    const states = this.awareness.getStates();
    const staleClients: number[] = [];

    states.forEach((state, clientId) => {
      // Do not evict self if connected
      if (clientId === this.doc.clientID) return;

      const metaLastUpdated = this.awareness.meta.get(clientId)?.lastUpdated;
      const lastUpdated =
        typeof state?.lastUpdated === "number"
          ? state.lastUpdated
          : (metaLastUpdated || this.lastActivityMap.get(clientId) || 0);

      if (currentTime - lastUpdated > timeoutMs) {
        staleClients.push(clientId);
      }
    });

    if (staleClients.length > 0) {
      awarenessProtocol.removeAwarenessStates(this.awareness, staleClients, "timeout_eviction");
      for (const clientId of staleClients) {
        this.lastActivityMap.delete(clientId);
      }
    }

    return staleClients;
  }

  /**
   * Start periodic background sweep for stale client eviction
   */
  public startStaleSweeper(intervalMs: number = 10000, timeoutMs: number = DEFAULT_AWARENESS_TIMEOUT): void {
    this.stopStaleSweeper();
    this.staleCheckInterval = setInterval(() => {
      this.evictStaleClients(timeoutMs);
    }, intervalMs);
  }

  public stopStaleSweeper(): void {
    if (this.staleCheckInterval) {
      clearInterval(this.staleCheckInterval);
      this.staleCheckInterval = null;
    }
  }

  public destroy(): void {
    this.stopStaleSweeper();
    awarenessProtocol.removeAwarenessStates(this.awareness, [this.doc.clientID], "destroy");
    this.awareness.destroy();
  }
}
