/**
 * Share URL generation, parsing, and granular collaborator list management.
 */

import { ROLES, normalizeRole } from './manager.ts';
import type { UserRole } from '../types/index.ts';

export interface GenerateShareUrlOptions {
  baseUrl?: string;
  docId?: string;
  role?: UserRole | string;
  user?: string;
  userName?: string;
  format?: 'hash' | 'query';
}

export function generateShareUrl(options: GenerateShareUrlOptions = {}): string {
  const {
    docId = 'doc_master',
    role = ROLES.VIEWER,
    user,
    userName,
    format = 'hash'
  } = options;

  let baseUrl = options.baseUrl;
  if (!baseUrl) {
    if (typeof window !== 'undefined' && window.location) {
      baseUrl = window.location.origin + window.location.pathname;
    } else {
      baseUrl = '';
    }
  }

  const normRole = normalizeRole(role, ROLES.VIEWER);
  const name = userName || user || '';

  const params = new URLSearchParams();
  params.set('doc', docId);
  params.set('role', normRole);
  if (name) {
    params.set('user', name);
  }

  const paramString = params.toString();

  if (format === 'query') {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}${paramString}`;
  } else {
    return `${baseUrl}#${paramString}`;
  }
}

export interface ParsedShareUrl {
  docId: string | null;
  role: UserRole;
  user: string | null;
  rawParams: Record<string, string>;
}

export function parseShareUrl(urlOrString: string = ''): ParsedShareUrl {
  const rawParams: Record<string, string> = {};
  if (!urlOrString || typeof urlOrString !== 'string') {
    return { docId: null, role: ROLES.VIEWER, user: null, rawParams };
  }

  let searchParams: URLSearchParams | null = null;

  try {
    if (urlOrString.startsWith('http://') || urlOrString.startsWith('https://')) {
      const url = new URL(urlOrString);
      if (url.hash && url.hash.length > 1) {
        searchParams = new URLSearchParams(url.hash.replace(/^#/, ''));
      } else if (url.search && url.search.length > 1) {
        searchParams = new URLSearchParams(url.search.replace(/^\?/, ''));
      }
    }
  } catch (_e) {
    // Fall back to direct regex/string parsing
  }

  if (!searchParams) {
    let clean = urlOrString;
    if (clean.includes('#')) {
      clean = clean.split('#')[1];
    } else if (clean.includes('?')) {
      clean = clean.split('?')[1];
    }
    searchParams = new URLSearchParams(clean);
  }

  for (const [key, val] of searchParams.entries()) {
    rawParams[key] = val;
  }

  const docId = searchParams.get('doc') || searchParams.get('docId') || null;
  const rawRole = searchParams.get('role');
  const role = rawRole ? normalizeRole(rawRole, ROLES.VIEWER) : ROLES.VIEWER;
  const user = searchParams.get('user') || searchParams.get('userName') || null;

  return {
    docId,
    role,
    user,
    rawParams
  };
}

export class CollaboratorListManager {
  private collaborators: Map<string, any>;
  private listeners: Map<string, Set<Function>>;

  constructor(initialCollaborators: any[] = []) {
    this.collaborators = new Map();
    this.listeners = new Map();
    if (Array.isArray(initialCollaborators)) {
      this.loadFromJSON(initialCollaborators);
    }
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
        } catch (e) {
          console.error(`Error in CollaboratorListManager listener for "${event}":`, e);
        }
      }
    }
  }

  addCollaborator(data: any = {}) {
    const id = data.id || `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const role = normalizeRole(data.role, ROLES.VIEWER);
    const isNew = !this.collaborators.has(id);
    const existing = this.collaborators.get(id) || {};

    const collaborator = {
      id,
      name: data.name || existing.name || 'Anonymous Collaborator',
      email: data.email || existing.email || '',
      role,
      avatar: data.avatar || existing.avatar || null,
      addedAt: existing.addedAt || Date.now(),
      updatedAt: Date.now()
    };

    this.collaborators.set(id, collaborator);

    if (isNew) {
      this.emit('add', collaborator);
    } else {
      this.emit('update', collaborator);
    }
    this.emit('change', this.getAllCollaborators());

    return collaborator;
  }

  updateRole(userId: string, newRole: any) {
    if (!this.collaborators.has(userId)) {
      return null;
    }
    const collaborator = this.collaborators.get(userId);
    collaborator.role = normalizeRole(newRole, collaborator.role);
    collaborator.updatedAt = Date.now();

    this.emit('update', collaborator);
    this.emit('change', this.getAllCollaborators());
    return collaborator;
  }

  removeCollaborator(userId: string): boolean {
    if (this.collaborators.has(userId)) {
      const removed = this.collaborators.get(userId);
      this.collaborators.delete(userId);
      this.emit('remove', removed);
      this.emit('change', this.getAllCollaborators());
      return true;
    }
    return false;
  }

  getCollaborator(userId: string) {
    return this.collaborators.get(userId) || null;
  }

  hasCollaborator(userId: string): boolean {
    return this.collaborators.has(userId);
  }

  getAllCollaborators(): any[] {
    return Array.from(this.collaborators.values());
  }

  getByRole(role: any): any[] {
    const norm = normalizeRole(role);
    return this.getAllCollaborators().filter(c => c.role === norm);
  }

  count(): number {
    return this.collaborators.size;
  }

  toJSON(): any[] {
    return this.getAllCollaborators();
  }

  loadFromJSON(array: any[] = []): void {
    this.collaborators.clear();
    if (Array.isArray(array)) {
      for (const item of array) {
        if (item && (item.id || item.email || item.name)) {
          const id = item.id || `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          this.collaborators.set(id, {
            id,
            name: item.name || 'Anonymous Collaborator',
            email: item.email || '',
            role: normalizeRole(item.role, ROLES.VIEWER),
            avatar: item.avatar || null,
            addedAt: item.addedAt || Date.now(),
            updatedAt: item.updatedAt || Date.now()
          });
        }
      }
    }
    this.emit('change', this.getAllCollaborators());
  }
}

export class ShareManager {
  public docId: string;
  public collaborators: CollaboratorListManager;

  constructor(docId: string = 'doc_master', initialCollaborators: any[] = []) {
    this.docId = docId;
    this.collaborators = new CollaboratorListManager(initialCollaborators);
  }

  createShareLink(role: UserRole = ROLES.VIEWER, options: Partial<GenerateShareUrlOptions> = {}): string {
    return generateShareUrl({
      docId: this.docId,
      role,
      ...options
    });
  }

  static generateShareUrl = generateShareUrl;
  static parseShareUrl = parseShareUrl;
  static CollaboratorListManager = CollaboratorListManager;
}
