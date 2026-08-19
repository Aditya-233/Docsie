/**
 * Real-time multi-person collaborative sync engine for Google Docs.
 * Supports BroadcastChannel with Node.js in-memory mock fallback,
 * delta exchange, presence tracking, remote cursors, and role management.
 */

import {
  MESSAGE_TYPES,
  CollaborationProtocol,
  validatePacket,
  createPacket,
  createDocDeltaPacket,
  createPresencePacket,
  createSelectionPacket,
  createPermissionReqPacket,
  createPermissionGrantPacket,
  createDocSyncPacket,
  createCommentSyncPacket
} from './protocol.js';
import { PresenceTracker } from './presence.js';
import { PermissionManager, ROLES, normalizeRole } from '../permissions/manager.js';

/**
 * In-memory MockBroadcastChannel for Node.js test environments or when native BroadcastChannel is missing.
 */
export class MockBroadcastChannel {
  static channels = new Map(); // channelName -> Set<MockBroadcastChannel>

  constructor(name) {
    this.name = name;
    this.closed = false;
    this.onmessage = null;
    this.eventListeners = new Map();

    if (!MockBroadcastChannel.channels.has(name)) {
      MockBroadcastChannel.channels.set(name, new Set());
    }
    MockBroadcastChannel.channels.get(name).add(this);
  }

  postMessage(data) {
    if (this.closed) {
      throw new Error(`Cannot postMessage on closed BroadcastChannel "${this.name}"`);
    }

    const peers = MockBroadcastChannel.channels.get(this.name);
    if (!peers) return;

    // Deep clone data to simulate cross-context IPC
    let clonedData;
    try {
      if (typeof structuredClone === 'function') {
        clonedData = structuredClone(data);
      } else {
        clonedData = JSON.parse(JSON.stringify(data));
      }
    } catch (e) {
      clonedData = data;
    }

    for (const peer of peers) {
      if (peer !== this && !peer.closed) {
        // Dispatch asynchronously
        queueMicrotask(() => {
          if (peer.closed) return;
          const event = { data: clonedData, target: peer };
          if (typeof peer.onmessage === 'function') {
            try {
              peer.onmessage(event);
            } catch (err) {
              console.error(`Error in MockBroadcastChannel onmessage:`, err);
            }
          }
          if (peer.eventListeners.has('message')) {
            for (const handler of peer.eventListeners.get('message')) {
              try {
                handler(event);
              } catch (err) {
                console.error(`Error in MockBroadcastChannel message listener:`, err);
              }
            }
          }
        });
      }
    }
  }

  addEventListener(type, handler) {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type).add(handler);
  }

  removeEventListener(type, handler) {
    if (this.eventListeners.has(type)) {
      this.eventListeners.get(type).delete(handler);
    }
  }

  close() {
    this.closed = true;
    if (MockBroadcastChannel.channels.has(this.name)) {
      MockBroadcastChannel.channels.get(this.name).delete(this);
      if (MockBroadcastChannel.channels.get(this.name).size === 0) {
        MockBroadcastChannel.channels.delete(this.name);
      }
    }
  }

  static resetAllChannels() {
    MockBroadcastChannel.channels.clear();
  }
}

/**
 * CollaborationEngine manages real-time broadcast, presence, cursor sharing,
 * and permissions for a single document.
 */
export class CollaborationEngine {
  constructor(docId = 'doc_master', currentUser = {}, currentRole = ROLES.OWNER, options = {}) {
    this.docId = docId || 'doc_master';
    this.currentUser = {
      id: currentUser.id || `user_${Math.random().toString(36).substring(2, 9)}`,
      name: currentUser.name || 'Anonymous Collaborator',
      color: currentUser.color || '#4285F4',
      avatar: currentUser.avatar || null,
      email: currentUser.email || null,
      ...currentUser
    };
    this.currentRole = normalizeRole(currentRole, ROLES.OWNER);

    this.options = {
      channelName: options.channelName || `gdocs_collab_${this.docId}`,
      heartbeatIntervalMs: options.heartbeatIntervalMs || 4000,
      staleThresholdMs: options.staleThresholdMs || 10000,
      cleanupIntervalMs: options.cleanupIntervalMs || 5000,
      useMockChannel: options.useMockChannel || false,
      autoStart: options.autoStart !== false,
      ...options
    };

    this.presence = new PresenceTracker({ staleThresholdMs: this.options.staleThresholdMs });
    this.permissions = new PermissionManager(this.currentRole, this.currentUser.id);

    this.channel = null;
    this.heartbeatTimer = null;
    this.cleanupTimer = null;
    this.remoteCursors = new Map(); // peerId -> DOMElement
    this.eventListeners = new Map();

    // Legacy callback interface compatibility
    this.listeners = {
      onRemoteDelta: null,
      onPeerPresenceChange: null,
      onPermissionRequest: null,
      onPermissionGrant: null,
      onRoleElevated: null,
      onDocSync: null,
      onCommentSync: null
    };

    if (this.options.autoStart) {
      this.start();
    }
  }

  /**
   * Subscribe to collaboration events.
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from events.
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   */
  off(event, callback) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).delete(callback);
    }
  }

  /**
   * Emit event to internal listeners and legacy callbacks.
   * @param {string} event - Event name
   * @param {...any} args - Arguments
   */
  emit(event, ...args) {
    if (this.eventListeners.has(event)) {
      for (const cb of this.eventListeners.get(event)) {
        try {
          cb(...args);
        } catch (err) {
          console.error(`Error in CollaborationEngine event "${event}":`, err);
        }
      }
    }
  }

  /**
   * Initialize channel, start heartbeat and stale peer eviction timers.
   */
  start() {
    if (this.channel) return;

    // Use custom channel option, native BroadcastChannel if in browser, or fallback mock
    if (this.options.channel) {
      this.channel = this.options.channel;
    } else if (!this.options.useMockChannel && typeof globalThis.BroadcastChannel === 'function') {
      try {
        this.channel = new globalThis.BroadcastChannel(this.options.channelName);
      } catch (e) {
        this.channel = new MockBroadcastChannel(this.options.channelName);
      }
    } else {
      this.channel = new MockBroadcastChannel(this.options.channelName);
    }

    this.channel.onmessage = (event) => this.handleMessage(event.data || event);

    // Announce presence immediately
    this.broadcastPresence();

    // Start periodic heartbeat
    this.heartbeatTimer = setInterval(() => {
      this.broadcastPresence();
    }, this.options.heartbeatIntervalMs);

    // Start periodic cleanup of stale peers
    this.cleanupTimer = setInterval(() => {
      this.cleanupStalePeers();
    }, this.options.cleanupIntervalMs);
  }

  /**
   * Stop channel and timers.
   */
  stop() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    if (this.channel) {
      try {
        this.channel.close();
      } catch (e) {}
      this.channel = null;
    }
    this.clearAllRemoteCursors();
    this.presence.clear();
  }

  /**
   * Alias for stop().
   */
  destroy() {
    this.stop();
  }

  /**
   * Generic broadcast method creating and sending standard protocol packet.
   * @param {string} type - Message type
   * @param {object} payload - Payload data
   */
  broadcast(type, payload = {}) {
    if (!this.channel) return;

    const packet = createPacket(
      type,
      this.currentUser,
      this.currentRole,
      this.docId,
      payload
    );

    try {
      this.channel.postMessage(packet);
    } catch (err) {
      console.error('Failed to postMessage:', err);
    }
  }

  /**
   * Broadcast local rich-text delta change.
   * @param {any} delta - Quill delta or delta object
   * @param {string} [fullHtml] - Complete HTML snapshot
   * @param {number} [version] - Document version
   */
  broadcastDelta(delta, fullHtml = null, version = null) {
    if (!this.canEdit()) {
      console.warn(`User with role "${this.currentRole}" cannot broadcast deltas.`);
      return;
    }

    const packet = createDocDeltaPacket(
      this.currentUser,
      this.currentRole,
      this.docId,
      { delta, fullHtml, version }
    );

    if (this.channel) {
      this.channel.postMessage(packet);
    }
  }

  /**
   * Broadcast current presence beacon (user profile, role, cursor location).
   * @param {object|null} cursorRange - Range { index, length }
   * @param {object|null} cursorCoords - Bounds { top, left, height }
   * @param {string} [status='active'] - Status
   */
  broadcastPresence(cursorRange = null, cursorCoords = null, status = 'active') {
    const packet = createPresencePacket(
      this.currentUser,
      this.currentRole,
      this.docId,
      { cursorRange, cursorCoords, status }
    );

    if (this.channel) {
      this.channel.postMessage(packet);
    }
  }

  /**
   * Broadcast current text selection.
   * @param {object|null} range - Range { index, length }
   * @param {object|null} bounds - Visual coordinate bounds
   */
  broadcastSelection(range = null, bounds = null) {
    const packet = createSelectionPacket(
      this.currentUser,
      this.currentRole,
      this.docId,
      { range, bounds }
    );

    if (this.channel) {
      this.channel.postMessage(packet);
    }
  }

  /**
   * Request edit access from doc owner/editors.
   * @param {string} [reason=''] - Optional message
   */
  requestEditAccess(reason = '') {
    const packet = createPermissionReqPacket(
      this.currentUser,
      this.currentRole,
      this.docId,
      { requestedRole: ROLES.EDITOR, reason }
    );

    if (this.channel) {
      this.channel.postMessage(packet);
    }
    this.emit('permissionRequestedSelf', packet);
  }

  /**
   * Grant edit access to a target user.
   * @param {string} targetUserId - Target collaborator ID
   * @param {string} [newRole='editor'] - Elevated role
   */
  grantEditAccess(targetUserId, newRole = ROLES.EDITOR) {
    if (!this.canManagePermissions() && !this.canEdit()) {
      throw new Error('Unauthorized to grant permissions');
    }

    const packet = createPermissionGrantPacket(
      this.currentUser,
      this.currentRole,
      this.docId,
      { targetUserId, newRole, grantedBy: this.currentUser.id }
    );

    if (this.channel) {
      this.channel.postMessage(packet);
    }
    this.emit('permissionGrantedSelf', packet);
  }

  /**
   * Broadcast full document synchronization.
   * @param {string} action - 'request' | 'response'
   * @param {object|null} doc - Full document object
   * @param {number} [version=1] - Document version
   */
  broadcastDocSync(action = 'request', doc = null, version = 1) {
    const packet = createDocSyncPacket(
      this.currentUser,
      this.currentRole,
      this.docId,
      { action, doc, version }
    );

    if (this.channel) {
      this.channel.postMessage(packet);
    }
  }

  /**
   * Broadcast comment synchronization action.
   * @param {string} action - 'create' | 'reply' | 'resolve' | 'delete'
   * @param {object} [comment] - Comment object
   * @param {string} [commentId] - Target ID
   */
  broadcastCommentSync(action = 'create', comment = null, commentId = null) {
    const packet = createCommentSyncPacket(
      this.currentUser,
      this.currentRole,
      this.docId,
      { action, comment, commentId }
    );

    if (this.channel) {
      this.channel.postMessage(packet);
    }
  }

  /**
   * Handle incoming raw message or packet from channel.
   * @param {any} rawData - Incoming packet data
   */
  handleMessage(rawData) {
    if (!rawData) return;
    const packet = typeof rawData === 'object' ? rawData : null;
    if (!packet) return;

    // Ignore messages sent by self
    if (packet.senderId === this.currentUser.id) return;

    // Ignore messages intended for another document if docId is set
    if (packet.docId && packet.docId !== this.docId) return;

    const validation = validatePacket(packet);
    if (!validation.valid) {
      console.warn('Received invalid packet:', validation.errors, packet);
      return;
    }

    const { type, senderId, senderUser, senderRole, payload } = packet;

    switch (type) {
      case MESSAGE_TYPES.PRESENCE: {
        const updateData = {
          user: payload.user || senderUser,
          role: payload.role || senderRole,
          cursorRange: payload.cursorRange,
          cursorCoords: payload.cursorCoords,
          status: payload.status || 'active'
        };
        if (payload.selection !== undefined) {
          updateData.selection = payload.selection;
        }
        const peer = this.presence.updatePeer(senderId, updateData);

        if (payload.cursorRange || payload.cursorCoords) {
          this.renderRemoteCursor(senderId, peer.user, payload.cursorRange, payload.cursorCoords);
          this.emit('remoteCursor', { peerId: senderId, user: peer.user, cursorRange: payload.cursorRange, cursorCoords: payload.cursorCoords });
        }

        this.emit('peerPresence', Array.from(this.presence.getAllPeers()));
        if (typeof this.listeners.onPeerPresenceChange === 'function') {
          this.listeners.onPeerPresenceChange(Array.from(this.presence.getAllPeers()));
        }
        break;
      }

      case MESSAGE_TYPES.DOC_DELTA: {
        this.emit('remoteDelta', { delta: payload.delta, fullHtml: payload.fullHtml, version: payload.version, senderUser });
        if (typeof this.listeners.onRemoteDelta === 'function') {
          this.listeners.onRemoteDelta(payload.delta, payload.fullHtml);
        }
        break;
      }

      case MESSAGE_TYPES.SELECTION: {
        this.presence.updateSelection(senderId, payload.range);
        this.emit('remoteSelection', { peerId: senderId, user: senderUser, range: payload.range, bounds: payload.bounds });
        break;
      }

      case MESSAGE_TYPES.PERMISSION_REQ: {
        const requestingUser = payload.user || senderUser;
        this.emit('permissionRequest', requestingUser, packet);
        if (this.canManagePermissions() || this.canEdit()) {
          if (typeof this.listeners.onPermissionRequest === 'function') {
            this.listeners.onPermissionRequest(requestingUser);
          }
        }
        break;
      }

      case MESSAGE_TYPES.PERMISSION_GRANT: {
        if (payload.targetUserId === this.currentUser.id) {
          const elevatedRole = normalizeRole(payload.newRole || ROLES.EDITOR);
          this.setRole(elevatedRole);
          this.emit('roleElevated', elevatedRole, packet);
          if (typeof this.listeners.onRoleElevated === 'function') {
            this.listeners.onRoleElevated(elevatedRole);
          }
          // Re-announce presence with elevated role
          this.broadcastPresence();
        } else {
          // Update peer role if tracked
          this.presence.updateRole(payload.targetUserId, payload.newRole);
        }
        this.emit('permissionGrant', payload, packet);
        if (typeof this.listeners.onPermissionGrant === 'function') {
          this.listeners.onPermissionGrant(payload);
        }
        break;
      }

      case MESSAGE_TYPES.DOC_SYNC: {
        this.emit('docSync', payload, senderUser);
        if (typeof this.listeners.onDocSync === 'function') {
          this.listeners.onDocSync(payload, senderUser);
        }
        break;
      }

      case MESSAGE_TYPES.COMMENT_SYNC: {
        this.emit('commentSync', payload, senderUser);
        if (typeof this.listeners.onCommentSync === 'function') {
          this.listeners.onCommentSync(payload, senderUser);
        }
        break;
      }
    }
  }

  /**
   * Evict peers that haven't sent a heartbeat within staleThresholdMs.
   */
  cleanupStalePeers() {
    const evictedPeerIds = this.presence.evictStalePeers();
    for (const peerId of evictedPeerIds) {
      this.removeRemoteCursor(peerId);
      this.emit('peerLeave', peerId);
    }

    if (evictedPeerIds.length > 0) {
      this.emit('peerPresence', this.presence.getAllPeers());
      if (typeof this.listeners.onPeerPresenceChange === 'function') {
        this.listeners.onPeerPresenceChange(this.presence.getAllPeers());
      }
    }
  }

  /**
   * Render or update remote cursor in DOM (browser safe).
   * @param {string} peerId - Remote peer ID
   * @param {object} user - Remote user profile
   * @param {object|null} range - Character range { index, length }
   * @param {object|null} [coords] - Explicit coordinates { top, left }
   * @param {object} [quillInstance] - Optional Quill instance
   */
  renderRemoteCursor(peerId, user = {}, range = null, coords = null, quillInstance = null) {
    if (typeof document === 'undefined') return;

    const quill = quillInstance || (typeof window !== 'undefined' ? window.quill : null);
    let top = coords?.top;
    let left = coords?.left;

    if ((top === undefined || left === undefined) && quill && range && typeof quill.getBounds === 'function') {
      try {
        const bounds = quill.getBounds(range.index);
        if (bounds) {
          top = bounds.top;
          left = bounds.left;
        }
      } catch (e) {}
    }

    if (top === undefined || left === undefined) return;

    let cursorEl = this.remoteCursors.get(peerId);
    if (!cursorEl || !cursorEl.parentNode) {
      cursorEl = document.createElement('div');
      cursorEl.className = 'remote-cursor';
      cursorEl.dataset.peerId = peerId;
      cursorEl.innerHTML = `
        <div class="remote-cursor-caret" style="background:${user.color || '#4285F4'};"></div>
        <div class="remote-cursor-flag" style="background:${user.color || '#4285F4'};">${user.name || 'User'}</div>
      `;
      const editorContainer = document.querySelector('.ql-editor') || document.body;
      if (editorContainer) {
        editorContainer.appendChild(cursorEl);
      }
      this.remoteCursors.set(peerId, cursorEl);
    }

    cursorEl.style.top = `${top}px`;
    cursorEl.style.left = `${left}px`;
  }

  /**
   * Remove remote cursor from DOM.
   * @param {string} peerId - Peer ID
   */
  removeRemoteCursor(peerId) {
    const el = this.remoteCursors.get(peerId);
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
    this.remoteCursors.delete(peerId);
  }

  /**
   * Clear all remote cursors from DOM.
   */
  clearAllRemoteCursors() {
    for (const [peerId, el] of this.remoteCursors.entries()) {
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }
    this.remoteCursors.clear();
  }

  /**
   * Update active user role.
   * @param {string} newRole - New role
   */
  setRole(newRole) {
    this.currentRole = normalizeRole(newRole, this.currentRole);
    this.permissions.setRole(this.currentRole);
  }

  /**
   * Update user profile.
   * @param {object} user - User profile object
   */
  setUser(user = {}) {
    this.currentUser = { ...this.currentUser, ...user };
    this.permissions.userId = this.currentUser.id;
    this.broadcastPresence();
  }

  /**
   * Access control shortcut queries.
   */
  canEdit() { return this.permissions.canEdit(); }
  canComment() { return this.permissions.canComment(); }
  canShare() { return this.permissions.canShare(); }
  canDelete() { return this.permissions.canDelete(); }
  canManagePermissions() { return this.permissions.canManagePermissions(); }
  getPermissions() { return this.permissions.getPermissions(); }

  /**
   * Get all active peers.
   * @returns {object[]}
   */
  getPeers() {
    return this.presence.getAllPeers();
  }
}
