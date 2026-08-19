/**
 * Authentication & Identity Manager for Docsie.
 * 
 * Provides client-side user authentication, guest profile management,
 * profile customization, and per-user document library persistence.
 */

import { ROLES } from '../permissions/manager.ts';
import type { UserProfile, DocumentMetadata, UserRole } from '../types/index.ts';

export interface StorageInterface {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear?(): void;
}

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

export function getInitialColor(name: string): string {
  if (!name) return '#1a73e8';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return DEFAULT_COLORS[Math.abs(hash) % DEFAULT_COLORS.length];
}

export class AuthManager {
  private storage: StorageInterface;
  private listeners: Set<(user: UserProfile | null) => void>;

  constructor(storage: StorageInterface | null = null) {
    this.storage = storage || (typeof window !== 'undefined' ? window.localStorage : new MapStorage());
    this.listeners = new Set();
  }

  /**
   * Subscribe to auth state changes.
   */
  subscribe(callback: (user: UserProfile | null) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private _notify(user: UserProfile | null): void {
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
  getCurrentUser(): UserProfile | null {
    try {
      const raw = this.storage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (raw) {
        return JSON.parse(raw) as UserProfile;
      }
    } catch (e) {
      console.warn('Failed parsing current user from storage:', e);
    }
    return null;
  }

  /**
   * Set and persist active user session.
   */
  setCurrentUser(user: UserProfile | null): UserProfile | null {
    if (!user) {
      this.storage.removeItem(STORAGE_KEYS.CURRENT_USER);
    } else {
      this.storage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    }
    this._notify(user);
    return user;
  }

  /**
   * Login as a quick guest collaborator (Frictionless 1-Click).
   */
  loginAsGuest(name: string = 'Guest Collaborator', color: string | null = null, role: UserRole = ROLES.EDITOR): UserProfile {
    const cleanName = name.trim() || 'Guest Collaborator';
    const assignedColor = color || getInitialColor(cleanName);
    const userId = `guest_${cleanName.toLowerCase().replace(/\s+/g, '_')}_${Math.random().toString(36).substring(2, 6)}`;

    const user: UserProfile = {
      id: userId,
      name: cleanName,
      email: `${cleanName.toLowerCase().replace(/\s+/g, '.')}@guest.docsie`,
      color: assignedColor,
      avatar: null,
      role: role,
      isGuest: true,
      isAuthenticated: true
    };

    this.setCurrentUser(user);
    return user;
  }

  /**
   * Sign Up with Email and Password.
   */
  signUpWithEmail(email: string, password: string, name: string = ''): UserProfile {
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

    const user: UserProfile = {
      id: `usr_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`,
      name: cleanName,
      email: cleanEmail,
      color: getInitialColor(cleanName),
      avatar: null,
      role: ROLES.OWNER,
      isGuest: false,
      isAuthenticated: true
    };

    accounts[cleanEmail] = {
      ...user,
      passwordHash: this._hashPassword(password)
    };

    this._saveAccounts(accounts);
    this.setCurrentUser(user);
    return user;
  }

  /**
   * Log in with Email and Password.
   */
  loginWithEmail(email: string, password: string): UserProfile {
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

    const { passwordHash: _, ...userProfile } = account;
    const user = { ...userProfile, isAuthenticated: true, isGuest: false } as UserProfile;
    this.setCurrentUser(user);
    return user;
  }

  /**
   * Update current user profile (Display Name, Color, Avatar).
   */
  updateProfile({ name, color, avatar }: { name?: string; color?: string; avatar?: string | null }): UserProfile {
    const current = this.getCurrentUser();
    if (!current) throw new Error('No active user to update.');

    const updated: UserProfile = {
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

    this.setCurrentUser(updated);
    return updated;
  }

  /**
   * Log out active session.
   */
  logout(): void {
    this.setCurrentUser(null);
  }

  // ── Document Library / Dashboard Manager ────────────────────────────────────

  private _getUserLibraryKey(userId?: string): string {
    const current = this.getCurrentUser();
    const uid = userId || current?.id || 'default';
    return `${STORAGE_KEYS.DOCUMENTS_INDEX}_${uid}`;
  }

  /**
   * List all documents saved in user's library.
   */
  listUserDocuments(userId?: string): DocumentMetadata[] {
    try {
      const userKey = this._getUserLibraryKey(userId);
      let raw = this.storage.getItem(userKey);
      
      // Fallback check on global index
      if (!raw) {
        raw = this.storage.getItem(STORAGE_KEYS.DOCUMENTS_INDEX);
      }

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
   * Add or update a document in the user's library.
   */
  saveDocumentMetadata(docId: string, meta: Partial<DocumentMetadata> = {}, userId?: string): DocumentMetadata[] {
    if (!docId) return [];
    const docs = this.listUserDocuments(userId);
    const existingIndex = docs.findIndex((d) => d.id === docId);

    const docEntry: DocumentMetadata = {
      id: docId,
      title: meta.title || 'Untitled document',
      snippet: meta.snippet || '',
      lastModified: meta.lastModified || Date.now(),
      authorId: meta.authorId || this.getCurrentUser()?.id,
      authorName: meta.authorName || this.getCurrentUser()?.name,
      role: meta.role || 'owner',
      starred: meta.starred || false
    };

    if (existingIndex >= 0) {
      docs[existingIndex] = { ...docs[existingIndex], ...docEntry };
    } else {
      docs.unshift(docEntry);
    }

    try {
      const userKey = this._getUserLibraryKey(userId);
      this.storage.setItem(userKey, JSON.stringify(docs));
      // Also update global index for backward compatibility
      this.storage.setItem(STORAGE_KEYS.DOCUMENTS_INDEX, JSON.stringify(docs));
    } catch (e) {
      console.warn('Failed saving document metadata:', e);
    }
    return docs;
  }

  /**
   * Delete a document from the user's library.
   */
  deleteDocumentFromLibrary(docId: string, userId?: string): DocumentMetadata[] {
    const docs = this.listUserDocuments(userId).filter((d) => d.id !== docId);
    try {
      const userKey = this._getUserLibraryKey(userId);
      this.storage.setItem(userKey, JSON.stringify(docs));
      this.storage.setItem(STORAGE_KEYS.DOCUMENTS_INDEX, JSON.stringify(docs));
    } catch (e) {
      console.warn('Failed deleting document:', e);
    }
    return docs;
  }

  // ── Private Helpers ─────────────────────────────────────────────────────────

  private _getAccounts(): Record<string, any> {
    try {
      const raw = this.storage.getItem(STORAGE_KEYS.ACCOUNTS_DB);
      if (raw) return JSON.parse(raw);
    } catch (_e) {}
    return {};
  }

  private _saveAccounts(accounts: Record<string, any>): void {
    try {
      this.storage.setItem(STORAGE_KEYS.ACCOUNTS_DB, JSON.stringify(accounts));
    } catch (_e) {}
  }

  private _hashPassword(password: string): string {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      hash = ((hash << 5) - hash) + password.charCodeAt(i);
      hash |= 0;
    }
    return `hash_${Math.abs(hash).toString(16)}`;
  }
}

// Fallback in-memory storage for test/headless environments
export class MapStorage implements StorageInterface {
  private map: Map<string, string>;
  constructor() {
    this.map = new Map();
  }
  getItem(k: string): string | null {
    return this.map.has(k) ? (this.map.get(k) ?? null) : null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, String(v));
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
  clear(): void {
    this.map.clear();
  }
}

export const authManager = new AuthManager();
