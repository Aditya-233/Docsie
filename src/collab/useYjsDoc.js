/**
 * Yjs CRDT Collaboration Hook for React 18 + Vite Google Docs Clone.
 *
 * Manages:
 * - Y.Doc CRDT instance with IndexedDB offline persistence
 * - WebrtcProvider for seamless peer-to-peer and multi-tab sync without server refresh
 * - Awareness presence tracking (user profile, color, role, cursor carets)
 * - y-quill binding for Quill rich-text editor
 * - Real-time role permissions (ydoc.getMap('permissions'))
 * - Access request workflow (ydoc.getArray('accessRequests'))
 * - Undo/Redo manager (Y.UndoManager)
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { IndexeddbPersistence } from 'y-indexeddb';
import { QuillBinding } from 'y-quill';

// Vibrant Google Docs collaborator color palette
export const COLLAB_COLORS = [
  '#4285F4', // Google Blue
  '#EA4335', // Google Red
  '#34A853', // Google Green
  '#FBBC05', // Google Yellow
  '#A142F4', // Purple
  '#24C2D1', // Teal
  '#FF7043', // Deep Orange
  '#E91E63', // Pink
  '#00B0FF', // Light Blue
  '#00C853'  // Vibrant Green
];

/**
 * Returns a random collaborator color from the palette.
 */
export function getRandomCollabColor() {
  return COLLAB_COLORS[Math.floor(Math.random() * COLLAB_COLORS.length)];
}

/**
 * Derives room identifier from passed ID, URL hash (#doc=xyz or #xyz),
 * or query parameter (?doc=xyz or ?room=xyz).
 */
export function deriveRoomId(explicitId) {
  if (explicitId && typeof explicitId === 'string' && explicitId.trim().length > 0) {
    const cleanStr = explicitId.trim();
    if (cleanStr.includes('=')) {
      const paramStr = cleanStr.replace(/^[#?]/, '');
      const params = new URLSearchParams(paramStr);
      const docParam = params.get('doc') || params.get('id') || params.get('room');
      if (docParam) return docParam;
    }
    return cleanStr.replace(/^[#?]/, '').trim();
  }

  if (typeof window !== 'undefined' && window.location) {
    // 1. Check URL Hash (e.g. #doc=test1, #room=test1, or #test1)
    const hash = window.location.hash || '';
    if (hash.length > 1) {
      const hashContent = hash.slice(1);
      if (hashContent.includes('=')) {
        const hashParams = new URLSearchParams(hashContent);
        const docFromHash = hashParams.get('doc') || hashParams.get('id') || hashParams.get('room');
        if (docFromHash) return docFromHash;
      } else {
        return hashContent;
      }
    }

    // 2. Check URL Search Query (e.g. ?doc=test1 or ?room=test1)
    const search = window.location.search || '';
    if (search.length > 1) {
      const searchParams = new URLSearchParams(search);
      const docFromSearch = searchParams.get('doc') || searchParams.get('id') || searchParams.get('room');
      if (docFromSearch) return docFromSearch;
    }
  }

  return 'google-docs-demo';
}

/**
 * Default public WebRTC signaling servers for cross-machine peer discovery.
 * y-webrtc also utilizes native BroadcastChannel for zero-latency local tab-to-tab sync.
 */
export const LOCAL_SIGNALING_SERVER = 'ws://localhost:4444';

export const DEFAULT_SIGNALING_SERVERS = [
  'wss://signaling.yjs.dev',
  'wss://y-webrtc-signaling-eu.herokuapp.com',
  'wss://y-webrtc-signaling-us.herokuapp.com'
];

/**
 * React Hook managing Yjs CRDT Collaboration.
 *
 * @param {Object} options Configuration parameters
 * @param {string} [options.docId] Document / Room ID (or auto-derived from URL)
 * @param {Object} [options.user] Local user profile { id, name, color, email, role, avatar }
 * @param {string} [options.role] Initial role ('owner' | 'editor' | 'commenter' | 'viewer')
 * @param {Object} [options.quill] Quill editor instance to bind to
 * @param {string[]} [options.signaling] Custom signaling servers array
 * @param {string} [options.password] Room password for WebRTC encryption
 * @param {boolean} [options.disablePersistence=false] Disable IndexedDB persistence
 * @returns {Object} Collaboration state, collaborators list, permissions, and handler functions
 */
export function useYjsDoc(config = {}) {
  // Support both object argument and positional invocation flexibility
  const resolvedConfig = typeof config === 'string' ? { docId: config } : config;

  const {
    docId: propDocId,
    user: propUser = {},
    role: propRole = 'editor',
    quill: propQuill = null,
    signaling = DEFAULT_SIGNALING_SERVERS,
    password = null,
    disablePersistence = false
  } = resolvedConfig;

  // Stable room identifier
  const roomId = useMemo(() => deriveRoomId(propDocId), [propDocId]);

  // Current local user profile state with safe defaults
  const [currentUser, setCurrentUser] = useState(() => ({
    id: propUser.id || `user_${Math.random().toString(36).substring(2, 9)}`,
    name: propUser.name || 'Anonymous Collaborator',
    color: propUser.color || getRandomCollabColor(),
    email: propUser.email || '',
    avatar: propUser.avatar || null,
    role: propUser.role || propRole || 'editor'
  }));

  // Synchronize when propUser changes externally
  useEffect(() => {
    if (propUser && Object.keys(propUser).length > 0) {
      setCurrentUser(prev => ({
        ...prev,
        ...propUser,
        role: propUser.role || propRole || prev.role
      }));
    }
  }, [propUser, propRole]);

  // Editor instance ref and state
  const [quillInstance, setQuillInstance] = useState(propQuill);
  useEffect(() => {
    if (propQuill) {
      setQuillInstance(propQuill);
    }
  }, [propQuill]);

  // Reactive state values
  const [collaborators, setCollaborators] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [accessRequests, setAccessRequests] = useState([]);
  const [isSynced, setIsSynced] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [docTitle, setDocTitle] = useState('Untitled Document');

  // Internal references to Yjs structures
  const ydocRef = useRef(null);
  const providerRef = useRef(null);
  const persistenceRef = useRef(null);
  const bindingRef = useRef(null);
  const undoManagerRef = useRef(null);

  // Initialize Y.Doc, WebrtcProvider, IndexeddbPersistence, and Awareness
  useEffect(() => {
    const roomName = `gdocs_${roomId}`;
    const ydoc = new Y.Doc({ guid: roomName });
    ydocRef.current = ydoc;

    // 1. IndexedDB Persistence for offline caching
    let persistence = null;
    if (!disablePersistence && typeof window !== 'undefined' && window.indexedDB) {
      try {
        persistence = new IndexeddbPersistence(roomName, ydoc);
        persistenceRef.current = persistence;

        persistence.on('synced', () => {
          setIsSynced(true);
        });
      } catch (err) {
        console.warn('[useYjsDoc] IndexeddbPersistence unavailable:', err);
      }
    } else {
      setIsSynced(true);
    }

    // 2. WebRTC Provider for Real-Time Peer-to-Peer & Multi-Tab BroadcastChannel sync
    const provider = new WebrtcProvider(roomName, ydoc, {
      signaling: signaling && signaling.length > 0 ? signaling : DEFAULT_SIGNALING_SERVERS,
      password: password,
      maxConns: 30,
      filterBcConns: true
    });
    providerRef.current = provider;

    // 3. Awareness Setup
    const awareness = provider.awareness;
    const initialLocalUser = {
      id: currentUser.id,
      name: currentUser.name,
      color: currentUser.color,
      email: currentUser.email,
      avatar: currentUser.avatar,
      role: currentUser.role
    };

    awareness.setLocalStateField('user', initialLocalUser);

    // Track active peers from awareness.getStates()
    const handleAwarenessChange = () => {
      const states = awareness.getStates();
      const peerList = [];

      states.forEach((state, clientId) => {
        if (state && state.user) {
          peerList.push({
            clientId,
            isLocal: clientId === ydoc.clientID,
            id: state.user.id || `peer_${clientId}`,
            name: state.user.name || `Collaborator ${clientId}`,
            color: state.user.color || '#4285F4',
            email: state.user.email || '',
            avatar: state.user.avatar || null,
            role: state.user.role || 'editor',
            cursor: state.cursor || null,
            lastActive: Date.now()
          });
        }
      });

      // Sort: Local user first, then alphabetical by name
      peerList.sort((a, b) => {
        if (a.isLocal) return -1;
        if (b.isLocal) return 1;
        return (a.name || '').localeCompare(b.name || '');
      });

      setCollaborators(peerList);
    };

    awareness.on('change', handleAwarenessChange);
    // Initial call to register current user in collaborator roster
    handleAwarenessChange();

    // Track Provider Status
    const handleStatus = (event) => {
      setIsConnected(Boolean(event.connected));
    };
    const handleSynced = (event) => {
      if (event.synced !== undefined) {
        setIsSynced(Boolean(event.synced));
      }
    };

    provider.on('status', handleStatus);
    provider.on('synced', handleSynced);

    // 4. Permissions Map Synchronization
    const permissionsMap = ydoc.getMap('permissions');
    const handlePermissionsChange = () => {
      const permsObj = permissionsMap.toJSON();
      setPermissions(permsObj);

      // Dynamically update effective role if changed by owner
      if (currentUser.id && permsObj[currentUser.id]) {
        const elevatedRole = permsObj[currentUser.id];
        setCurrentUser(prev => {
          if (prev.role !== elevatedRole) {
            awareness.setLocalStateField('user', {
              ...prev,
              role: elevatedRole
            });
            return { ...prev, role: elevatedRole };
          }
          return prev;
        });
      }
    };

    permissionsMap.observe(handlePermissionsChange);
    handlePermissionsChange();

    // 5. Access Requests Array Synchronization
    const accessRequestsArray = ydoc.getArray('accessRequests');
    const handleAccessRequestsChange = () => {
      setAccessRequests(accessRequestsArray.toArray());
    };

    accessRequestsArray.observe(handleAccessRequestsChange);
    handleAccessRequestsChange();

    // 6. Document Metadata (Title) Synchronization
    const metaMap = ydoc.getMap('meta');
    const handleMetaChange = () => {
      const storedTitle = metaMap.get('title');
      if (storedTitle) {
        setDocTitle(storedTitle);
      }
    };
    metaMap.observe(handleMetaChange);
    handleMetaChange();

    // 7. Y.Text and UndoManager initialization
    const ytext = ydoc.getText('quill');
    const undoManager = new Y.UndoManager(ytext, {
      trackedOrigins: new Set([null, undefined]),
      captureTimeout: 400
    });
    undoManagerRef.current = undoManager;

    const handleStackChange = () => {
      setCanUndo(undoManager.undoStack.length > 0);
      setCanRedo(undoManager.redoStack.length > 0);
    };

    undoManager.on('stack-item-added', handleStackChange);
    undoManager.on('stack-item-popped', handleStackChange);
    undoManager.on('stack-cleared', handleStackChange);

    // Cleanup on unmount or roomId change
    return () => {
      if (bindingRef.current) {
        try {
          bindingRef.current.destroy();
        } catch (e) {}
        bindingRef.current = null;
      }

      awareness.off('change', handleAwarenessChange);
      provider.off('status', handleStatus);
      provider.off('synced', handleSynced);
      permissionsMap.unobserve(handlePermissionsChange);
      accessRequestsArray.unobserve(handleAccessRequestsChange);
      metaMap.unobserve(handleMetaChange);
      undoManager.destroy();

      try {
        provider.destroy();
      } catch (e) {}

      if (persistence) {
        try {
          persistence.destroy();
        } catch (e) {}
      }

      try {
        ydoc.destroy();
      } catch (e) {}

      ydocRef.current = null;
      providerRef.current = null;
      persistenceRef.current = null;
      undoManagerRef.current = null;
    };
  }, [roomId, disablePersistence, password, signaling]);

  // Keep awareness user state in sync with local currentUser changes
  useEffect(() => {
    const provider = providerRef.current;
    if (provider && provider.awareness) {
      provider.awareness.setLocalStateField('user', {
        id: currentUser.id,
        name: currentUser.name,
        color: currentUser.color,
        email: currentUser.email,
        avatar: currentUser.avatar,
        role: currentUser.role
      });
    }
  }, [currentUser]);

  // Bind Quill editor instance to Yjs Y.Text using y-quill
  useEffect(() => {
    if (!quillInstance || !ydocRef.current || !providerRef.current) {
      return;
    }

    const ydoc = ydocRef.current;
    const provider = providerRef.current;
    const ytext = ydoc.getText('quill');

    // Destroy existing binding if any
    if (bindingRef.current) {
      try {
        bindingRef.current.destroy();
      } catch (e) {}
      bindingRef.current = null;
    }

    try {
      const binding = new QuillBinding(ytext, quillInstance, provider.awareness);
      bindingRef.current = binding;

      // Track Undo/Redo stack for QuillBinding changes
      if (undoManagerRef.current) {
        undoManagerRef.current.trackedOrigins.add(binding);
      }
    } catch (err) {
      console.error('[useYjsDoc] Error binding Quill instance:', err);
    }

    return () => {
      if (bindingRef.current) {
        try {
          bindingRef.current.destroy();
        } catch (e) {}
        bindingRef.current = null;
      }
    };
  }, [quillInstance]);

  // Effective role calculation (permissions map takes priority over local role)
  const effectiveRole = useMemo(() => {
    if (currentUser.id && permissions[currentUser.id]) {
      return permissions[currentUser.id];
    }
    return currentUser.role || propRole || 'editor';
  }, [currentUser.id, currentUser.role, permissions, propRole]);

  // Access permission checks
  const canEdit = useMemo(() => {
    const r = (effectiveRole || '').toLowerCase();
    return r === 'owner' || r === 'editor' || r === 'admin';
  }, [effectiveRole]);

  const canComment = useMemo(() => {
    const r = (effectiveRole || '').toLowerCase();
    return r === 'owner' || r === 'editor' || r === 'commenter' || r === 'admin';
  }, [effectiveRole]);

  const canManagePermissions = useMemo(() => {
    const r = (effectiveRole || '').toLowerCase();
    return r === 'owner' || r === 'admin';
  }, [effectiveRole]);

  /**
   * Request edit access from the document owner/editors.
   * Inserts or updates an access request in ydoc.getArray('accessRequests').
   */
  const requestEditAccess = useCallback((reason = 'Requesting edit access to collaborate') => {
    const ydoc = ydocRef.current;
    if (!ydoc) return;

    const accessRequestsArray = ydoc.getArray('accessRequests');
    const existingRequests = accessRequestsArray.toArray();

    // Check if user already has a pending request
    const existingIndex = existingRequests.findIndex(
      req => req.userId === currentUser.id && req.status === 'pending'
    );

    const newRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email || '',
      userColor: currentUser.color,
      requestedRole: 'editor',
      reason: reason,
      timestamp: Date.now(),
      status: 'pending'
    };

    ydoc.transact(() => {
      if (existingIndex !== -1) {
        accessRequestsArray.delete(existingIndex, 1);
        accessRequestsArray.insert(existingIndex, [newRequest]);
      } else {
        accessRequestsArray.push([newRequest]);
      }
    });

    return newRequest;
  }, [currentUser]);

  /**
   * Grant edit access to a target collaborator.
   * Updates ydoc.getMap('permissions') and marks pending access requests as approved.
   */
  const grantEditAccess = useCallback((targetUserId, newRole = 'editor') => {
    const ydoc = ydocRef.current;
    if (!ydoc || !targetUserId) return;

    const permissionsMap = ydoc.getMap('permissions');
    const accessRequestsArray = ydoc.getArray('accessRequests');

    ydoc.transact(() => {
      // 1. Elevate target user's role in the permissions map
      permissionsMap.set(targetUserId, newRole);

      // 2. Mark any pending access requests for this user as approved
      const requests = accessRequestsArray.toArray();
      requests.forEach((req, index) => {
        if (req && req.userId === targetUserId && req.status === 'pending') {
          accessRequestsArray.delete(index, 1);
          accessRequestsArray.insert(index, [{
            ...req,
            status: 'approved',
            resolvedBy: currentUser.id,
            resolvedAt: Date.now()
          }]);
        }
      });
    });
  }, [currentUser.id]);

  /**
   * Reject an access request.
   */
  const rejectEditAccess = useCallback((targetUserId) => {
    const ydoc = ydocRef.current;
    if (!ydoc || !targetUserId) return;

    const accessRequestsArray = ydoc.getArray('accessRequests');

    ydoc.transact(() => {
      const requests = accessRequestsArray.toArray();
      requests.forEach((req, index) => {
        if (req && req.userId === targetUserId && req.status === 'pending') {
          accessRequestsArray.delete(index, 1);
          accessRequestsArray.insert(index, [{
            ...req,
            status: 'rejected',
            resolvedBy: currentUser.id,
            resolvedAt: Date.now()
          }]);
        }
      });
    });
  }, [currentUser.id]);

  /**
   * Revoke or modify permissions for any user.
   */
  const setPermission = useCallback((targetUserId, role) => {
    const ydoc = ydocRef.current;
    if (!ydoc || !targetUserId) return;

    const permissionsMap = ydoc.getMap('permissions');
    ydoc.transact(() => {
      if (role) {
        permissionsMap.set(targetUserId, role);
      } else {
        permissionsMap.delete(targetUserId);
      }
    });
  }, []);

  /**
   * Set document title synchronized across all peers.
   */
  const setTitle = useCallback((newTitle) => {
    const ydoc = ydocRef.current;
    if (!ydoc || typeof newTitle !== 'string') return;

    const metaMap = ydoc.getMap('meta');
    metaMap.set('title', newTitle);
    setDocTitle(newTitle);
  }, []);

  /**
   * Set local user profile.
   */
  const setUser = useCallback((updatedFields = {}) => {
    setCurrentUser(prev => ({
      ...prev,
      ...updatedFields
    }));
  }, []);

  /**
   * Undo last edit transaction.
   */
  const undo = useCallback(() => {
    if (undoManagerRef.current && canUndo) {
      undoManagerRef.current.undo();
    }
  }, [canUndo]);

  /**
   * Redo last undone transaction.
   */
  const redo = useCallback(() => {
    if (undoManagerRef.current && canRedo) {
      undoManagerRef.current.redo();
    }
  }, [canRedo]);

  /**
   * Explicitly bind a Quill instance if not passed at hook creation.
   */
  const bindQuill = useCallback((quill) => {
    setQuillInstance(quill);
  }, []);

  return {
    // Room & Core Instances
    roomId,
    ydoc: ydocRef.current,
    provider: providerRef.current,
    awareness: providerRef.current?.awareness || null,
    persistence: persistenceRef.current,
    binding: bindingRef.current,
    ytext: ydocRef.current ? ydocRef.current.getText('quill') : null,
    undoManager: undoManagerRef.current,

    // Reactive Status
    isSynced,
    isConnected,
    docTitle,
    setTitle,

    // Presence & Collaborators
    collaborators,
    currentUser,
    setUser,

    // Permissions & Roles
    role: effectiveRole,
    permissions,
    accessRequests,
    canEdit,
    canComment,
    canManagePermissions,

    // Permission Actions
    requestEditAccess,
    grantEditAccess,
    rejectEditAccess,
    setPermission,

    // Editor Actions
    bindQuill,
    undo,
    redo,
    canUndo,
    canRedo
  };
}

export default useYjsDoc;
