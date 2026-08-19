/**
 * Presence tracker module for managing active peers, user profiles,
 * cursor coordinates, selections, and stale peer eviction.
 */

export class PresenceTracker {
  constructor(options = {}) {
    this.staleThresholdMs = options.staleThresholdMs || 10000;
    this.peers = new Map(); // peerId -> PeerState
    this.listeners = new Map(); // event -> Set<Function>
  }

  /**
   * Subscribe to presence events.
   * @param {string} event - Event name ('join', 'update', 'leave', 'cursor', 'evict', 'change')
   * @param {Function} callback - Event handler
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from presence events.
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  /**
   * Emit an event to registered listeners.
   * @param {string} event - Event name
   * @param {...any} args - Arguments to pass
   */
  emit(event, ...args) {
    if (this.listeners.has(event)) {
      for (const callback of this.listeners.get(event)) {
        try {
          callback(...args);
        } catch (err) {
          console.error(`Error in presence listener for "${event}":`, err);
        }
      }
    }
  }

  /**
   * Update or register a peer in the presence tracker.
   * @param {string} peerId - Unique peer/user ID
   * @param {object} data - Peer information
   * @returns {object} Updated peer state
   */
  updatePeer(peerId, data = {}) {
    if (!peerId) return null;

    const now = Date.now();
    const isNew = !this.peers.has(peerId);
    const existing = this.peers.get(peerId) || {};

    const user = {
      id: data.user?.id || existing.user?.id || peerId,
      name: data.user?.name || existing.user?.name || `User ${peerId.slice(0, 5)}`,
      color: data.user?.color || existing.user?.color || '#4285F4',
      avatar: data.user?.avatar || existing.user?.avatar || null,
      email: data.user?.email || existing.user?.email || null,
      ...(data.user || {})
    };

    const peerState = {
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

  /**
   * Update cursor position for a specific peer.
   * @param {string} peerId - Peer ID
   * @param {object|null} cursorRange - Text range { index, length }
   * @param {object|null} cursorCoords - Coordinate bounds { top, left, height }
   * @returns {object|null} Updated peer state
   */
  updateCursor(peerId, cursorRange = null, cursorCoords = null) {
    if (!this.peers.has(peerId)) {
      return this.updatePeer(peerId, { cursorRange, cursorCoords });
    }
    const peer = this.peers.get(peerId);
    peer.cursorRange = cursorRange;
    peer.cursorCoords = cursorCoords;
    peer.lastSeen = Date.now();

    this.emit('cursor', peer);
    this.emit('update', peer);
    this.emit('change', this.getAllPeers());
    return peer;
  }

  /**
   * Update text selection for a peer.
   * @param {string} peerId - Peer ID
   * @param {object|null} selection - Selection range { index, length }
   * @returns {object|null} Updated peer state
   */
  updateSelection(peerId, selection = null) {
    if (!this.peers.has(peerId)) {
      return this.updatePeer(peerId, { selection });
    }
    const peer = this.peers.get(peerId);
    peer.selection = selection;
    peer.lastSeen = Date.now();

    this.emit('selection', peer);
    this.emit('update', peer);
    this.emit('change', this.getAllPeers());
    return peer;
  }

  /**
   * Update role for a peer.
   * @param {string} peerId - Peer ID
   * @param {string} role - New role
   * @returns {object|null} Updated peer state
   */
  updateRole(peerId, role) {
    if (!this.peers.has(peerId)) {
      return this.updatePeer(peerId, { role });
    }
    const peer = this.peers.get(peerId);
    peer.role = role;
    peer.lastSeen = Date.now();

    this.emit('roleChange', peer);
    this.emit('update', peer);
    this.emit('change', this.getAllPeers());
    return peer;
  }

  /**
   * Remove a peer by ID.
   * @param {string} peerId - Peer ID to remove
   * @returns {boolean} True if peer existed and was removed
   */
  removePeer(peerId) {
    if (this.peers.has(peerId)) {
      const peer = this.peers.get(peerId);
      this.peers.delete(peerId);
      this.emit('leave', peer);
      this.emit('change', this.getAllPeers());
      return true;
    }
    return false;
  }

  /**
   * Get peer state by ID.
   * @param {string} peerId - Peer ID
   * @returns {object|null} Peer state or null
   */
  getPeer(peerId) {
    return this.peers.get(peerId) || null;
  }

  /**
   * Check if peer exists.
   * @param {string} peerId - Peer ID
   * @returns {boolean} True if peer exists
   */
  hasPeer(peerId) {
    return this.peers.has(peerId);
  }

  /**
   * Get all active peers as an array.
   * @returns {object[]} Array of peer states
   */
  getAllPeers() {
    return Array.from(this.peers.values());
  }

  /**
   * Get peers that were seen within the active threshold.
   * @param {number} [thresholdMs] - Max milliseconds since lastSeen
   * @returns {object[]} Active peers
   */
  getActivePeers(thresholdMs = this.staleThresholdMs) {
    const now = Date.now();
    return this.getAllPeers().filter(peer => now - peer.lastSeen <= thresholdMs);
  }

  /**
   * Get number of active peers.
   * @param {number} [thresholdMs] - Max milliseconds since lastSeen
   * @returns {number} Active count
   */
  getActivePeersCount(thresholdMs = this.staleThresholdMs) {
    return this.getActivePeers(thresholdMs).length;
  }

  /**
   * Evict stale peers whose lastSeen timestamp exceeds the threshold.
   * @param {number} [thresholdMs] - Threshold in milliseconds
   * @returns {string[]} List of evicted peer IDs
   */
  evictStalePeers(thresholdMs = this.staleThresholdMs) {
    const now = Date.now();
    const evicted = [];

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

  /**
   * Clear all tracked peers.
   */
  clear() {
    const count = this.peers.size;
    this.peers.clear();
    if (count > 0) {
      this.emit('change', []);
    }
  }

  /**
   * Serialize presence data to JSON array.
   * @returns {object[]} Serialized peers
   */
  toJSON() {
    return this.getAllPeers();
  }
}
