/**
 * Yjs CRDT Collaboration Hook for React 18 + Vite Google Docs Clone.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { IndexeddbPersistence } from 'y-indexeddb';
import { QuillBinding } from 'y-quill';
import type Quill from 'quill';
import type { UserProfile, UserRole, CollaboratorPeer, AccessRequestItem } from '../types/index.ts';

export const COLLAB_COLORS: readonly string[] = [
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

export function getRandomCollabColor(): string {
  return COLLAB_COLORS[Math.floor(Math.random() * COLLAB_COLORS.length)];
}

export function deriveRoomId(explicitId?: string): string {
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

    const search = window.location.search || '';
    if (search.length > 1) {
      const searchParams = new URLSearchParams(search);
      const docFromSearch = searchParams.get('doc') || searchParams.get('id') || searchParams.get('room');
      if (docFromSearch) return docFromSearch;
    }
  }

  return 'google-docs-demo';
}

export const LOCAL_SIGNALING_SERVER = 'ws://localhost:4444';

export const DEFAULT_SIGNALING_SERVERS: readonly string[] = [
  'wss://signaling.yjs.dev',
  'wss://y-webrtc-signaling-eu.herokuapp.com',
  'wss://y-webrtc-signaling-us.herokuapp.com'
];

export interface UseYjsDocConfig {
  docId?: string;
  user?: Partial<UserProfile>;
  role?: UserRole;
  quill?: Quill | null;
  signaling?: string[] | readonly string[];
  password?: string | null;
  disablePersistence?: boolean;
}

export function useYjsDoc(config: UseYjsDocConfig | string = {}) {
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

  const roomId = useMemo(() => deriveRoomId(propDocId), [propDocId]);

  const [currentUser, setCurrentUser] = useState<UserProfile>(() => ({
    id: propUser.id || `user_${Math.random().toString(36).substring(2, 9)}`,
    name: propUser.name || 'Anonymous Collaborator',
    color: propUser.color || getRandomCollabColor(),
    email: propUser.email || '',
    avatar: propUser.avatar || null,
    role: (propUser.role as UserRole) || propRole || 'editor'
  }));

  useEffect(() => {
    if (propUser && Object.keys(propUser).length > 0) {
      setCurrentUser(prev => ({
        ...prev,
        ...propUser,
        role: (propUser.role as UserRole) || propRole || prev.role
      }));
    }
  }, [propUser, propRole]);

  const [quillInstance, setQuillInstance] = useState<Quill | null>(propQuill);
  useEffect(() => {
    if (propQuill) {
      setQuillInstance(propQuill);
    }
  }, [propQuill]);

  const [collaborators, setCollaborators] = useState<CollaboratorPeer[]>([]);
  const [permissions, setPermissions] = useState<Record<string, UserRole>>({});
  const [accessRequests, setAccessRequests] = useState<AccessRequestItem[]>([]);
  const [isSynced, setIsSynced] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);
  const [docTitle, setDocTitle] = useState<string>('Untitled Document');

  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebrtcProvider | null>(null);
  const persistenceRef = useRef<IndexeddbPersistence | null>(null);
  const bindingRef = useRef<QuillBinding | null>(null);
  const undoManagerRef = useRef<Y.UndoManager | null>(null);

  useEffect(() => {
    const roomName = `gdocs_${roomId}`;
    const ydoc = new Y.Doc({ guid: roomName });
    ydocRef.current = ydoc;

    let persistence: IndexeddbPersistence | null = null;
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

    const provider = new WebrtcProvider(roomName, ydoc, {
      signaling: (signaling && signaling.length > 0 ? signaling : DEFAULT_SIGNALING_SERVERS) as string[],
      password: password,
      maxConns: 30,
      filterBcConns: true
    });
    providerRef.current = provider;

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

    const handleAwarenessChange = () => {
      const states = awareness.getStates();
      const peerList: CollaboratorPeer[] = [];

      states.forEach((state: any, clientId: number) => {
        if (state && state.user) {
          peerList.push({
            id: state.user.id || `peer_${clientId}`,
            name: state.user.name || `Collaborator ${clientId}`,
            color: state.user.color || '#4285F4',
            email: state.user.email || '',
            avatar: state.user.avatar || null,
            role: state.user.role || 'editor',
            isSelf: clientId === ydoc.clientID,
            lastSeen: Date.now(),
            selection: state.selection,
            cursorRange: state.cursorRange,
            cursorCoords: state.cursorCoords
          });
        }
      });

      peerList.sort((a, b) => {
        if (a.isSelf) return -1;
        if (b.isSelf) return 1;
        return (a.name || '').localeCompare(b.name || '');
      });

      setCollaborators(peerList);
    };

    awareness.on('change', handleAwarenessChange);
    handleAwarenessChange();

    const handleStatus = (event: any) => {
      setIsConnected(Boolean(event.connected));
    };
    const handleSynced = (event: any) => {
      if (event.synced !== undefined) {
        setIsSynced(Boolean(event.synced));
      }
    };

    (provider as any).on('status', handleStatus);
    (provider as any).on('synced', handleSynced);

    const permissionsMap = ydoc.getMap('permissions');
    const handlePermissionsChange = () => {
      const permsObj = permissionsMap.toJSON();
      setPermissions(permsObj);

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

    const accessRequestsArray = ydoc.getArray<AccessRequestItem>('accessRequests');
    const handleAccessRequestsChange = () => {
      setAccessRequests(accessRequestsArray.toArray());
    };

    accessRequestsArray.observe(handleAccessRequestsChange);
    handleAccessRequestsChange();

    const metaMap = ydoc.getMap('meta');
    const handleMetaChange = () => {
      const storedTitle = metaMap.get('title') as string;
      if (storedTitle) {
        setDocTitle(storedTitle);
      }
    };
    metaMap.observe(handleMetaChange);
    handleMetaChange();

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

    return () => {
      if (bindingRef.current) {
        try {
          bindingRef.current.destroy();
        } catch (_e) {}
        bindingRef.current = null;
      }

      awareness.off('change', handleAwarenessChange);
      (provider as any).off('status', handleStatus);
      (provider as any).off('synced', handleSynced);
      permissionsMap.unobserve(handlePermissionsChange);
      accessRequestsArray.unobserve(handleAccessRequestsChange);
      metaMap.unobserve(handleMetaChange);
      undoManager.destroy();

      try {
        provider.destroy();
      } catch (_e) {}

      if (persistence) {
        try {
          persistence.destroy();
        } catch (_e) {}
      }

      try {
        ydoc.destroy();
      } catch (_e) {}

      ydocRef.current = null;
      providerRef.current = null;
      persistenceRef.current = null;
      undoManagerRef.current = null;
    };
  }, [roomId, disablePersistence, password, signaling, currentUser.id, currentUser.name, currentUser.color, currentUser.email, currentUser.avatar, currentUser.role]);

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

  useEffect(() => {
    if (!quillInstance || !ydocRef.current || !providerRef.current) {
      return;
    }

    const ydoc = ydocRef.current;
    const provider = providerRef.current;
    const ytext = ydoc.getText('quill');

    if (bindingRef.current) {
      try {
        bindingRef.current.destroy();
      } catch (_e) {}
      bindingRef.current = null;
    }

    try {
      const binding = new QuillBinding(ytext, quillInstance, provider.awareness);
      bindingRef.current = binding;

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
        } catch (_e) {}
        bindingRef.current = null;
      }
    };
  }, [quillInstance]);

  const effectiveRole = useMemo(() => {
    if (currentUser.id && permissions[currentUser.id]) {
      return permissions[currentUser.id] as UserRole;
    }
    return (currentUser.role || propRole || 'editor') as UserRole;
  }, [currentUser.id, currentUser.role, permissions, propRole]);

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

  const requestEditAccess = useCallback((reason = 'Requesting edit access to collaborate') => {
    const ydoc = ydocRef.current;
    if (!ydoc) return;

    const accessRequestsArray = ydoc.getArray('accessRequests');
    const existingRequests = accessRequestsArray.toArray();

    const existingIndex = existingRequests.findIndex(
      (req: any) => req.userId === currentUser.id && req.status === 'pending'
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

  const grantEditAccess = useCallback((targetUserId: string, newRole: UserRole = 'editor') => {
    const ydoc = ydocRef.current;
    if (!ydoc || !targetUserId) return;

    const permissionsMap = ydoc.getMap('permissions');
    const accessRequestsArray = ydoc.getArray('accessRequests');

    ydoc.transact(() => {
      permissionsMap.set(targetUserId, newRole);

      const requests = accessRequestsArray.toArray();
      requests.forEach((req: any, index: number) => {
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

  const rejectEditAccess = useCallback((targetUserId: string) => {
    const ydoc = ydocRef.current;
    if (!ydoc || !targetUserId) return;

    const accessRequestsArray = ydoc.getArray('accessRequests');

    ydoc.transact(() => {
      const requests = accessRequestsArray.toArray();
      requests.forEach((req: any, index: number) => {
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

  const setPermission = useCallback((targetUserId: string, role: string | null) => {
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

  const setTitle = useCallback((newTitle: string) => {
    const ydoc = ydocRef.current;
    if (!ydoc || typeof newTitle !== 'string') return;

    const metaMap = ydoc.getMap('meta');
    metaMap.set('title', newTitle);
    setDocTitle(newTitle);
  }, []);

  const setUser = useCallback((updatedFields: Partial<UserProfile> = {}) => {
    setCurrentUser(prev => ({
      ...prev,
      ...updatedFields
    }));
  }, []);

  const undo = useCallback(() => {
    if (undoManagerRef.current && canUndo) {
      undoManagerRef.current.undo();
    }
  }, [canUndo]);

  const redo = useCallback(() => {
    if (undoManagerRef.current && canRedo) {
      undoManagerRef.current.redo();
    }
  }, [canRedo]);

  const bindQuill = useCallback((quill: any) => {
    setQuillInstance(quill);
  }, []);

  return {
    roomId,
    ydoc: ydocRef.current,
    provider: providerRef.current,
    awareness: providerRef.current?.awareness || null,
    persistence: persistenceRef.current,
    binding: bindingRef.current,
    ytext: ydocRef.current ? ydocRef.current.getText('quill') : null,
    undoManager: undoManagerRef.current,

    isSynced,
    isConnected,
    docTitle,
    setTitle,

    collaborators,
    currentUser,
    setUser,

    role: effectiveRole,
    permissions,
    accessRequests,
    canEdit,
    canComment,
    canManagePermissions,

    requestEditAccess,
    grantEditAccess,
    rejectEditAccess,
    setPermission,

    bindQuill,
    undo,
    redo,
    canUndo,
    canRedo
  };
}

export default useYjsDoc;
