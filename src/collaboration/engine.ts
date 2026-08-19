/**
 * Real-time multi-person collaborative sync engine for Google Docs.
 * Supports BroadcastChannel with Node.js in-memory mock fallback,
 * delta exchange, presence tracking, remote cursors, and role management.
 */

import {
  MESSAGE_TYPES,
  validatePacket,
  createPacket,
  createDocDeltaPacket,
  createPresencePacket,
  createSelectionPacket,
  createPermissionReqPacket,
  createPermissionGrantPacket,
  createDocSyncPacket,
  createCommentSyncPacket,
  type CollabPacket
} from './protocol.ts';
import { PresenceTracker, type PeerState, type CursorCoordinates } from './presence.ts';
import { PermissionManager, ROLES, normalizeRole } from '../permissions/manager.ts';
import type { UserRole, UserProfile, QuillDelta } from '../types/index.ts';

export class MockBroadcastChannel {
  static channels: Map<string, Set<MockBroadcastChannel>> = new Map();

  public name: string;
  public closed: boolean;
  public onmessage: ((event: { data: unknown; target: MockBroadcastChannel }) => void) | null;
  public eventListeners: Map<string, Set<Function>>;

  constructor(name: string) {
    this.name = name;
    this.closed = false;
    this.onmessage = null;
    this.eventListeners = new Map();

    let channelSet = MockBroadcastChannel.channels.get(name);
    if (!channelSet) {
      channelSet = new Set();
      MockBroadcastChannel.channels.set(name, channelSet);
    }
    channelSet.add(this);
  }

  postMessage(data: unknown): void {
    if (this.closed) {
      throw new Error(`Cannot postMessage on closed BroadcastChannel "${this.name}"`);
    }

    const peers = MockBroadcastChannel.channels.get(this.name);
    if (!peers) return;

    let clonedData: unknown;
    try {
      if (typeof structuredClone === 'function') {
        clonedData = structuredClone(data);
      } else {
        clonedData = JSON.parse(JSON.stringify(data));
      }
    } catch (_e) {
      clonedData = data;
    }

    for (const peer of peers) {
      if (peer !== this && !peer.closed) {
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
          const listeners = peer.eventListeners.get('message');
          if (listeners) {
            for (const handler of listeners) {
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

  addEventListener(type: string, handler: Function): void {
    let set = this.eventListeners.get(type);
    if (!set) {
      set = new Set();
      this.eventListeners.set(type, set);
    }
    set.add(handler);
  }

  removeEventListener(type: string, handler: Function): void {
    const set = this.eventListeners.get(type);
    if (set) {
      set.delete(handler);
    }
  }

  close(): void {
    this.closed = true;
    const channelSet = MockBroadcastChannel.channels.get(this.name);
    if (channelSet) {
      channelSet.delete(this);
      if (channelSet.size === 0) {
        MockBroadcastChannel.channels.delete(this.name);
      }
    }
  }

  static resetAllChannels(): void {
    MockBroadcastChannel.channels.clear();
  }
}

export interface CollabEngineOptions {
  channelName?: string;
  heartbeatIntervalMs?: number;
  staleThresholdMs?: number;
  cleanupIntervalMs?: number;
  useMockChannel?: boolean;
  autoStart?: boolean;
  channel?: BroadcastChannel | MockBroadcastChannel | null;
}

export class CollaborationEngine {
  public docId: string;
  public currentUser: UserProfile;
  public currentRole: UserRole;
  public options: CollabEngineOptions;
  public presence: PresenceTracker;
  public permissions: PermissionManager;
  public channel: BroadcastChannel | MockBroadcastChannel | null;
  public heartbeatTimer: ReturnType<typeof setInterval> | null;
  public cleanupTimer: ReturnType<typeof setInterval> | null;
  public remoteCursors: Map<string, HTMLElement>;
  public eventListeners: Map<string, Set<Function>>;
  public listeners: Record<string, Function | null>;

  constructor(
    docId: string = 'doc_master',
    currentUser: Partial<UserProfile> = {},
    currentRole: unknown = ROLES.OWNER,
    options: CollabEngineOptions = {}
  ) {
    this.docId = docId || 'doc_master';
    this.currentUser = {
      id: currentUser.id || `user_${Math.random().toString(36).substring(2, 9)}`,
      name: currentUser.name || 'Anonymous Collaborator',
      color: currentUser.color || '#4285F4',
      avatar: currentUser.avatar || null,
      email: currentUser.email || '',
      role: normalizeRole(currentUser.role || currentRole, ROLES.OWNER)
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
    this.remoteCursors = new Map();
    this.eventListeners = new Map();

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

  on(event: string, callback: Function): () => void {
    let set = this.eventListeners.get(event);
    if (!set) {
      set = new Set();
      this.eventListeners.set(event, set);
    }
    set.add(callback);
    return () => this.off(event, callback);
  }

  off(event: string, callback: Function): void {
    const set = this.eventListeners.get(event);
    if (set) {
      set.delete(callback);
    }
  }

  emit(event: string, ...args: unknown[]): void {
    const set = this.eventListeners.get(event);
    if (set) {
      for (const cb of set) {
        try {
          cb(...args);
        } catch (err) {
          console.error(`Error in CollaborationEngine event "${event}":`, err);
        }
      }
    }
  }

  start(): void {
    if (this.channel) return;

    const channelName = this.options.channelName || `gdocs_collab_${this.docId}`;

    if (this.options.channel) {
      this.channel = this.options.channel;
    } else if (!this.options.useMockChannel && typeof globalThis.BroadcastChannel === 'function') {
      try {
        this.channel = new globalThis.BroadcastChannel(channelName);
      } catch (_e) {
        this.channel = new MockBroadcastChannel(channelName);
      }
    } else {
      this.channel = new MockBroadcastChannel(channelName);
    }

    this.channel.onmessage = (event: { data?: unknown } | unknown) => {
      const data = event && typeof event === 'object' && 'data' in event ? (event as { data: unknown }).data : event;
      this.handleMessage(data);
    };

    this.broadcastPresence();

    this.heartbeatTimer = setInterval(() => {
      this.broadcastPresence();
    }, this.options.heartbeatIntervalMs);

    this.cleanupTimer = setInterval(() => {
      this.cleanupStalePeers();
    }, this.options.cleanupIntervalMs);
  }

  stop(): void {
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
      } catch (_e) {}
      this.channel = null;
    }
    this.clearAllRemoteCursors();
    this.presence.clear();
  }

  destroy(): void {
    this.stop();
  }

  broadcast(type: string, payload: Record<string, unknown> = {}): void {
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

  broadcastDelta(delta: QuillDelta | unknown, fullHtml: string | null = null, version: number | null = null): void {
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

  broadcastPresence(
    cursorRange: { index: number; length: number } | null = null,
    cursorCoords: CursorCoordinates | null = null,
    status: string = 'active'
  ): void {
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

  broadcastSelection(
    range: { index: number; length: number } | null = null,
    bounds: { top: number; left: number; width: number; height: number } | null = null
  ): void {
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

  requestEditAccess(reason: string = ''): void {
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

  grantEditAccess(targetUserId: string, newRole: UserRole = ROLES.EDITOR): void {
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

  broadcastDocSync(action: string = 'request', doc: unknown = null, version: number = 1): void {
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

  broadcastCommentSync(action: string = 'create', comment: unknown = null, commentId: string | null = null): void {
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

  handleMessage(rawData: unknown): void {
    if (!rawData || typeof rawData !== 'object') return;
    const packet = rawData as CollabPacket<Record<string, unknown>>;

    if (packet.senderId === this.currentUser.id) return;
    if (packet.docId && packet.docId !== this.docId) return;

    const validation = validatePacket(packet);
    if (!validation.valid) {
      console.warn('Received invalid packet:', validation.errors, packet);
      return;
    }

    const { type, senderId, senderUser, senderRole, payload } = packet;

    switch (type) {
      case MESSAGE_TYPES.PRESENCE: {
        const updateData: Partial<PeerState> = {
          user: (payload.user as UserProfile) || senderUser,
          role: (payload.role as UserRole) || senderRole,
          cursorRange: payload.cursorRange as { index: number; length: number } | null,
          cursorCoords: payload.cursorCoords as CursorCoordinates | null,
          status: (payload.status as string) || 'active'
        };
        if (payload.selection !== undefined) {
          updateData.selection = payload.selection as { index: number; length: number } | null;
        }
        const peer = this.presence.updatePeer(senderId, updateData);

        if (payload.cursorRange || payload.cursorCoords) {
          this.renderRemoteCursor(senderId, peer?.user, payload.cursorRange as { index: number; length: number }, payload.cursorCoords as CursorCoordinates);
          this.emit('remoteCursor', { peerId: senderId, user: peer?.user, cursorRange: payload.cursorRange, cursorCoords: payload.cursorCoords });
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
        this.presence.updateSelection(senderId, payload.range as { index: number; length: number });
        this.emit('remoteSelection', { peerId: senderId, user: senderUser, range: payload.range, bounds: payload.bounds });
        break;
      }

      case MESSAGE_TYPES.PERMISSION_REQ: {
        const requestingUser = (payload.user as UserProfile) || senderUser;
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
          this.broadcastPresence();
        } else {
          this.presence.updateRole(String(payload.targetUserId), String(payload.newRole));
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

  cleanupStalePeers(): void {
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

  renderRemoteCursor(
    peerId: string,
    user: Partial<UserProfile> = {},
    range: { index: number; length: number } | null = null,
    coords: CursorCoordinates | null = null,
    quillInstance: { getBounds?: (index: number) => { top: number; left: number } | null } | null = null
  ): void {
    if (typeof document === 'undefined') return;

    const quill = quillInstance || ((typeof window !== 'undefined' && 'quill' in window) ? (window as unknown as { quill: { getBounds?: (index: number) => { top: number; left: number } | null } }).quill : null);
    let top = coords?.top;
    let left = coords?.left;

    if ((top === undefined || left === undefined) && quill && range && typeof quill.getBounds === 'function') {
      try {
        const bounds = quill.getBounds(range.index);
        if (bounds) {
          top = bounds.top;
          left = bounds.left;
        }
      } catch (_e) {}
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

  removeRemoteCursor(peerId: string): void {
    const el = this.remoteCursors.get(peerId);
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
    this.remoteCursors.delete(peerId);
  }

  clearAllRemoteCursors(): void {
    for (const [, el] of this.remoteCursors.entries()) {
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }
    this.remoteCursors.clear();
  }

  setRole(newRole: unknown): void {
    this.currentRole = normalizeRole(newRole, this.currentRole);
    this.permissions.setRole(this.currentRole);
  }

  setUser(user: Partial<UserProfile> = {}): void {
    this.currentUser = { ...this.currentUser, ...user };
    this.permissions.userId = this.currentUser.id;
    this.broadcastPresence();
  }

  canEdit(): boolean { return this.permissions.canEdit(); }
  canComment(): boolean { return this.permissions.canComment(); }
  canShare(): boolean { return this.permissions.canShare(); }
  canDelete(): boolean { return this.permissions.canDelete(); }
  canManagePermissions(): boolean { return this.permissions.canManagePermissions(); }
  getPermissions() { return this.permissions.getPermissions(); }

  getPeers(): PeerState[] {
    return this.presence.getAllPeers();
  }
}
