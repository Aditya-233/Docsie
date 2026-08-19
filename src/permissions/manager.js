/**
 * Permissions manager, role definitions, and access control matrix
 * for Google Docs document sharing and collaboration.
 */

export const ROLES = Object.freeze({
  OWNER: 'owner',
  EDITOR: 'editor',
  COMMENTER: 'commenter',
  VIEWER: 'viewer'
});

export const ROLE_RANKS = Object.freeze({
  [ROLES.OWNER]: 40,
  [ROLES.EDITOR]: 30,
  [ROLES.COMMENTER]: 20,
  [ROLES.VIEWER]: 10
});

/**
 * Normalize role string to lowercase standard role.
 * @param {string} role - Raw role string
 * @param {string} defaultRole - Fallback role if invalid
 * @returns {string} Normalized role
 */
export function normalizeRole(role, defaultRole = ROLES.VIEWER) {
  if (!role || typeof role !== 'string') return defaultRole;
  const lower = role.trim().toLowerCase();
  return Object.values(ROLES).includes(lower) ? lower : defaultRole;
}

/**
 * Check if a role string is a recognized valid role.
 * @param {string} role - Role to check
 * @returns {boolean} True if valid
 */
export function isValidRole(role) {
  if (!role || typeof role !== 'string') return false;
  return Object.values(ROLES).includes(role.trim().toLowerCase());
}

/**
 * Get numeric rank of a role for comparison.
 * @param {string} role - Role name
 * @returns {number} Rank (higher means more privileged)
 */
export function getRoleRank(role) {
  const norm = normalizeRole(role, ROLES.VIEWER);
  return ROLE_RANKS[norm] || 0;
}

/**
 * Access Control Matrix static check functions.
 */
export const AccessControl = Object.freeze({
  canEdit(role) {
    const norm = normalizeRole(role);
    return norm === ROLES.OWNER || norm === ROLES.EDITOR;
  },

  canComment(role) {
    const norm = normalizeRole(role);
    return norm === ROLES.OWNER || norm === ROLES.EDITOR || norm === ROLES.COMMENTER;
  },

  canShare(role) {
    const norm = normalizeRole(role);
    return norm === ROLES.OWNER || norm === ROLES.EDITOR;
  },

  canDelete(role) {
    const norm = normalizeRole(role);
    return norm === ROLES.OWNER;
  },

  canManagePermissions(role) {
    const norm = normalizeRole(role);
    return norm === ROLES.OWNER;
  },

  canExport(role) {
    return true; // All roles with access can export
  },

  canView(role) {
    return true; // All recognized roles can view
  },

  getPermissions(role) {
    const norm = normalizeRole(role);
    return {
      role: norm,
      canEdit: AccessControl.canEdit(norm),
      canComment: AccessControl.canComment(norm),
      canShare: AccessControl.canShare(norm),
      canDelete: AccessControl.canDelete(norm),
      canManagePermissions: AccessControl.canManagePermissions(norm),
      canExport: AccessControl.canExport(norm),
      canView: AccessControl.canView(norm)
    };
  }
});

/**
 * Dynamic Permission and Role Elevation Manager.
 */
export class PermissionManager {
  constructor(initialRole = ROLES.VIEWER, userId = null) {
    this.currentRole = normalizeRole(initialRole, ROLES.VIEWER);
    this.userId = userId;
    this.elevationRequests = new Map(); // requestId -> RequestObject
    this.listeners = new Map();
  }

  /**
   * Add event listener.
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
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
   * Remove event listener.
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  /**
   * Emit event to listeners.
   * @param {string} event - Event name
   * @param {...any} args - Arguments
   */
  emit(event, ...args) {
    if (this.listeners.has(event)) {
      for (const cb of this.listeners.get(event)) {
        try {
          cb(...args);
        } catch (err) {
          console.error(`Error in PermissionManager listener for "${event}":`, err);
        }
      }
    }
  }

  /**
   * Get current active role.
   * @returns {string} Current role
   */
  getRole() {
    return this.currentRole;
  }

  /**
   * Update active role.
   * @param {string} newRole - New role
   * @returns {string} Updated role
   */
  setRole(newRole) {
    const prevRole = this.currentRole;
    this.currentRole = normalizeRole(newRole, prevRole);
    if (prevRole !== this.currentRole) {
      this.emit('roleChanged', {
        previousRole: prevRole,
        currentRole: this.currentRole,
        permissions: this.getPermissions()
      });
    }
    return this.currentRole;
  }

  /**
   * Check if current user or specified role can edit.
   * @param {string} [role] - Optional role to check
   * @returns {boolean}
   */
  canEdit(role = this.currentRole) {
    return AccessControl.canEdit(role);
  }

  /**
   * Check if current user or specified role can comment.
   * @param {string} [role] - Optional role to check
   * @returns {boolean}
   */
  canComment(role = this.currentRole) {
    return AccessControl.canComment(role);
  }

  /**
   * Check if current user or specified role can share.
   * @param {string} [role] - Optional role to check
   * @returns {boolean}
   */
  canShare(role = this.currentRole) {
    return AccessControl.canShare(role);
  }

  /**
   * Check if current user or specified role can delete.
   * @param {string} [role] - Optional role to check
   * @returns {boolean}
   */
  canDelete(role = this.currentRole) {
    return AccessControl.canDelete(role);
  }

  /**
   * Check if current user or specified role can manage permissions.
   * @param {string} [role] - Optional role to check
   * @returns {boolean}
   */
  canManagePermissions(role = this.currentRole) {
    return AccessControl.canManagePermissions(role);
  }

  /**
   * Check if current user or specified role can export.
   * @param {string} [role] - Optional role to check
   * @returns {boolean}
   */
  canExport(role = this.currentRole) {
    return AccessControl.canExport(role);
  }

  /**
   * Check if current user or specified role can view.
   * @param {string} [role] - Optional role to check
   * @returns {boolean}
   */
  canView(role = this.currentRole) {
    return AccessControl.canView(role);
  }

  /**
   * Get all permission flags for current or given role.
   * @param {string} [role] - Optional role
   * @returns {object} Permission flags
   */
  getPermissions(role = this.currentRole) {
    return AccessControl.getPermissions(role);
  }

  /**
   * Request dynamic role elevation (e.g. Viewer requesting Editor).
   * @param {object} params - Request parameters
   * @returns {object} Created elevation request object
   */
  requestRoleElevation({ requestedRole = ROLES.EDITOR, reason = '', user = null } = {}) {
    const targetRole = normalizeRole(requestedRole, ROLES.EDITOR);
    const requestingUser = user || { id: this.userId || 'anonymous' };
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const request = {
      id: requestId,
      userId: requestingUser.id,
      user: requestingUser,
      currentRole: this.currentRole,
      requestedRole: targetRole,
      reason,
      status: 'pending',
      timestamp: Date.now(),
      respondedAt: null,
      respondedBy: null
    };

    this.elevationRequests.set(requestId, request);
    this.emit('elevationRequested', request);
    return request;
  }

  /**
   * Approve a role elevation request.
   * @param {string} requestId - Request ID to approve
   * @param {object} [approverUser] - User approving the request
   * @param {string} [approverRole] - Role of the approver
   * @returns {object} Approved request object
   */
  approveRoleElevation(requestId, approverUser = null, approverRole = this.currentRole) {
    if (!this.canManagePermissions(approverRole) && !this.canEdit(approverRole)) {
      throw new Error('Unauthorized: Insufficient permissions to approve role elevation');
    }

    const request = this.elevationRequests.get(requestId);
    if (!request) {
      throw new Error(`Elevation request "${requestId}" not found`);
    }

    request.status = 'approved';
    request.respondedAt = Date.now();
    request.respondedBy = approverUser ? (approverUser.id || approverUser) : 'owner';

    // If local user is the requester, elevate role immediately
    if (request.userId === this.userId) {
      this.setRole(request.requestedRole);
    }

    this.emit('elevationApproved', request);
    return request;
  }

  /**
   * Reject a role elevation request.
   * @param {string} requestId - Request ID to reject
   * @param {object} [approverUser] - User rejecting the request
   * @param {string} [reason] - Rejection reason
   * @returns {object} Rejected request object
   */
  rejectRoleElevation(requestId, approverUser = null, reason = '') {
    const request = this.elevationRequests.get(requestId);
    if (!request) {
      throw new Error(`Elevation request "${requestId}" not found`);
    }

    request.status = 'rejected';
    request.rejectionReason = reason;
    request.respondedAt = Date.now();
    request.respondedBy = approverUser ? (approverUser.id || approverUser) : 'owner';

    this.emit('elevationRejected', request);
    return request;
  }

  /**
   * Get elevation request by ID.
   * @param {string} requestId - Request ID
   * @returns {object|null}
   */
  getRequestById(requestId) {
    return this.elevationRequests.get(requestId) || null;
  }

  /**
   * Get list of elevation requests.
   * @param {string} [status='all'] - Filter by status ('all', 'pending', 'approved', 'rejected')
   * @returns {object[]} Filtered requests
   */
  getElevationRequests(status = 'all') {
    const all = Array.from(this.elevationRequests.values());
    if (status === 'all') return all;
    return all.filter(r => r.status === status);
  }
}
