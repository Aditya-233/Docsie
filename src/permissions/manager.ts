/**
 * Permissions manager, role definitions, and access control matrix
 * for Google Docs document sharing and collaboration.
 */

import type { UserRole } from '../types/index.ts';

export const ROLES: {
  readonly OWNER: UserRole;
  readonly EDITOR: UserRole;
  readonly COMMENTER: UserRole;
  readonly VIEWER: UserRole;
} = Object.freeze({
  OWNER: 'owner',
  EDITOR: 'editor',
  COMMENTER: 'commenter',
  VIEWER: 'viewer'
});

export const ROLE_RANKS: Readonly<Record<UserRole, number>> = Object.freeze({
  owner: 40,
  editor: 30,
  commenter: 20,
  viewer: 10
});

/**
 * Normalize role string to lowercase standard role.
 */
export function normalizeRole(role: any, defaultRole: UserRole = ROLES.VIEWER): UserRole {
  if (!role || typeof role !== 'string') return defaultRole;
  const lower = role.trim().toLowerCase() as UserRole;
  return Object.values(ROLES).includes(lower) ? lower : defaultRole;
}

/**
 * Check if a role string is a recognized valid role.
 */
export function isValidRole(role: any): boolean {
  if (!role || typeof role !== 'string') return false;
  return Object.values(ROLES).includes(role.trim().toLowerCase() as UserRole);
}

/**
 * Get numeric rank of a role for comparison.
 */
export function getRoleRank(role: any): number {
  const norm = normalizeRole(role, ROLES.VIEWER);
  return ROLE_RANKS[norm] || 0;
}

/**
 * Access Control Matrix static check functions.
 */
export const AccessControl = Object.freeze({
  canEdit(role: any): boolean {
    const norm = normalizeRole(role);
    return norm === ROLES.OWNER || norm === ROLES.EDITOR;
  },

  canComment(role: any): boolean {
    const norm = normalizeRole(role);
    return norm === ROLES.OWNER || norm === ROLES.EDITOR || norm === ROLES.COMMENTER;
  },

  canShare(role: any): boolean {
    const norm = normalizeRole(role);
    return norm === ROLES.OWNER || norm === ROLES.EDITOR;
  },

  canDelete(role: any): boolean {
    const norm = normalizeRole(role);
    return norm === ROLES.OWNER;
  },

  canManagePermissions(role: any): boolean {
    const norm = normalizeRole(role);
    return norm === ROLES.OWNER;
  },

  canExport(_role?: any): boolean {
    return true; // All roles with access can export
  },

  canView(_role?: any): boolean {
    return true; // All recognized roles can view
  },

  getPermissions(role: any) {
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
  public currentRole: UserRole;
  public userId: string | null;
  public elevationRequests: Map<string, any>;
  public listeners: Map<string, Set<Function>>;

  constructor(initialRole: any = ROLES.VIEWER, userId: string | null = null) {
    this.currentRole = normalizeRole(initialRole, ROLES.VIEWER);
    this.userId = userId;
    this.elevationRequests = new Map();
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
      for (const cb of this.listeners.get(event)!) {
        try {
          cb(...args);
        } catch (err) {
          console.error(`Error in PermissionManager listener for "${event}":`, err);
        }
      }
    }
  }

  getRole(): UserRole {
    return this.currentRole;
  }

  setRole(newRole: any): UserRole {
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

  canEdit(role: any = this.currentRole): boolean {
    return AccessControl.canEdit(role);
  }

  canComment(role: any = this.currentRole): boolean {
    return AccessControl.canComment(role);
  }

  canShare(role: any = this.currentRole): boolean {
    return AccessControl.canShare(role);
  }

  canDelete(role: any = this.currentRole): boolean {
    return AccessControl.canDelete(role);
  }

  canManagePermissions(role: any = this.currentRole): boolean {
    return AccessControl.canManagePermissions(role);
  }

  canExport(role: any = this.currentRole): boolean {
    return AccessControl.canExport(role);
  }

  canView(role: any = this.currentRole): boolean {
    return AccessControl.canView(role);
  }

  getPermissions(role: any = this.currentRole) {
    return AccessControl.getPermissions(role);
  }

  requestRoleElevation({ requestedRole = ROLES.EDITOR, reason = '', user = null }: { requestedRole?: any; reason?: string; user?: any } = {}) {
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

  approveRoleElevation(requestId: string, approverUser: any = null, approverRole: any = this.currentRole) {
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

    if (request.userId === this.userId) {
      this.setRole(request.requestedRole);
    }

    this.emit('elevationApproved', request);
    return request;
  }

  rejectRoleElevation(requestId: string, approverUser: any = null, reason: string = '') {
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

  getRequestById(requestId: string) {
    return this.elevationRequests.get(requestId) || null;
  }

  getElevationRequests(status: string = 'all') {
    const all = Array.from(this.elevationRequests.values());
    if (status === 'all') return all;
    return all.filter(r => r.status === status);
  }
}
