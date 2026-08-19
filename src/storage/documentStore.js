/**
 * Document Storage Engine, Version History Manager, and User Profile Store
 * for Google Docs Clone.
 * 
 * Supports local storage with automatic in-memory fallback for headless / Node.js
 * testing environments.
 */

export const STORAGE_KEYS = Object.freeze({
  DOCS_INDEX: 'gdocs_index',
  DOC_PREFIX: 'gdocs_doc_',
  ACTIVE_DOC: 'gdocs_active_doc_id',
  USER_PROFILE: 'gdocs_user_profile',
  VERSIONS_PREFIX: 'gdocs_versions_',
  SETTINGS: 'gdocs_settings'
});

export const COLLAB_COLORS = Object.freeze([
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

export const ANONYMOUS_ANIMALS = Object.freeze([
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

/**
 * In-memory storage fallback when window.localStorage is not accessible or in Node.js.
 */
export class MemoryStorage {
  constructor() {
    this.store = new Map();
  }

  getItem(key) {
    return this.store.has(String(key)) ? this.store.get(String(key)) : null;
  }

  setItem(key, value) {
    this.store.set(String(key), String(value));
  }

  removeItem(key) {
    this.store.delete(String(key));
  }

  clear() {
    this.store.clear();
  }

  key(index) {
    const keys = Array.from(this.store.keys());
    return keys[index] !== undefined ? keys[index] : null;
  }

  get length() {
    return this.store.size;
  }
}

// Global fallback instance
const globalMemoryStore = new MemoryStorage();

/**
 * Get active storage adapter safely.
 * @param {Storage|null} customStorage - Optional custom storage adapter
 * @returns {Storage|MemoryStorage}
 */
export function getStorage(customStorage = null) {
  if (customStorage) return customStorage;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      // Verify storage is functional (e.g. not blocked by Safari private mode or iframe policy)
      const testKey = '__gdocs_storage_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return window.localStorage;
    }
  } catch (e) {
    // LocalStorage unavailable, fallback to memory
  }
  return globalMemoryStore;
}

/**
 * Generate a unique document ID.
 * @param {string} prefix - ID prefix
 * @returns {string} Unique ID
 */
export function generateDocId(prefix = 'doc') {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${ts}_${rand}`;
}

/**
 * Generate a unique version snapshot ID.
 * @returns {string} Unique version ID
 */
export function generateVersionId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 6);
  return `ver_${ts}_${rand}`;
}

/**
 * Create default document structure.
 * @param {object} options - Initial document options
 * @returns {object} Document schema object
 */
export function createDefaultDocument(options = {}) {
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
      margins: { top: 72, right: 72, bottom: 72, left: 72 }, // 72px / 0.75in
      orientation: 'portrait',
      paperSize: 'letter',
      pageColor: '#ffffff'
    },
    versions: options.versions || []
  };
}

/**
 * Document Store class providing CRUD operations, version history, and profile management.
 */
export class DocumentStore {
  constructor(storage = null) {
    this.storage = getStorage(storage);
  }

  /* ==========================================================================
     1. DOCUMENT CRUD & INDEX MANAGEMENT
     ========================================================================== */

  /**
   * Retrieve list of document summaries from index.
   * @returns {Array<{ id: string, title: string, updatedAt: number, createdAt: number, starred: boolean }>}
   */
  getDocsIndex() {
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

  /**
   * Save the document index array.
   * @param {Array<object>} index - Document summaries index
   */
  saveDocsIndex(index) {
    try {
      this.storage.setItem(STORAGE_KEYS.DOCS_INDEX, JSON.stringify(index || []));
    } catch (err) {
      console.error('Error saving docs index to storage:', err);
    }
  }

  /**
   * List all documents sorted by most recently updated.
   * @returns {Array<object>}
   */
  listDocuments() {
    const index = this.getDocsIndex();
    return index.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  /**
   * Create a new document and persist it.
   * @param {object} options - Initial document options
   * @returns {object} Created document object
   */
  createDocument(options = {}) {
    const doc = createDefaultDocument(options);
    this.saveDocument(doc);
    return doc;
  }

  /**
   * Alias for createDocument
   */
  createDoc(options = {}) {
    return this.createDocument(options);
  }

  /**
   * Retrieve full document by ID.
   * @param {string} id - Document ID
   * @returns {object|null} Document object or null if not found
   */
  getDocument(id) {
    if (!id) return null;
    try {
      const raw = this.storage.getItem(STORAGE_KEYS.DOC_PREFIX + id);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      console.warn(`Error reading document "${id}":`, err);
      return null;
    }
  }

  /**
   * Alias for getDocument
   */
  getDoc(id) {
    return this.getDocument(id);
  }

  /**
   * Save or update an existing document and its index entry.
   * @param {object} doc - Document object
   * @returns {object} Updated document
   */
  saveDocument(doc) {
    if (!doc || !doc.id) {
      throw new Error('Cannot save invalid document without an ID');
    }

    doc.updatedAt = Date.now();
    if (!doc.createdAt) doc.createdAt = doc.updatedAt;

    try {
      this.storage.setItem(STORAGE_KEYS.DOC_PREFIX + doc.id, JSON.stringify(doc));

      // Synchronize index entry
      const index = this.getDocsIndex();
      const existingIdx = index.findIndex(item => item.id === doc.id);
      const summary = {
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

  /**
   * Alias for saveDocument
   */
  saveDoc(doc) {
    return this.saveDocument(doc);
  }

  /**
   * Delete document by ID along with its snapshots and index entry.
   * @param {string} id - Document ID
   * @returns {boolean} True if successfully deleted
   */
  deleteDocument(id) {
    if (!id) return false;
    try {
      this.storage.removeItem(STORAGE_KEYS.DOC_PREFIX + id);
      this.storage.removeItem(STORAGE_KEYS.VERSIONS_PREFIX + id);

      const index = this.getDocsIndex().filter(item => item.id !== id);
      this.saveDocsIndex(index);

      // If active doc was deleted, clear active tracker
      if (this.getActiveDocId() === id) {
        this.setActiveDocId(null);
      }

      return true;
    } catch (err) {
      console.error(`Error deleting document "${id}":`, err);
      return false;
    }
  }

  /**
   * Alias for deleteDocument
   */
  deleteDoc(id) {
    return this.deleteDocument(id);
  }

  /**
   * Check if a document exists.
   * @param {string} id - Document ID
   * @returns {boolean}
   */
  hasDocument(id) {
    if (!id) return false;
    return !!this.storage.getItem(STORAGE_KEYS.DOC_PREFIX + id);
  }

  /**
   * Get active document ID.
   * @returns {string|null}
   */
  getActiveDocId() {
    try {
      return this.storage.getItem(STORAGE_KEYS.ACTIVE_DOC) || null;
    } catch (err) {
      return null;
    }
  }

  /**
   * Set active document ID.
   * @param {string|null} id - Document ID
   */
  setActiveDocId(id) {
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

  /* ==========================================================================
     2. VERSION HISTORY & SNAPSHOT MANAGEMENT
     ========================================================================== */

  /**
   * Retrieve all snapshots for a given document.
   * @param {string} docId - Document ID
   * @returns {Array<object>} Snapshots list sorted newest first
   */
  listSnapshots(docId) {
    if (!docId) return [];
    try {
      const raw = this.storage.getItem(STORAGE_KEYS.VERSIONS_PREFIX + docId);
      if (!raw) {
        // Fallback: check versions embedded inside doc object
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

  /**
   * Alias for listSnapshots
   */
  getVersionHistory(docId) {
    return this.listSnapshots(docId);
  }

  /**
   * Create and store a new snapshot of the document.
   * @param {string} docId - Document ID
   * @param {object} [options] - Snapshot options (label, author, content, delta, stats)
   * @returns {object|null} Created snapshot object
   */
  createSnapshot(docId, options = {}) {
    if (!docId) return null;
    const doc = this.getDocument(docId);
    if (!doc) return null;

    const now = Date.now();
    const snapshot = {
      id: options.id || generateVersionId(),
      docId: docId,
      timestamp: now,
      label: options.label || options.name || `Version ${new Date(now).toLocaleTimeString()}`,
      author: options.author || { name: 'Current User', color: '#4285f4' },
      content: options.content !== undefined ? options.content : doc.content,
      delta: options.delta !== undefined ? options.delta : doc.delta,
      title: options.title || doc.title,
      stats: options.stats || null,
      isAutoSave: !!options.isAutoSave
    };

    const versions = this.listSnapshots(docId);
    versions.unshift(snapshot);

    try {
      this.storage.setItem(STORAGE_KEYS.VERSIONS_PREFIX + docId, JSON.stringify(versions));

      // Also update embedded doc versions metadata summary (limit to last 20 for memory)
      doc.versions = versions.slice(0, 20).map(v => ({
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

  /**
   * Get a specific snapshot by ID.
   * @param {string} docId - Document ID
   * @param {string} versionId - Version ID
   * @returns {object|null} Snapshot object or null
   */
  getSnapshot(docId, versionId) {
    const versions = this.listSnapshots(docId);
    return versions.find(v => v.id === versionId) || null;
  }

  /**
   * Restore document state from a version snapshot.
   * Automatically creates a backup snapshot of current state before restoring.
   * @param {string} docId - Document ID
   * @param {string} versionId - Version snapshot ID to restore
   * @param {object} [restoringUser] - User performing the restore
   * @returns {object|null} Restored document or null
   */
  restoreSnapshot(docId, versionId, restoringUser = null) {
    const doc = this.getDocument(docId);
    if (!doc) return null;

    const snapshot = this.getSnapshot(docId, versionId);
    if (!snapshot) return null;

    // Create a safety backup snapshot of current state
    this.createSnapshot(docId, {
      label: `Pre-restore backup (${new Date().toLocaleTimeString()})`,
      author: restoringUser || { name: 'System', color: '#757575' },
      isAutoSave: true
    });

    // Apply snapshot state
    doc.content = snapshot.content;
    doc.delta = snapshot.delta;
    if (snapshot.title) doc.title = snapshot.title;
    doc.updatedAt = Date.now();

    this.saveDocument(doc);
    return doc;
  }

  /**
   * Delete a specific snapshot from version history.
   * @param {string} docId - Document ID
   * @param {string} versionId - Version snapshot ID
   * @returns {boolean} True if removed
   */
  deleteSnapshot(docId, versionId) {
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

  /* ==========================================================================
     3. USER PROFILE MANAGEMENT
     ========================================================================== */

  /**
   * Get current user profile or generate a random default.
   * @returns {{ id: string, name: string, color: string, avatar: string|null }}
   */
  getUserProfile() {
    try {
      const raw = this.storage.getItem(STORAGE_KEYS.USER_PROFILE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.id && parsed.name) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Error reading user profile:', err);
    }

    const defaultProfile = this.randomizeUserProfile(false);
    this.saveUserProfile(defaultProfile);
    return defaultProfile;
  }

  /**
   * Save user profile to storage.
   * @param {object} profile - User profile object
   */
  saveUserProfile(profile) {
    if (!profile) return;
    try {
      this.storage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
    } catch (err) {
      console.error('Error saving user profile:', err);
    }
  }

  /**
   * Generate a fresh randomized collaborator profile.
   * @param {boolean} [persist=true] - Whether to save to storage immediately
   * @returns {{ id: string, name: string, color: string, avatar: string|null }}
   */
  randomizeUserProfile(persist = true) {
    const randomAnimal = ANONYMOUS_ANIMALS[Math.floor(Math.random() * ANONYMOUS_ANIMALS.length)];
    const randomColor = COLLAB_COLORS[Math.floor(Math.random() * COLLAB_COLORS.length)];
    const randId = Math.random().toString(36).substring(2, 9);

    const profile = {
      id: `user_${randId}`,
      name: `Anonymous ${randomAnimal}`,
      color: randomColor,
      avatar: null,
      email: null
    };

    if (persist) {
      this.saveUserProfile(profile);
    }

    return profile;
  }

  /**
   * Clear all stored documents, index, and version history.
   */
  clearAll() {
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

// Export singleton instance with default storage
export const documentStore = new DocumentStore();

// Export convenience static wrapper methods for backward compatibility
export const DocumentStorage = {
  getDocsIndex: () => documentStore.getDocsIndex(),
  saveDocsIndex: (idx) => documentStore.saveDocsIndex(idx),
  getDoc: (id) => documentStore.getDocument(id),
  saveDoc: (doc) => documentStore.saveDocument(doc),
  deleteDoc: (id) => documentStore.deleteDocument(id),
  getUserProfile: () => documentStore.getUserProfile(),
  saveUserProfile: (p) => documentStore.saveUserProfile(p),
  randomizeUserProfile: () => documentStore.randomizeUserProfile()
};
