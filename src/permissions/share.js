/**
 * Share URL generation, parsing, and granular collaborator list management.
 */

import { ROLES, normalizeRole } from './manager.js';

/**
 * Generate a shareable URL containing docId, role, and optional user information.
 * @param {object} options
 * @param {string} [options.baseUrl] - Base URL (defaults to current window location or empty string)
 * @param {string} options.docId - Document ID to share
 * @param {string} [options.role='viewer'] - Role to grant via this link ('editor', 'commenter', 'viewer', 'owner')
 * @param {string} [options.user] - Optional collaborator display name
 * @param {string} [options.userName] - Alias for user
 * @param {'hash'|'query'} [options.format='hash'] - Encoding style: hash (#doc=...) or search query (?doc=...)
 * @returns {string} Generated share URL
 */
export function generateShareUrl(options = {}) {
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
    // Default format: hash
    return `${baseUrl}#${paramString}`;
  }
}

/**
 * Parse a share URL, search query, or hash string to extract document ID, permission level, and user.
 * @param {string} urlOrString - Full URL, pathname with hash/search, or raw query/hash
 * @returns {{ docId: string|null, role: string, user: string|null, rawParams: Record<string, string> }}
 */
export function parseShareUrl(urlOrString = '') {
  const rawParams = {};
  if (!urlOrString || typeof urlOrString !== 'string') {
    return { docId: null, role: ROLES.VIEWER, user: null, rawParams };
  }

  let searchParams = null;

  try {
    // If it is a valid full URL
    if (urlOrString.startsWith('http://') || urlOrString.startsWith('https://')) {
      const url = new URL(urlOrString);
      // Check hash first (e.g. #doc=...&role=...), then search params (?doc=...&role=...)
      if (url.hash && url.hash.length > 1) {
        searchParams = new URLSearchParams(url.hash.replace(/^#/, ''));
      } else if (url.search && url.search.length > 1) {
        searchParams = new URLSearchParams(url.search.replace(/^\?/, ''));
      }
    }
  } catch (e) {
    // Fall back to direct regex/string parsing
  }

  if (!searchParams) {
    let clean = urlOrString;
    // Extract hash part if present
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

/**
 * Collaborator List Manager for tracking document access list and granular roles.
 */
export class CollaboratorListManager {
  constructor(initialCollaborators = []) {
    this.collaborators = new Map(); // userId -> Collaborator
    this.listeners = new Map();
    if (Array.isArray(initialCollaborators)) {
      this.loadFromJSON(initialCollaborators);
    }
  }

  /**
   * Subscribe to collaborator events.
   * @param {string} event - Event name ('add', 'update', 'remove', 'change')
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
   * Unsubscribe from events.
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
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
        } catch (e) {
          console.error(`Error in CollaboratorListManager listener for "${event}":`, e);
        }
      }
    }
  }

  /**
   * Add or update a collaborator in the list.
   * @param {object} data - Collaborator data
   * @returns {object} Collaborator record
   */
  addCollaborator(data = {}) {
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

  /**
   * Update role of an existing collaborator.
   * @param {string} userId - ID of collaborator
   * @param {string} newRole - New role to assign
   * @returns {object|null} Updated collaborator or null
   */
  updateRole(userId, newRole) {
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

  /**
   * Remove a collaborator by ID.
   * @param {string} userId - ID of collaborator
   * @returns {boolean} True if removed
   */
  removeCollaborator(userId) {
    if (this.collaborators.has(userId)) {
      const removed = this.collaborators.get(userId);
      this.collaborators.delete(userId);
      this.emit('remove', removed);
      this.emit('change', this.getAllCollaborators());
      return true;
    }
    return false;
  }

  /**
   * Get collaborator by ID.
   * @param {string} userId - Collaborator ID
   * @returns {object|null} Collaborator record or null
   */
  getCollaborator(userId) {
    return this.collaborators.get(userId) || null;
  }

  /**
   * Check if collaborator exists.
   * @param {string} userId - Collaborator ID
   * @returns {boolean}
   */
  hasCollaborator(userId) {
    return this.collaborators.has(userId);
  }

  /**
   * Get all collaborators as an array.
   * @returns {object[]} List of collaborators
   */
  getAllCollaborators() {
    return Array.from(this.collaborators.values());
  }

  /**
   * Filter collaborators by role.
   * @param {string} role - Role name
   * @returns {object[]} Filtered collaborators
   */
  getByRole(role) {
    const norm = normalizeRole(role);
    return this.getAllCollaborators().filter(c => c.role === norm);
  }

  /**
   * Get total number of collaborators.
   * @returns {number}
   */
  count() {
    return this.collaborators.size;
  }

  /**
   * Serialize collaborator list to JSON array.
   * @returns {object[]} Array of serialized collaborators
   */
  toJSON() {
    return this.getAllCollaborators();
  }

  /**
   * Load collaborators from array of data objects.
   * @param {object[]} array - Collaborators array
   */
  loadFromJSON(array = []) {
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

/**
 * Unified ShareManager class combining URL handling with Collaborators management.
 */
export class ShareManager {
  constructor(docId = 'doc_master', initialCollaborators = []) {
    this.docId = docId;
    this.collaborators = new CollaboratorListManager(initialCollaborators);
  }

  /**
   * Generate a share link for this document.
   * @param {string} [role='viewer'] - Role to assign via link
   * @param {object} [options={}] - Additional options (baseUrl, format, user)
   * @returns {string} Share URL
   */
  createShareLink(role = ROLES.VIEWER, options = {}) {
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
