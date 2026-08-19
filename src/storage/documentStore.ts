/**
 * Document Storage Engine, Version History Manager, and User Profile Store
 * for Google Docs Clone.
 */

import type { UserProfile, QuillDelta } from '../types/index.ts';

export const STORAGE_KEYS = Object.freeze({
  DOCS_INDEX: 'gdocs_index',
  DOC_PREFIX: 'gdocs_doc_',
  ACTIVE_DOC: 'gdocs_active_doc_id',
  USER_PROFILE: 'gdocs_user_profile',
  VERSIONS_PREFIX: 'gdocs_versions_',
  SETTINGS: 'gdocs_settings'
});

export const COLLAB_COLORS: readonly string[] = Object.freeze([
  '#ea4335', // Red
  '#4285f4', // Blue
  '#34a853', // Green
  '#fbbc04', // Yellow / Amber
  '#9c27b0', // Purple
  '#ff6d00', // Orange
  '#00bcd4', // Cyan
  '#e91e63', // Pink
  '#673ab7', // Deep Purple
  '#009688'  // Teal
]);

export const ANONYMOUS_ANIMALS: readonly string[] = Object.freeze([
  'Alligator', 'Anteater', 'Armadillo', 'Aurochs', 'Axolotl',
  'Badger', 'Bat', 'Beaver', 'Buffalo', 'Camel',
  'Capybara', 'Chameleon', 'Cheetah', 'Chinchilla', 'Chipmunk',
  'Cormorant', 'Coyote', 'Crow', 'Dingo', 'Dinosaur',
  'Dolphin', 'Duck', 'Elephant', 'Ferret', 'Fox',
  'Frog', 'Giraffe', 'Gopher', 'Grizzly', 'Hedgehog',
  'Hippo', 'Hyena', 'Ibex', 'Iguana', 'Jackal',
  'Kangaroo', 'Koala', 'Kraken', 'Lemur', 'Leopard',
  'Llama', 'Manatee', 'Mink', 'Monkey', 'Moose',
  'Narwhal', 'Nyan Cat', 'Octopus', 'Opossum', 'Otter',
  'Panda', 'Penguin', 'Platypus', 'Pumpkin', 'Python',
  'Quagga', 'Rabbit', 'Raccoon', 'Rhino', 'Sheep',
  'Shrew', 'Skunk', 'Slow Loris', 'Squirrel', 'Tiger',
  'Turtle', 'Walrus', 'Wolf', 'Wolverine', 'Wombat'
]);

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear?(): void;
}

export interface DocumentSummary {
  id: string;
  title: string;
  updatedAt: number;
  createdAt: number;
  starred?: boolean;
}

export interface StoredDocumentVersion {
  id: string;
  timestamp: number;
  label?: string;
  author?: UserProfile | { name: string; color: string } | string;
  isAutoSave?: boolean;
  content?: string;
  delta?: QuillDelta | null;
  title?: string;
}

export interface StoredDocument {
  id: string;
  title: string;
  content: string;
  delta: QuillDelta | null;
  createdAt: number;
  updatedAt: number;
  starred: boolean;
  owner: UserProfile | { id: string; name: string; role: string };
  sharing: {
    accessLevel: string;
    linkRole: string;
    collaborators: unknown[];
  };
  comments: unknown[];
  pageSetup: {
    margins: { top: number; right: number; bottom: number; left: number };
    orientation: string;
    paperSize: string;
    pageColor: string;
  };
  versions: StoredDocumentVersion[];
}

export class MemoryStorage implements StorageLike {
  private store: Map<string, string>;

  constructor() {
    this.store = new Map();
  }

  getItem(key: string): string | null {
    const val = this.store.get(String(key));
    return val !== undefined ? val : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(String(key), String(value));
  }

  removeItem(key: string): void {
    this.store.delete(String(key));
  }

  clear(): void {
    this.store.clear();
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] !== undefined ? keys[index] : null;
  }

  get length(): number {
    return this.store.size;
  }
}

const globalMemoryStore = new MemoryStorage();

export function getStorage(customStorage: StorageLike | null = null): StorageLike {
  if (customStorage) return customStorage;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const testKey = '__gdocs_storage_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return window.localStorage;
    }
  } catch (_e) {
    // LocalStorage unavailable, fallback to memory
  }
  return globalMemoryStore;
}

export function generateDocId(prefix: string = 'doc'): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${ts}_${rand}`;
}

export function generateVersionId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 6);
  return `ver_${ts}_${rand}`;
}

export function createDefaultDocument(options: Partial<StoredDocument> = {}): StoredDocument {
  const now = Date.now();
  const id = options.id || generateDocId();
  return {
    id,
    title: options.title || 'Untitled document',
    content: options.content || '<p><br></p>',
    delta: options.delta || null,
    createdAt: options.createdAt || now,
    updatedAt: options.updatedAt || now,
    starred: !!options.starred,
    owner: options.owner || { id: 'owner_default', name: 'You', role: 'owner' },
    sharing: options.sharing || {
      accessLevel: 'restricted',
      linkRole: 'viewer',
      collaborators: []
    },
    comments: options.comments || [],
    pageSetup: options.pageSetup || {
      margins: { top: 72, right: 72, bottom: 72, left: 72 },
      orientation: 'portrait',
      paperSize: 'letter',
      pageColor: '#ffffff'
    },
    versions: options.versions || []
  };
}

export class DocumentStore {
  public storage: StorageLike;

  constructor(storage: StorageLike | null = null) {
    this.storage = getStorage(storage);
  }

  getDocsIndex(): DocumentSummary[] {
    try {
      const raw = this.storage.getItem(STORAGE_KEYS.DOCS_INDEX);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn('Error reading docs index from storage:', err);
      return [];
    }
  }

  saveDocsIndex(index: DocumentSummary[]): void {
    try {
      this.storage.setItem(STORAGE_KEYS.DOCS_INDEX, JSON.stringify(index || []));
    } catch (err) {
      console.error('Error saving docs index to storage:', err);
    }
  }

  listDocuments(): DocumentSummary[] {
    const index = this.getDocsIndex();
    return index.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  createDocument(options: Partial<StoredDocument> = {}): StoredDocument {
    const doc = createDefaultDocument(options);
    this.saveDocument(doc);
    return doc;
  }

  createDoc(options: Partial<StoredDocument> = {}): StoredDocument {
    return this.createDocument(options);
  }

  getDocument(id: string): StoredDocument | null {
    if (!id) return null;
    try {
      const raw = this.storage.getItem(STORAGE_KEYS.DOC_PREFIX + id);
      if (!raw) return null;
      return JSON.parse(raw) as StoredDocument;
    } catch (err) {
      console.warn(`Error reading document "${id}":`, err);
      return null;
    }
  }

  getDoc(id: string): StoredDocument | null {
    return this.getDocument(id);
  }

  saveDocument(doc: StoredDocument): StoredDocument {
    if (!doc || !doc.id) {
      throw new Error('Cannot save invalid document without an ID');
    }

    doc.updatedAt = Date.now();
    if (!doc.createdAt) doc.createdAt = doc.updatedAt;

    try {
      this.storage.setItem(STORAGE_KEYS.DOC_PREFIX + doc.id, JSON.stringify(doc));

      const index = this.getDocsIndex();
      const existingIdx = index.findIndex(item => item.id === doc.id);
      const summary: DocumentSummary = {
        id: doc.id,
        title: doc.title || 'Untitled document',
        updatedAt: doc.updatedAt,
        createdAt: doc.createdAt,
        starred: !!doc.starred
      };

      if (existingIdx >= 0) {
        index[existingIdx] = summary;
      } else {
        index.unshift(summary);
      }

      this.saveDocsIndex(index);
    } catch (err) {
      console.error(`Error saving document "${doc.id}":`, err);
    }

    return doc;
  }

  saveDoc(doc: StoredDocument): StoredDocument {
    return this.saveDocument(doc);
  }

  deleteDocument(id: string): boolean {
    if (!id) return false;
    try {
      this.storage.removeItem(STORAGE_KEYS.DOC_PREFIX + id);
      this.storage.removeItem(STORAGE_KEYS.VERSIONS_PREFIX + id);

      const index = this.getDocsIndex().filter(item => item.id !== id);
      this.saveDocsIndex(index);

      if (this.getActiveDocId() === id) {
        this.setActiveDocId(null);
      }

      return true;
    } catch (err) {
      console.error(`Error deleting document "${id}":`, err);
      return false;
    }
  }

  deleteDoc(id: string): boolean {
    return this.deleteDocument(id);
  }

  hasDocument(id: string): boolean {
    if (!id) return false;
    return !!this.storage.getItem(STORAGE_KEYS.DOC_PREFIX + id);
  }

  getActiveDocId(): string | null {
    try {
      return this.storage.getItem(STORAGE_KEYS.ACTIVE_DOC) || null;
    } catch (_err) {
      return null;
    }
  }

  setActiveDocId(id: string | null): void {
    try {
      if (id) {
        this.storage.setItem(STORAGE_KEYS.ACTIVE_DOC, id);
      } else {
        this.storage.removeItem(STORAGE_KEYS.ACTIVE_DOC);
      }
    } catch (err) {
      console.warn('Error setting active doc ID:', err);
    }
  }

  listSnapshots(docId: string): StoredDocumentVersion[] {
    if (!docId) return [];
    try {
      const raw = this.storage.getItem(STORAGE_KEYS.VERSIONS_PREFIX + docId);
      if (!raw) {
        const doc = this.getDocument(docId);
        return doc?.versions || [];
      }
      const versions = JSON.parse(raw);
      return Array.isArray(versions) ? versions.sort((a, b) => b.timestamp - a.timestamp) : [];
    } catch (err) {
      console.warn(`Error reading version history for doc "${docId}":`, err);
      return [];
    }
  }

  getVersionHistory(docId: string): StoredDocumentVersion[] {
    return this.listSnapshots(docId);
  }

  createSnapshot(docId: string, options: Partial<StoredDocumentVersion> & { isAutoSave?: boolean; name?: string; stats?: unknown } = {}): StoredDocumentVersion | null {
    if (!docId) return null;
    const doc = this.getDocument(docId);
    if (!doc) return null;

    const now = Date.now();
    const snapshot: StoredDocumentVersion = {
      id: options.id || generateVersionId(),
      timestamp: now,
      label: options.label || options.name || `Version ${new Date(now).toLocaleTimeString()}`,
      author: options.author || { name: 'Current User', color: '#4285f4' },
      content: options.content !== undefined ? options.content : doc.content,
      delta: options.delta !== undefined ? options.delta : doc.delta,
      title: options.title || doc.title,
      isAutoSave: !!options.isAutoSave
    };

    const versions = this.listSnapshots(docId);
    versions.unshift(snapshot);

    try {
      this.storage.setItem(STORAGE_KEYS.VERSIONS_PREFIX + docId, JSON.stringify(versions));

      doc.versions = versions.slice(0, 20).map((v) => ({
        id: v.id,
        timestamp: v.timestamp,
        label: v.label,
        author: v.author,
        isAutoSave: v.isAutoSave
      }));
      this.saveDocument(doc);
    } catch (err) {
      console.error(`Error saving snapshot for doc "${docId}":`, err);
    }

    return snapshot;
  }

  getSnapshot(docId: string, versionId: string): StoredDocumentVersion | null {
    const versions = this.listSnapshots(docId);
    return versions.find(v => v.id === versionId) || null;
  }

  restoreSnapshot(docId: string, versionId: string, restoringUser: UserProfile | { name: string; color: string } | null = null): StoredDocument | null {
    const doc = this.getDocument(docId);
    if (!doc) return null;

    const snapshot = this.getSnapshot(docId, versionId);
    if (!snapshot) return null;

    this.createSnapshot(docId, {
      label: `Pre-restore backup (${new Date().toLocaleTimeString()})`,
      author: restoringUser || { name: 'System', color: '#757575' },
      isAutoSave: true
    });

    if (snapshot.content !== undefined) doc.content = snapshot.content;
    if (snapshot.delta !== undefined) doc.delta = snapshot.delta;
    if (snapshot.title) doc.title = snapshot.title;
    doc.updatedAt = Date.now();

    this.saveDocument(doc);
    return doc;
  }

  deleteSnapshot(docId: string, versionId: string): boolean {
    if (!docId || !versionId) return false;
    let versions = this.listSnapshots(docId);
    const initialLen = versions.length;
    versions = versions.filter(v => v.id !== versionId);

    if (versions.length !== initialLen) {
      try {
        this.storage.setItem(STORAGE_KEYS.VERSIONS_PREFIX + docId, JSON.stringify(versions));
        return true;
      } catch (err) {
        console.error(`Error deleting snapshot "${versionId}":`, err);
      }
    }
    return false;
  }

  getUserProfile(): UserProfile {
    try {
      const raw = this.storage.getItem(STORAGE_KEYS.USER_PROFILE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.id && parsed.name) {
          return parsed as UserProfile;
        }
      }
    } catch (err) {
      console.warn('Error reading user profile:', err);
    }

    const defaultProfile = this.randomizeUserProfile(false);
    this.saveUserProfile(defaultProfile);
    return defaultProfile;
  }

  saveUserProfile(profile: UserProfile): void {
    if (!profile) return;
    try {
      this.storage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
    } catch (err) {
      console.error('Error saving user profile:', err);
    }
  }

  randomizeUserProfile(persist: boolean = true): UserProfile {
    const randomAnimal = ANONYMOUS_ANIMALS[Math.floor(Math.random() * ANONYMOUS_ANIMALS.length)];
    const randomColor = COLLAB_COLORS[Math.floor(Math.random() * COLLAB_COLORS.length)];
    const randId = Math.random().toString(36).substring(2, 9);

    const profile: UserProfile = {
      id: `user_${randId}`,
      name: `Anonymous ${randomAnimal}`,
      color: randomColor,
      avatar: null,
      email: ''
    };

    if (persist) {
      this.saveUserProfile(profile);
    }

    return profile;
  }

  clearAll(): void {
    try {
      const index = this.getDocsIndex();
      for (const item of index) {
        this.storage.removeItem(STORAGE_KEYS.DOC_PREFIX + item.id);
        this.storage.removeItem(STORAGE_KEYS.VERSIONS_PREFIX + item.id);
      }
      this.storage.removeItem(STORAGE_KEYS.DOCS_INDEX);
      this.storage.removeItem(STORAGE_KEYS.ACTIVE_DOC);
    } catch (err) {
      console.error('Error clearing document store:', err);
    }
  }
}

export const documentStore = new DocumentStore();

export const DocumentStorage = {
  getDocsIndex: () => documentStore.getDocsIndex(),
  saveDocsIndex: (idx: DocumentSummary[]) => documentStore.saveDocsIndex(idx),
  getDoc: (id: string) => documentStore.getDocument(id),
  saveDoc: (doc: StoredDocument) => documentStore.saveDocument(doc),
  deleteDoc: (id: string) => documentStore.deleteDocument(id),
  getUserProfile: () => documentStore.getUserProfile(),
  saveUserProfile: (p: UserProfile) => documentStore.saveUserProfile(p),
  randomizeUserProfile: () => documentStore.randomizeUserProfile()
};
