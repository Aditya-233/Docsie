/**
 * Permissions manager, role definitions, and access control matrix
 * for Google Docs document sharing and collaboration.
 */

import type { UserRole, UserProfile } from '../types/index.ts';

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

export interface RolePermissions {
  role: UserRole;
  canEdit: boolean;
  canComment: boolean;
  canShare: boolean;
  canDelete: boolean;
  canManagePermissions: boolean;
  canExport: boolean;
  canView: boolean;
}

export interface ElevationRequest {
  id: string;
  userId: string;
  user: UserProfile | { id: string; name?: string; color?: string; email?: string };
  currentRole: UserRole;
  requestedRole: UserRole;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: number;
  respondedAt: number | null;
  respondedBy: string | null;
  rejectionReason?: string;
}

/**
 * Normalize role string to lowercase standard role.
 */
export function normalizeRole(role: unknown, defaultRole: UserRole = ROLES.VIEWER): UserRole {
  if (!role || typeof role !== 'string') return defaultRole;
  const lower = role.trim().toLowerCase() as UserRole;
  return Object.values(ROLES).includes(lower) ? lower : defaultRole;
}

/**
 * Check if a role string is a recognized valid role.
 */
export function isValidRole(role: unknown): boolean {
  if (!role || typeof role !== 'string') return false;
  return Object.values(ROLES).includes(role.trim().toLowerCase() as UserRole);
}

/**
 * Get numeric rank of a role for comparison.
 */
export function getRoleRank(role: unknown): number {
  const norm = normalizeRole(role, ROLES.VIEWER);
  return ROLE_RANKS[norm] || 0;
}

/**
 * Access Control Matrix static check functions.
 */
export const AccessControl = Object.freeze({
  canEdit(role: unknown): boolean {
    const norm = normalizeRole(role);
    return norm === ROLES.OWNER || norm === ROLES.EDITOR;
  },

  canComment(role: unknown): boolean {
    const norm = normalizeRole(role);
    return norm === ROLES.OWNER || norm === ROLES.EDITOR || norm === ROLES.COMMENTER;
  },

  canShare(role: unknown): boolean {
    const norm = normalizeRole(role);
    return norm === ROLES.OWNER || norm === ROLES.EDITOR;
  },

  canDelete(role: unknown): boolean {
    const norm = normalizeRole(role);
    return norm === ROLES.OWNER;
  },

  canManagePermissions(role: unknown): boolean {
    const norm = normalizeRole(role);
    return norm === ROLES.OWNER;
  },

  canExport(_role?: unknown): boolean {
    return true; // All roles with access can export
  },

  canView(_role?: unknown): boolean {
    return true; // All recognized roles can view
  },

  getPermissions(role: unknown): RolePermissions {
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
  public elevationRequests: Map<string, ElevationRequest>;
  public listeners: Map<string, Set<Function>>;

  constructor(initialRole: unknown = ROLES.VIEWER, userId: string | null = null) {
    this.currentRole = normalizeRole(initialRole, ROLES.VIEWER);
    this.userId = userId;
    this.elevationRequests = new Map();
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
      for (const cb of set) {
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

  setRole(newRole: unknown): UserRole {
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

  canEdit(role: unknown = this.currentRole): boolean {
    return AccessControl.canEdit(role);
  }

  canComment(role: unknown = this.currentRole): boolean {
    return AccessControl.canComment(role);
  }

  canShare(role: unknown = this.currentRole): boolean {
    return AccessControl.canShare(role);
  }

  canDelete(role: unknown = this.currentRole): boolean {
    return AccessControl.canDelete(role);
  }

  canManagePermissions(role: unknown = this.currentRole): boolean {
    return AccessControl.canManagePermissions(role);
  }

  canExport(role: unknown = this.currentRole): boolean {
    return AccessControl.canExport(role);
  }

  canView(role: unknown = this.currentRole): boolean {
    return AccessControl.canView(role);
  }

  getPermissions(role: unknown = this.currentRole): RolePermissions {
    return AccessControl.getPermissions(role);
  }

  requestRoleElevation({
    requestedRole = ROLES.EDITOR,
    reason = '',
    user = null
  }: {
    requestedRole?: unknown;
    reason?: string;
    user?: UserProfile | { id: string; name?: string; color?: string; email?: string } | null;
  } = {}): ElevationRequest {
    const targetRole = normalizeRole(requestedRole, ROLES.EDITOR);
    const requestingUser = user || { id: this.userId || 'anonymous' };
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const request: ElevationRequest = {
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

  approveRoleElevation(
    requestId: string,
    approverUser: UserProfile | { id: string } | string | null = null,
    approverRole: unknown = this.currentRole
  ): ElevationRequest {
    if (!this.canManagePermissions(approverRole) && !this.canEdit(approverRole)) {
      throw new Error('Unauthorized: Insufficient permissions to approve role elevation');
    }

    const request = this.elevationRequests.get(requestId);
    if (!request) {
      throw new Error(`Elevation request "${requestId}" not found`);
    }

    request.status = 'approved';
    request.respondedAt = Date.now();
    request.respondedBy = approverUser
      ? (typeof approverUser === 'object' ? approverUser.id : String(approverUser))
      : 'owner';

    if (request.userId === this.userId) {
      this.setRole(request.requestedRole);
    }

    this.emit('elevationApproved', request);
    return request;
  }

  rejectRoleElevation(
    requestId: string,
    approverUser: UserProfile | { id: string } | string | null = null,
    reason: string = ''
  ): ElevationRequest {
    const request = this.elevationRequests.get(requestId);
    if (!request) {
      throw new Error(`Elevation request "${requestId}" not found`);
    }

    request.status = 'rejected';
    request.rejectionReason = reason;
    request.respondedAt = Date.now();
    request.respondedBy = approverUser
      ? (typeof approverUser === 'object' ? approverUser.id : String(approverUser))
      : 'owner';

    this.emit('elevationRejected', request);
    return request;
  }

  getRequestById(requestId: string): ElevationRequest | null {
    return this.elevationRequests.get(requestId) || null;
  }

  getElevationRequests(status: string = 'all'): ElevationRequest[] {
    const all = Array.from(this.elevationRequests.values());
    if (status === 'all') return all;
    return all.filter(r => r.status === status);
  }
}
