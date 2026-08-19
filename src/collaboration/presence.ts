/**
 * Presence tracker module for managing active peers, user profiles,
 * cursor coordinates, selections, and stale peer eviction.
 */

export interface PeerState {
  id: string;
  user: any;
  role: string;
  cursorRange: { index: number; length: number } | null;
  cursorCoords: any;
  selection: any;
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
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  off(event: string, callback: Function): void {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.delete(callback);
    }
  }

  emit(event: string, ...args: any[]): void {
    if (this.listeners.has(event)) {
      for (const callback of this.listeners.get(event)!) {
        try {
          callback(...args);
        } catch (err) {
          console.error(`Error in presence listener for "${event}":`, err);
        }
      }
    }
  }

  updatePeer(peerId: string, data: any = {}): PeerState | null {
    if (!peerId) return null;

    const now = Date.now();
    const isNew = !this.peers.has(peerId);
    const existing = this.peers.get(peerId) || ({} as Partial<PeerState>);

    const user = {
      id: data.user?.id || existing.user?.id || peerId,
      name: data.user?.name || existing.user?.name || `User ${peerId.slice(0, 5)}`,
      color: data.user?.color || existing.user?.color || '#4285F4',
      avatar: data.user?.avatar || existing.user?.avatar || null,
      email: data.user?.email || existing.user?.email || null,
      ...(data.user || {})
    };

    const peerState: PeerState = {
      id: peerId,
      user,
      role: data.role !== undefined ? data.role : (existing.role || 'viewer'),
      cursorRange: data.cursorRange !== undefined ? data.cursorRange : (existing.cursorRange || null),
      cursorCoords: data.cursorCoords !== undefined ? data.cursorCoords : (existing.cursorCoords || null),
      selection: data.selection !== undefined ? data.selection : (existing.selection || null),
      status: data.status || existing.status || 'active',
      lastSeen: now,
      joinedAt: existing.joinedAt || now
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

  updateCursor(peerId: string, cursorRange: any = null, cursorCoords: any = null): PeerState | null {
    if (!this.peers.has(peerId)) {
      return this.updatePeer(peerId, { cursorRange, cursorCoords });
    }
    const peer = this.peers.get(peerId)!;
    peer.cursorRange = cursorRange;
    peer.cursorCoords = cursorCoords;
    peer.lastSeen = Date.now();

    this.emit('cursor', peer);
    this.emit('update', peer);
    this.emit('change', this.getAllPeers());
    return peer;
  }

  updateSelection(peerId: string, selection: any = null): PeerState | null {
    if (!this.peers.has(peerId)) {
      return this.updatePeer(peerId, { selection });
    }
    const peer = this.peers.get(peerId)!;
    peer.selection = selection;
    peer.lastSeen = Date.now();

    this.emit('selection', peer);
    this.emit('update', peer);
    this.emit('change', this.getAllPeers());
    return peer;
  }

  updateRole(peerId: string, role: string): PeerState | null {
    if (!this.peers.has(peerId)) {
      return this.updatePeer(peerId, { role });
    }
    const peer = this.peers.get(peerId)!;
    peer.role = role;
    peer.lastSeen = Date.now();

    this.emit('roleChange', peer);
    this.emit('update', peer);
    this.emit('change', this.getAllPeers());
    return peer;
  }

  removePeer(peerId: string): boolean {
    if (this.peers.has(peerId)) {
      const peer = this.peers.get(peerId)!;
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
