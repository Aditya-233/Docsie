/**
 * Protocol definitions, packet structures, and validation for real-time collaboration.
 */

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

export interface CollabPacket {
  id: string;
  type: string;
  senderId: string;
  senderUser: any;
  senderRole: string;
  docId: string;
  payload: any;
  timestamp: number;
}

export function generateMessageId(): string {
  const rand = Math.random().toString(36).substring(2, 10);
  const ts = Date.now().toString(36);
  return `msg_${ts}_${rand}`;
}

export function validatePacket(packet: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!packet || typeof packet !== 'object') {
    return { valid: false, errors: ['Packet must be a non-null object'] };
  }

  if (!packet.type || typeof packet.type !== 'string') {
    errors.push('Missing or invalid packet type');
  } else if (!Object.values(MESSAGE_TYPES).includes(packet.type as any)) {
    errors.push(`Unknown message type: ${packet.type}`);
  }

  if (!packet.senderId || typeof packet.senderId !== 'string') {
    errors.push('Missing or invalid senderId');
  }

  if (packet.docId !== undefined && packet.docId !== null && typeof packet.docId !== 'string') {
    errors.push('docId must be a string if provided');
  }

  if (packet.timestamp !== undefined && (typeof packet.timestamp !== 'number' || isNaN(packet.timestamp))) {
    errors.push('timestamp must be a valid numeric timestamp');
  }

  if (packet.payload === undefined || packet.payload === null || typeof packet.payload !== 'object') {
    errors.push('Missing or invalid payload object');
  } else {
    switch (packet.type) {
      case MESSAGE_TYPES.DOC_DELTA:
        if (packet.payload.delta === undefined && packet.payload.fullHtml === undefined) {
          errors.push('DOC_DELTA payload must contain either "delta" or "fullHtml"');
        }
        break;

      case MESSAGE_TYPES.PRESENCE:
        if (!packet.payload.user || typeof packet.payload.user !== 'object') {
          errors.push('PRESENCE payload must contain a "user" object');
        }
        break;

      case MESSAGE_TYPES.SELECTION:
        if (packet.payload.range !== undefined && packet.payload.range !== null && typeof packet.payload.range !== 'object') {
          errors.push('SELECTION payload range must be an object if provided');
        }
        break;

      case MESSAGE_TYPES.PERMISSION_REQ:
        if (!packet.payload.user || typeof packet.payload.user !== 'object') {
          errors.push('PERMISSION_REQ payload must contain requesting "user" object');
        }
        break;

      case MESSAGE_TYPES.PERMISSION_GRANT:
        if (!packet.payload.targetUserId || typeof packet.payload.targetUserId !== 'string') {
          errors.push('PERMISSION_GRANT payload must contain "targetUserId" string');
        }
        break;

      case MESSAGE_TYPES.DOC_SYNC:
        if (!packet.payload.action || typeof packet.payload.action !== 'string') {
          errors.push('DOC_SYNC payload must contain "action" string (e.g. "request" | "response")');
        }
        break;

      case MESSAGE_TYPES.COMMENT_SYNC:
        if (!packet.payload.action || typeof packet.payload.action !== 'string') {
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

export function isValidPacket(packet: any): boolean {
  return validatePacket(packet).valid;
}

export function createPacket(type: string, senderUser: any = {}, senderRole: string = 'viewer', docId: string = 'default', payload: any = {}): CollabPacket {
  const senderId = senderUser?.id || (typeof senderUser === 'string' ? senderUser : 'anonymous');
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

export function createDocDeltaPacket(senderUser: any, senderRole: string, docId: string, { delta = null, fullHtml = null, version = null, baseVersion = null }: any = {}): CollabPacket {
  return createPacket(MESSAGE_TYPES.DOC_DELTA, senderUser, senderRole, docId, {
    delta,
    fullHtml,
    version,
    baseVersion
  });
}

export function createPresencePacket(senderUser: any, senderRole: string, docId: string, { cursorRange = null, cursorCoords = null, selection = undefined, status = 'active' }: any = {}): CollabPacket {
  const payload: any = {
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

export function createSelectionPacket(senderUser: any, senderRole: string, docId: string, { range = null, bounds = null }: any = {}): CollabPacket {
  return createPacket(MESSAGE_TYPES.SELECTION, senderUser, senderRole, docId, {
    range,
    bounds
  });
}

export function createPermissionReqPacket(senderUser: any, senderRole: string, docId: string, { requestedRole = 'editor', reason = '' }: any = {}): CollabPacket {
  return createPacket(MESSAGE_TYPES.PERMISSION_REQ, senderUser, senderRole, docId, {
    user: senderUser,
    requestedRole,
    reason
  });
}

export function createPermissionGrantPacket(senderUser: any, senderRole: string, docId: string, { targetUserId, newRole = 'editor', grantedBy = null }: any = {}): CollabPacket {
  return createPacket(MESSAGE_TYPES.PERMISSION_GRANT, senderUser, senderRole, docId, {
    targetUserId,
    newRole,
    grantedBy: grantedBy || senderUser?.id
  });
}

export function createDocSyncPacket(senderUser: any, senderRole: string, docId: string, { action = 'request', doc = null, version = 1 }: any = {}): CollabPacket {
  return createPacket(MESSAGE_TYPES.DOC_SYNC, senderUser, senderRole, docId, {
    action,
    doc,
    version
  });
}

export function createCommentSyncPacket(senderUser: any, senderRole: string, docId: string, { action = 'create', comment = null, commentId = null, reply = null }: any = {}): CollabPacket {
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
