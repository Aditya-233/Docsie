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
});

/**
 * Generate a unique message identifier.
 * @returns {string} Unique message id.
 */
export function generateMessageId() {
  const rand = Math.random().toString(36).substring(2, 10);
  const ts = Date.now().toString(36);
  return `msg_${ts}_${rand}`;
}

/**
 * Validate a collaboration packet against protocol specifications.
 * @param {any} packet - Packet object to validate.
 * @returns {{ valid: boolean, errors: string[] }} Validation result.
 */
export function validatePacket(packet) {
  const errors = [];

  if (!packet || typeof packet !== 'object') {
    return { valid: false, errors: ['Packet must be a non-null object'] };
  }

  if (!packet.type || typeof packet.type !== 'string') {
    errors.push('Missing or invalid packet type');
  } else if (!Object.values(MESSAGE_TYPES).includes(packet.type)) {
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
    // Specific payload validation per message type
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

/**
 * Check whether a packet is valid.
 * @param {any} packet - Packet object to check.
 * @returns {boolean} True if packet is valid.
 */
export function isValidPacket(packet) {
  return validatePacket(packet).valid;
}

/**
 * Base packet builder helper.
 * @param {string} type - Message type from MESSAGE_TYPES.
 * @param {object} senderUser - Sender user profile { id, name, color, ... }.
 * @param {string} senderRole - Sender role ('owner', 'editor', 'commenter', 'viewer').
 * @param {string} docId - Target document ID.
 * @param {object} payload - Message payload.
 * @returns {object} Well-formed collaboration packet.
 */
export function createPacket(type, senderUser = {}, senderRole = 'viewer', docId = 'default', payload = {}) {
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

/**
 * Factory helper for DOC_DELTA packets.
 */
export function createDocDeltaPacket(senderUser, senderRole, docId, { delta = null, fullHtml = null, version = null, baseVersion = null } = {}) {
  return createPacket(MESSAGE_TYPES.DOC_DELTA, senderUser, senderRole, docId, {
    delta,
    fullHtml,
    version,
    baseVersion
  });
}

/**
 * Factory helper for PRESENCE packets.
 */
export function createPresencePacket(senderUser, senderRole, docId, { cursorRange = null, cursorCoords = null, selection = undefined, status = 'active' } = {}) {
  const payload = {
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

/**
 * Factory helper for SELECTION packets.
 */
export function createSelectionPacket(senderUser, senderRole, docId, { range = null, bounds = null } = {}) {
  return createPacket(MESSAGE_TYPES.SELECTION, senderUser, senderRole, docId, {
    range,
    bounds
  });
}

/**
 * Factory helper for PERMISSION_REQ packets.
 */
export function createPermissionReqPacket(senderUser, senderRole, docId, { requestedRole = 'editor', reason = '' } = {}) {
  return createPacket(MESSAGE_TYPES.PERMISSION_REQ, senderUser, senderRole, docId, {
    user: senderUser,
    requestedRole,
    reason
  });
}

/**
 * Factory helper for PERMISSION_GRANT packets.
 */
export function createPermissionGrantPacket(senderUser, senderRole, docId, { targetUserId, newRole = 'editor', grantedBy = null } = {}) {
  return createPacket(MESSAGE_TYPES.PERMISSION_GRANT, senderUser, senderRole, docId, {
    targetUserId,
    newRole,
    grantedBy: grantedBy || senderUser?.id
  });
}

/**
 * Factory helper for DOC_SYNC packets.
 */
export function createDocSyncPacket(senderUser, senderRole, docId, { action = 'request', doc = null, version = 1 } = {}) {
  return createPacket(MESSAGE_TYPES.DOC_SYNC, senderUser, senderRole, docId, {
    action,
    doc,
    version
  });
}

/**
 * Factory helper for COMMENT_SYNC packets.
 */
export function createCommentSyncPacket(senderUser, senderRole, docId, { action = 'create', comment = null, commentId = null, reply = null } = {}) {
  return createPacket(MESSAGE_TYPES.COMMENT_SYNC, senderUser, senderRole, docId, {
    action,
    comment,
    commentId,
    reply
  });
}

/**
 * Protocol helper class providing unified access to constants, validation, and factories.
 */
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
