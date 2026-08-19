/**
 * Protocol definitions, packet structures, and validation for real-time collaboration.
 */

import type { UserProfile, UserRole } from '../types/index.ts';

export const MESSAGE_TYPES = Object.freeze({
  DOC_DELTA: 'DOC_DELTA',
  PRESENCE: 'PRESENCE',
  SELECTION: 'SELECTION',
  PERMISSION_REQ: 'PERMISSION_REQ',
  PERMISSION_GRANT: 'PERMISSION_GRANT',
  DOC_SYNC: 'DOC_SYNC',
  COMMENT_SYNC: 'COMMENT_SYNC'
} as const);

export type MessageType = typeof MESSAGE_TYPES[keyof typeof MESSAGE_TYPES];

export interface CollabPacket<T = Record<string, unknown>> {
  id: string;
  type: string;
  senderId: string;
  senderUser: UserProfile | { id: string; name?: string; color?: string; email?: string };
  senderRole: string;
  docId: string;
  payload: T;
  timestamp: number;
}

export function generateMessageId(): string {
  const rand = Math.random().toString(36).substring(2, 10);
  const ts = Date.now().toString(36);
  return `msg_${ts}_${rand}`;
}

export function validatePacket(packet: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!packet || typeof packet !== 'object') {
    return { valid: false, errors: ['Packet must be a non-null object'] };
  }

  const p = packet as Partial<CollabPacket<Record<string, unknown>>>;

  if (!p.type || typeof p.type !== 'string') {
    errors.push('Missing or invalid packet type');
  } else if (!Object.values(MESSAGE_TYPES).includes(p.type as MessageType)) {
    errors.push(`Unknown message type: ${p.type}`);
  }

  if (!p.senderId || typeof p.senderId !== 'string') {
    errors.push('Missing or invalid senderId');
  }

  if (p.docId !== undefined && p.docId !== null && typeof p.docId !== 'string') {
    errors.push('docId must be a string if provided');
  }

  if (p.timestamp !== undefined && (typeof p.timestamp !== 'number' || isNaN(p.timestamp))) {
    errors.push('timestamp must be a valid numeric timestamp');
  }

  if (p.payload === undefined || p.payload === null || typeof p.payload !== 'object') {
    errors.push('Missing or invalid payload object');
  } else {
    const payload = p.payload as Record<string, unknown>;
    switch (p.type) {
      case MESSAGE_TYPES.DOC_DELTA:
        if (payload.delta === undefined && payload.fullHtml === undefined) {
          errors.push('DOC_DELTA payload must contain either "delta" or "fullHtml"');
        }
        break;

      case MESSAGE_TYPES.PRESENCE:
        if (!payload.user || typeof payload.user !== 'object') {
          errors.push('PRESENCE payload must contain a "user" object');
        }
        break;

      case MESSAGE_TYPES.SELECTION:
        if (payload.range !== undefined && payload.range !== null && typeof payload.range !== 'object') {
          errors.push('SELECTION payload range must be an object if provided');
        }
        break;

      case MESSAGE_TYPES.PERMISSION_REQ:
        if (!payload.user || typeof payload.user !== 'object') {
          errors.push('PERMISSION_REQ payload must contain requesting "user" object');
        }
        break;

      case MESSAGE_TYPES.PERMISSION_GRANT:
        if (!payload.targetUserId || typeof payload.targetUserId !== 'string') {
          errors.push('PERMISSION_GRANT payload must contain "targetUserId" string');
        }
        break;

      case MESSAGE_TYPES.DOC_SYNC:
        if (!payload.action || typeof payload.action !== 'string') {
          errors.push('DOC_SYNC payload must contain "action" string (e.g. "request" | "response")');
        }
        break;

      case MESSAGE_TYPES.COMMENT_SYNC:
        if (!payload.action || typeof payload.action !== 'string') {
          errors.push('COMMENT_SYNC payload must contain "action" string');
        }
        break;
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function isValidPacket(packet: unknown): boolean {
  return validatePacket(packet).valid;
}

export function createPacket<T = Record<string, unknown>>(
  type: string,
  senderUser: UserProfile | { id: string; name?: string; color?: string; email?: string } | string = 'anonymous',
  senderRole: string = 'viewer',
  docId: string = 'default',
  payload: T = {} as T
): CollabPacket<T> {
  const senderId = typeof senderUser === 'object' && senderUser !== null ? senderUser.id : (typeof senderUser === 'string' ? senderUser : 'anonymous');
  return {
    id: generateMessageId(),
    type,
    senderId,
    senderUser: typeof senderUser === 'object' && senderUser !== null ? senderUser : { id: senderId },
    senderRole,
    docId,
    payload,
    timestamp: Date.now()
  };
}

export function createDocDeltaPacket(
  senderUser: UserProfile | { id: string } | string,
  senderRole: string,
  docId: string,
  { delta = null, fullHtml = null, version = null, baseVersion = null }: { delta?: unknown; fullHtml?: string | null; version?: number | null; baseVersion?: number | null } = {}
): CollabPacket {
  return createPacket(MESSAGE_TYPES.DOC_DELTA, senderUser, senderRole, docId, {
    delta,
    fullHtml,
    version,
    baseVersion
  });
}

export function createPresencePacket(
  senderUser: UserProfile | { id: string } | string,
  senderRole: string,
  docId: string,
  { cursorRange = null, cursorCoords = null, selection = undefined, status = 'active' }: { cursorRange?: unknown; cursorCoords?: unknown; selection?: unknown; status?: string } = {}
): CollabPacket {
  const payload: Record<string, unknown> = {
    user: senderUser,
    role: senderRole,
    cursorRange,
    cursorCoords,
    status
  };
  if (selection !== undefined) {
    payload.selection = selection;
  }
  return createPacket(MESSAGE_TYPES.PRESENCE, senderUser, senderRole, docId, payload);
}

export function createSelectionPacket(
  senderUser: UserProfile | { id: string } | string,
  senderRole: string,
  docId: string,
  { range = null, bounds = null }: { range?: unknown; bounds?: unknown } = {}
): CollabPacket {
  return createPacket(MESSAGE_TYPES.SELECTION, senderUser, senderRole, docId, {
    range,
    bounds
  });
}

export function createPermissionReqPacket(
  senderUser: UserProfile | { id: string } | string,
  senderRole: string,
  docId: string,
  { requestedRole = 'editor', reason = '' }: { requestedRole?: UserRole | string; reason?: string } = {}
): CollabPacket {
  return createPacket(MESSAGE_TYPES.PERMISSION_REQ, senderUser, senderRole, docId, {
    user: senderUser,
    requestedRole,
    reason
  });
}

export function createPermissionGrantPacket(
  senderUser: UserProfile | { id: string } | string,
  senderRole: string,
  docId: string,
  { targetUserId, newRole = 'editor', grantedBy = null }: { targetUserId: string; newRole?: UserRole | string; grantedBy?: string | null } = { targetUserId: '' }
): CollabPacket {
  const senderId = typeof senderUser === 'object' && senderUser !== null ? senderUser.id : String(senderUser);
  return createPacket(MESSAGE_TYPES.PERMISSION_GRANT, senderUser, senderRole, docId, {
    targetUserId,
    newRole,
    grantedBy: grantedBy || senderId
  });
}

export function createDocSyncPacket(
  senderUser: UserProfile | { id: string } | string,
  senderRole: string,
  docId: string,
  { action = 'request', doc = null, version = 1 }: { action?: string; doc?: unknown; version?: number } = {}
): CollabPacket {
  return createPacket(MESSAGE_TYPES.DOC_SYNC, senderUser, senderRole, docId, {
    action,
    doc,
    version
  });
}

export function createCommentSyncPacket(
  senderUser: UserProfile | { id: string } | string,
  senderRole: string,
  docId: string,
  { action = 'create', comment = null, commentId = null, reply = null }: { action?: string; comment?: unknown; commentId?: string | null; reply?: unknown } = {}
): CollabPacket {
  return createPacket(MESSAGE_TYPES.COMMENT_SYNC, senderUser, senderRole, docId, {
    action,
    comment,
    commentId,
    reply
  });
}

export class CollaborationProtocol {
  static MESSAGE_TYPES = MESSAGE_TYPES;
  static generateMessageId = generateMessageId;
  static validatePacket = validatePacket;
  static isValidPacket = isValidPacket;
  static createPacket = createPacket;
  static createDocDeltaPacket = createDocDeltaPacket;
  static createPresencePacket = createPresencePacket;
  static createSelectionPacket = createSelectionPacket;
  static createPermissionReqPacket = createPermissionReqPacket;
  static createPermissionGrantPacket = createPermissionGrantPacket;
  static createDocSyncPacket = createDocSyncPacket;
  static createCommentSyncPacket = createCommentSyncPacket;
}
