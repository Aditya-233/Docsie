/**
 * Presence tracker module for managing active peers, user profiles,
 * cursor coordinates, selections, and stale peer eviction.
 */

import type { UserProfile, UserRole } from '../types/index.ts';

export interface CursorCoordinates {
  top: number;
  left: number;
  height?: number;
  width?: number;
}

export interface SelectionBounds {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface PeerState {
  id: string;
  user: UserProfile | { id: string; name?: string; color?: string; email?: string; avatar?: string | null };
  role: UserRole | string;
  cursorRange: { index: number; length: number } | null;
  cursorCoords: CursorCoordinates | null;
  selection: { index: number; length: number } | null;
  status: string;
  lastSeen: number;
  joinedAt: number;
}

export class PresenceTracker {
  public staleThresholdMs: number;
  private peers: Map<string, PeerState>;
  private listeners: Map<string, Set<Function>>;

  constructor(options: { staleThresholdMs?: number } = {}) {
    this.staleThresholdMs = options.staleThresholdMs || 10000;
    this.peers = new Map();
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
      for (const callback of set) {
        try {
          callback(...args);
        } catch (err) {
          console.error(`Error in presence listener for "${event}":`, err);
        }
      }
    }
  }

  updatePeer(peerId: string, data: Partial<PeerState> = {}): PeerState | null {
    if (!peerId) return null;

    const now = Date.now();
    const isNew = !this.peers.has(peerId);
    const existing = this.peers.get(peerId);

    const user = {
      id: data.user?.id || existing?.user?.id || peerId,
      name: data.user?.name || existing?.user?.name || `User ${peerId.slice(0, 5)}`,
      color: data.user?.color || existing?.user?.color || '#4285F4',
      avatar: data.user?.avatar || existing?.user?.avatar || null,
      email: data.user?.email || existing?.user?.email || '',
      ...(data.user || {})
    };

    const peerState: PeerState = {
      id: peerId,
      user,
      role: data.role !== undefined ? data.role : (existing?.role || 'viewer'),
      cursorRange: data.cursorRange !== undefined ? data.cursorRange : (existing?.cursorRange || null),
      cursorCoords: data.cursorCoords !== undefined ? data.cursorCoords : (existing?.cursorCoords || null),
      selection: data.selection !== undefined ? data.selection : (existing?.selection || null),
      status: data.status || existing?.status || 'active',
      lastSeen: now,
      joinedAt: existing?.joinedAt || now
    };

    this.peers.set(peerId, peerState);

    if (isNew) {
      this.emit('join', peerState);
    }
    this.emit('update', peerState);
    this.emit('change', this.getAllPeers());

    if (data.cursorRange !== undefined || data.cursorCoords !== undefined) {
      this.emit('cursor', peerState);
    }

    return peerState;
  }

  updateCursor(
    peerId: string,
    cursorRange: { index: number; length: number } | null = null,
    cursorCoords: CursorCoordinates | null = null
  ): PeerState | null {
    const peer = this.peers.get(peerId);
    if (!peer) {
      return this.updatePeer(peerId, { cursorRange, cursorCoords });
    }
    peer.cursorRange = cursorRange;
    peer.cursorCoords = cursorCoords;
    peer.lastSeen = Date.now();

    this.emit('cursor', peer);
    this.emit('update', peer);
    this.emit('change', this.getAllPeers());
    return peer;
  }

  updateSelection(
    peerId: string,
    selection: { index: number; length: number } | null = null
  ): PeerState | null {
    const peer = this.peers.get(peerId);
    if (!peer) {
      return this.updatePeer(peerId, { selection });
    }
    peer.selection = selection;
    peer.lastSeen = Date.now();

    this.emit('selection', peer);
    this.emit('update', peer);
    this.emit('change', this.getAllPeers());
    return peer;
  }

  updateRole(peerId: string, role: string): PeerState | null {
    const peer = this.peers.get(peerId);
    if (!peer) {
      return this.updatePeer(peerId, { role });
    }
    peer.role = role;
    peer.lastSeen = Date.now();

    this.emit('roleChange', peer);
    this.emit('update', peer);
    this.emit('change', this.getAllPeers());
    return peer;
  }

  removePeer(peerId: string): boolean {
    const peer = this.peers.get(peerId);
    if (peer) {
      this.peers.delete(peerId);
      this.emit('leave', peer);
      this.emit('change', this.getAllPeers());
      return true;
    }
    return false;
  }

  getPeer(peerId: string): PeerState | null {
    return this.peers.get(peerId) || null;
  }

  hasPeer(peerId: string): boolean {
    return this.peers.has(peerId);
  }

  getAllPeers(): PeerState[] {
    return Array.from(this.peers.values());
  }

  getActivePeers(thresholdMs: number = this.staleThresholdMs): PeerState[] {
    const now = Date.now();
    return this.getAllPeers().filter(peer => now - peer.lastSeen <= thresholdMs);
  }

  getActivePeersCount(thresholdMs: number = this.staleThresholdMs): number {
    return this.getActivePeers(thresholdMs).length;
  }

  evictStalePeers(thresholdMs: number = this.staleThresholdMs): string[] {
    const now = Date.now();
    const evicted: string[] = [];

    for (const [peerId, peer] of this.peers.entries()) {
      if (now - peer.lastSeen > thresholdMs) {
        this.peers.delete(peerId);
        evicted.push(peerId);
        this.emit('leave', peer);
        this.emit('evict', peer);
      }
    }

    if (evicted.length > 0) {
      this.emit('change', this.getAllPeers());
    }

    return evicted;
  }

  clear(): void {
    const count = this.peers.size;
    this.peers.clear();
    if (count > 0) {
      this.emit('change', []);
    }
  }

  toJSON(): PeerState[] {
    return this.getAllPeers();
  }
}
