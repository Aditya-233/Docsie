/**
 * Authentication & Identity Manager for Docsie.
 * 
 * Provides frictionless client-side user authentication, guest profile management,
 * profile customization (names & collaborator colors), and personal document dashboard persistence.
 */

import { ROLES } from '../permissions/manager.js';

const STORAGE_KEYS = {
  CURRENT_USER: 'docsie_current_user',
  ACCOUNTS_DB: 'docsie_registered_accounts',
  DOCUMENTS_INDEX: 'docsie_user_documents_library'
};

const DEFAULT_COLORS = [
  '#ea4335', // Red (Alice)
  '#34a853', // Green (Bob)
  '#e91e63', // Pink (Christine)
  '#1a73e8', // Blue (Aditya)
  '#fbbc05', // Gold / Amber
  '#9c27b0', // Purple
  '#ff6d00', // Deep Orange
  '#00897b'  // Teal
];

function getInitialColor(name) {
  if (!name) return '#1a73e8';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return DEFAULT_COLORS[Math.abs(hash) % DEFAULT_COLORS.length];
}

export class AuthManager {
  constructor(storage = null) {
    this.storage = storage || (typeof window !== 'undefined' ? window.localStorage : new MapStorage());
    this.listeners = new Set();
  }

  /**
   * Subscribe to auth state changes.
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  _notify(user) {
    this.listeners.forEach((cb) => {
      try {
        cb(user);
      } catch (e) {
        console.error('Auth state listener error:', e);
      }
    });
  }

  /**
   * Get currently active user profile.
   */
  getCurrentUser() {
    try {
      const raw = this.storage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Failed parsing current user from storage:', e);
    }
    return null;
  }

  /**
   * Set and persist active user session.
   */
  setCurrentUser(user) {
    if (!user) {
      this.storage.removeItem(STORAGE_KEYS.CURRENT_USER);
    } else {
      this.storage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    }
    this._notify(user);
    return user;
  }

  /**
   * Login as a quick guest collaborator (Frictionless).
   */
  loginAsGuest(name = 'Guest Collaborator', color = null, role = ROLES.EDITOR) {
    const cleanName = name.trim() || 'Guest Collaborator';
    const assignedColor = color || getInitialColor(cleanName);
    const userId = `guest_${cleanName.toLowerCase().replace(/\s+/g, '_')}_${Math.random().toString(36).substring(2, 6)}`;

    const user = {
      id: userId,
      name: cleanName,
      email: `${cleanName.toLowerCase().replace(/\s+/g, '.')}@guest.docsie`,
      color: assignedColor,
      avatar: null,
      role: role,
      isGuest: true,
      isAuthenticated: true,
      joinedAt: new Date().toISOString()
    };

    return this.setCurrentUser(user);
  }

  /**
   * Sign Up with Email and Password.
   */
  signUpWithEmail(email, password, name = '') {
    if (!email || !email.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }
    if (!password || password.length < 4) {
      throw new Error('Password must be at least 4 characters long.');
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim() || cleanEmail.split('@')[0];
    const accounts = this._getAccounts();

    if (accounts[cleanEmail]) {
      throw new Error('An account with this email already exists. Please log in.');
    }

    const user = {
      id: `usr_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`,
      name: cleanName,
      email: cleanEmail,
      color: getInitialColor(cleanName),
      avatar: null,
      role: ROLES.OWNER,
      isGuest: false,
      isAuthenticated: true,
      createdAt: new Date().toISOString()
    };

    accounts[cleanEmail] = {
      ...user,
      passwordHash: this._hashPassword(password)
    };

    this._saveAccounts(accounts);
    return this.setCurrentUser(user);
  }

  /**
   * Log in with Email and Password.
   */
  loginWithEmail(email, password) {
    if (!email || !password) {
      throw new Error('Email and password are required.');
    }

    const cleanEmail = email.trim().toLowerCase();
    const accounts = this._getAccounts();
    const account = accounts[cleanEmail];

    if (!account) {
      throw new Error('No account found with this email. Please sign up first.');
    }

    if (account.passwordHash !== this._hashPassword(password)) {
      throw new Error('Incorrect password. Please try again.');
    }

    const { passwordHash, ...userProfile } = account;
    return this.setCurrentUser({ ...userProfile, isAuthenticated: true, isGuest: false });
  }

  /**
   * Update current user profile (Display Name, Color, Avatar).
   */
  updateProfile({ name, color, avatar }) {
    const current = this.getCurrentUser();
    if (!current) throw new Error('No active user to update.');

    const updated = {
      ...current,
      name: name !== undefined ? name.trim() : current.name,
      color: color !== undefined ? color : current.color,
      avatar: avatar !== undefined ? avatar : current.avatar
    };

    // If account is registered, update in accounts database too
    if (!updated.isGuest && updated.email) {
      const accounts = this._getAccounts();
      if (accounts[updated.email]) {
        accounts[updated.email] = { ...accounts[updated.email], ...updated };
        this._saveAccounts(accounts);
      }
    }

    return this.setCurrentUser(updated);
  }

  /**
   * Log out active session.
   */
  logout() {
    this.setCurrentUser(null);
  }

  // ── Document Library / Dashboard Manager ────────────────────────────────────

  /**
   * List all documents saved in user's library.
   */
  listUserDocuments() {
    try {
      const raw = this.storage.getItem(STORAGE_KEYS.DOCUMENTS_INDEX);
      if (raw) {
        const docs = JSON.parse(raw);
        return Array.isArray(docs) ? docs : [];
      }
    } catch (e) {
      console.warn('Failed listing user documents:', e);
    }
    return [];
  }

  /**
   * Add or update a document in the library.
   */
  saveDocumentMetadata(docId, { title = 'Untitled document', snippet = '', lastModified = Date.now() } = {}) {
    if (!docId) return;
    const docs = this.listUserDocuments();
    const existingIndex = docs.findIndex((d) => d.id === docId);

    const docEntry = {
      id: docId,
      title: title || 'Untitled document',
      snippet: snippet || '',
      lastModified: lastModified,
      lastModifiedFormatted: new Date(lastModified).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    };

    if (existingIndex >= 0) {
      docs[existingIndex] = { ...docs[existingIndex], ...docEntry };
    } else {
      docs.unshift(docEntry);
    }

    try {
      this.storage.setItem(STORAGE_KEYS.DOCUMENTS_INDEX, JSON.stringify(docs));
    } catch (e) {}
    return docs;
  }

  /**
   * Delete a document from the user's library.
   */
  deleteDocumentFromLibrary(docId) {
    const docs = this.listUserDocuments().filter((d) => d.id !== docId);
    try {
      this.storage.setItem(STORAGE_KEYS.DOCUMENTS_INDEX, JSON.stringify(docs));
    } catch (e) {}
    return docs;
  }

  // ── Private Helpers ─────────────────────────────────────────────────────────

  _getAccounts() {
    try {
      const raw = this.storage.getItem(STORAGE_KEYS.ACCOUNTS_DB);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {};
  }

  _saveAccounts(accounts) {
    try {
      this.storage.setItem(STORAGE_KEYS.ACCOUNTS_DB, JSON.stringify(accounts));
    } catch (e) {}
  }

  _hashPassword(password) {
    // Simple determinist hash for local storage
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      hash = ((hash << 5) - hash) + password.charCodeAt(i);
      hash |= 0;
    }
    return `hash_${Math.abs(hash).toString(16)}`;
  }
}

// Fallback in-memory storage for test/headless environments
class MapStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(k) {
    return this.map.has(k) ? this.map.get(k) : null;
  }
  setItem(k, v) {
    this.map.set(k, String(v));
  }
  removeItem(k) {
    this.map.delete(k);
  }
  clear() {
    this.map.clear();
  }
}

export const authManager = new AuthManager();
