import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import Quill from 'quill';
import QuillCursors from 'quill-cursors';

import 'quill/dist/quill.snow.css';
import './collab/remoteCursors.css';

import Header from './components/Header.tsx';
import Toolbar from './components/Toolbar.tsx';
import Ruler from './components/Ruler.tsx';
import ShareModal from './components/ShareModal.tsx';
import AccessRequestToast from './components/AccessRequestToast.tsx';
import AuthModal from './components/AuthModal.tsx';
import DocumentDashboard from './components/DocumentDashboard.tsx';

import { parseShareUrl, generateShareUrl } from './permissions/share.ts';
import { ROLES, normalizeRole } from './permissions/manager.ts';
import { FormatPainter } from './core/editor.ts';
import { DocumentExporter } from './export/exporter.ts';
import { authManager } from './auth/authManager.ts';
import { WebrtcProvider } from 'y-webrtc';

import { Eye, X } from 'lucide-react';
import type { UserProfile, UserRole, RulerMargins, CollaboratorPeer, AccessRequestItem, DocumentComment } from './types/index.ts';

try {
  Quill.register('modules/cursors', QuillCursors, true);
} catch (_e) {}

const COLLAB_COLORS: readonly string[] = [
  '#ea4335', '#34a853', '#e91e63', '#1a73e8',
  '#fbbc05', '#9c27b0', '#ff6d00', '#00897b'
];

function getCollaboratorColor(name: string, role?: string): string {
  if (!name) return '#1a73e8';
  const lower = name.toLowerCase();
  if (lower.includes('bob')) return '#34a853';
  if (lower.includes('alice')) return '#ea4335';
  if (lower.includes('christine') || lower.includes('charlie')) return '#e91e63';
  if (lower.includes('aditya') || role === ROLES.OWNER) return '#1a73e8';
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLLAB_COLORS[Math.abs(hash) % COLLAB_COLORS.length];
}

export default function App() {
  const [docId, setDocId] = useState<string>('project_2026_demo');
  const [title, setTitle] = useState<string>('Project Overview & Strategy 2026');
  const [isStarred, setIsStarred] = useState<boolean>(false);
  const [lastEditUser, setLastEditUser] = useState<string>('Alice');
  const [lastEditTime, setLastEditTime] = useState<string>('seconds ago');
  const [currentRole, setCurrentRole] = useState<UserRole>(ROLES.OWNER);
  const [currentUser, setCurrentUser] = useState<UserProfile>({
    id: 'user_aditya',
    name: 'Aditya',
    email: 'aditya@example.com',
    color: '#1a73e8',
    avatar: null,
    role: ROLES.OWNER,
    isGuest: false
  });
  const [collaborators, setCollaborators] = useState<CollaboratorPeer[]>([]);
  const [generalAccess, setGeneralAccess] = useState<'restricted' | 'anyone'>('restricted');
  const [generalRole, setGeneralRole] = useState<UserRole>('viewer');
  const [accessRequests, setAccessRequests] = useState<AccessRequestItem[]>([]);
  const [hasRequestedAccess, setHasRequestedAccess] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [theme, setTheme] = useState<string>('light');
  const [showRuler, setShowRuler] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(100);
  const [margins, setMargins] = useState<RulerMargins>({ top: 72, bottom: 72, left: 72, right: 72, firstLineIndent: 0 });
  const [formatPainterActive, setFormatPainterActive] = useState<boolean>(false);
  const [showFindReplace, setShowFindReplace] = useState<boolean>(false);
  const [findQuery, setFindQuery] = useState<string>('');
  const [replaceQuery, setReplaceQuery] = useState<string>('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isMandatoryAuth, setIsMandatoryAuth] = useState<boolean>(false);
  const [comments, setComments] = useState<DocumentComment[]>([]);
  const [isDashboardOpen, setIsDashboardOpen] = useState<boolean>(false);


  const editorContainerRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const ytextRef = useRef<Y.Text | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const knownPeersRef = useRef<Map<string, CollaboratorPeer>>(new Map());
  const userProfileRef = useRef<UserProfile | null>(null);
  const formatPainterRef = useRef<FormatPainter>(new FormatPainter());

  const addLog = useCallback((category: string, message: string) => {
    console.log(`[${category}] ${new Date().toLocaleTimeString()} — ${message}`);
  }, []);

  useEffect(() => {
    // ── 1. Parse URL for user identity & doc ──────────────────────────────
    let initialDocId = 'demo';
    let initialRole = ROLES.OWNER;
    let initialName = '';

    if (typeof window !== 'undefined') {
      const parsed = parseShareUrl(window.location.href);
      if (parsed.docId) initialDocId = parsed.docId;
      if (parsed.role) initialRole = normalizeRole(parsed.role, ROLES.OWNER);
      if (parsed.user) initialName = parsed.user;
    }

    // Check if user is already signed in or saved in AuthManager
    const savedUser = authManager.getCurrentUser();
    let effectiveUser: UserProfile;

    if (savedUser) {
      effectiveUser = savedUser;
    } else {
      // First visit / new device: open mandatory sign-in gate
      setIsAuthModalOpen(true);
      setIsMandatoryAuth(true);

      if (!initialName) {
        initialName = initialRole === ROLES.OWNER ? 'Aditya' : `Collaborator_${Math.floor(Math.random() * 90 + 10)}`;
      }

      const userId = `user_${initialName.toLowerCase().replace(/\s+/g, '_')}_${Math.random().toString(36).slice(2, 6)}`;
      effectiveUser = {
        id: userId,
        name: initialName,
        email: `${initialName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
        color: getCollaboratorColor(initialName, initialRole),
        avatar: null,
        role: initialRole,
        isGuest: true
      };
      authManager.setCurrentUser(effectiveUser);
    }

    userProfileRef.current = effectiveUser;
    setDocId(initialDocId);
    setCurrentRole(initialRole);
    setCurrentUser(effectiveUser);

    addLog('SYSTEM_BOOT', `User '${effectiveUser.name}' (${initialRole}) in doc '${initialDocId}'`);

    // ── 2. Initialize Y.Doc ────────────────────────────────────────────────
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText('quill');
    const metaMap = ydoc.getMap('metadata');
    const accessRequestsArray = ydoc.getArray('accessRequests');

    ydocRef.current = ydoc;
    ytextRef.current = ytext;

    // ── 3. Restore from localStorage BEFORE channel opens ─────────────────
    try {
      const saved = localStorage.getItem(`gdocs_ydoc_${initialDocId}`);
      if (saved) {
        const bytes = new Uint8Array(JSON.parse(saved));
        Y.applyUpdate(ydoc, bytes, 'storage_restore');
        const restoredText = ytext.toString();
        addLog('STORAGE_RESTORE', `Restored ${ytext.length} chars: "${restoredText.slice(0, 40)}"`);
      }
    } catch (e: unknown) {
      addLog('ERROR', `Storage restore failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    // ── 4. Open BroadcastChannel & WebRTC Signaling Mesh ─────────────────
    const channelName = `gdocs_crdt_channel_${initialDocId}`;
    const channel = new BroadcastChannel(channelName);
    channelRef.current = channel;
    addLog('CHANNEL_READY', `BroadcastChannel '${channelName}'`);

    let webrtcProvider: WebrtcProvider | null = null;
    try {
      webrtcProvider = new WebrtcProvider(`gdocs_room_${initialDocId}`, ydoc, {
        signaling: [
          'wss://signaling.yjs.dev',
          'wss://y-webrtc-signaling-eu.herokuapp.com',
          'wss://y-webrtc-signaling-us.herokuapp.com'
        ]
      });
      webrtcProvider.awareness.setLocalStateField('user', effectiveUser);
      addLog('WEBRTC_READY', `WebRTC signaling mesh active on 'gdocs_room_${initialDocId}'`);

      webrtcProvider.awareness.on('change', () => {
        if (!webrtcProvider) return;
        const states = webrtcProvider.awareness.getStates() as Map<number, { user?: Partial<UserProfile> }>;
        states.forEach((state) => {
          if (state.user && state.user.id && state.user.id !== effectiveUser.id) {
            knownPeersRef.current.set(state.user.id, {
              id: state.user.id,
              name: state.user.name || 'Collaborator',
              email: state.user.email || '',
              color: state.user.color || '#4285F4',
              avatar: state.user.avatar || null,
              role: state.user.role || 'editor',
              isSelf: false,
              lastSeen: Date.now()
            });
          }
        });
        updateRoster();
      });
    } catch (e) {
      console.warn('WebRTC mesh fallback:', e);
    }

    // ── 5. Peer roster management ──────────────────────────────────────────
    knownPeersRef.current.set(effectiveUser.id, { ...effectiveUser, isSelf: true, lastSeen: Date.now() });

    const updateRoster = () => {
      const now = Date.now();
      const active: CollaboratorPeer[] = [];
      knownPeersRef.current.forEach((peer, id) => {
        if (peer.isSelf || now - (peer.lastSeen || 0) < 12000) {
          active.push(peer);
        } else {
          knownPeersRef.current.delete(id);
        }
      });
      setCollaborators(active);
    };

    // ── 6. PIPELINE A: Y.Doc update → Save to localStorage + Broadcast ────
    ydoc.on('update', (update: Uint8Array, origin: unknown) => {
      try {
        const state = Y.encodeStateAsUpdate(ydoc);
        localStorage.setItem(`gdocs_ydoc_${initialDocId}`, JSON.stringify(Array.from(state)));

        // Update metadata index for user
        const currentTitle = metaMap.get('title') as string || title;
        authManager.saveDocumentMetadata(initialDocId, {
          id: initialDocId,
          title: currentTitle,
          lastModified: Date.now(),
          snippet: ytext.toString().slice(0, 80)
        }, userProfileRef.current?.id);
      } catch (_e) {}

      if (
        origin !== 'remote_handshake' &&
        origin !== 'remote_delta' &&
        origin !== 'storage_restore'
      ) {
        channel.postMessage({
          type: 'CRDT_DELTA',
          clientId: userProfileRef.current?.id || effectiveUser.id,
          user: userProfileRef.current || effectiveUser,
          update: Array.from(update)
        });
        addLog('DELTA_SEND', `Sent ${update.length}B. YText="${ytext.toString().slice(0, 40)}"`);
      }
    });

    // ── 7. PIPELINE B: BroadcastChannel → Y.Doc (inbound sync) ───────────
    channel.onmessage = ({ data: msg }: MessageEvent) => {
      if (!msg || msg.clientId === (userProfileRef.current?.id || effectiveUser.id)) return;

      if (msg.user) {
        knownPeersRef.current.set(msg.clientId, {
          ...msg.user, isSelf: false, lastSeen: Date.now()
        });
        updateRoster();
      }

      switch (msg.type) {
        case 'SYNC_STEP_1': {
          const sv = new Uint8Array(msg.stateVector);
          const diff = Y.encodeStateAsUpdate(ydoc, sv);
          addLog('HANDSHAKE_IN', `SYNC_STEP_1 from ${msg.user?.name}. Diff=${diff.length}B`);
          channel.postMessage({
            type: 'SYNC_STEP_2',
            targetId: msg.clientId,
            clientId: userProfileRef.current?.id || effectiveUser.id,
            user: userProfileRef.current || effectiveUser,
            update: Array.from(diff)
          });
          break;
        }

        case 'SYNC_STEP_2': {
          if (msg.targetId !== (userProfileRef.current?.id || effectiveUser.id) || !msg.update) break;
          try {
            Y.applyUpdate(ydoc, new Uint8Array(msg.update), 'remote_handshake');
            addLog('HANDSHAKE_APPLY', `Got SYNC_STEP_2 (${msg.update.length}B) from ${msg.user?.name}`);
          } catch (e: unknown) {
            addLog('ERROR', `SYNC_STEP_2 apply failed: ${e instanceof Error ? e.message : String(e)}`);
          }
          break;
        }

        case 'CRDT_DELTA': {
          if (!msg.update) break;
          try {
            Y.applyUpdate(ydoc, new Uint8Array(msg.update), 'remote_delta');
            addLog('DELTA_RECV', `From ${msg.user?.name}: "${ytext.toString().slice(0, 40)}"`);
          } catch (e: unknown) {
            addLog('ERROR', `CRDT_DELTA apply failed: ${e instanceof Error ? e.message : String(e)}`);
          }
          break;
        }

        case 'REMOTE_CURSOR': {
          if (!quillRef.current) break;
          const cursors = quillRef.current.getModule('cursors') as { createCursor?: Function; moveCursor?: Function; update?: Function; removeCursor?: Function } | null;
          if (!cursors) break;
          try {
            if (msg.range) {
              cursors.createCursor?.(msg.clientId, msg.user?.name, msg.user?.color);
              cursors.moveCursor?.(msg.clientId, msg.range);
              cursors.update?.();
              addLog('CURSOR_RECV', `${msg.user?.name} at [${msg.range.index}, len:${msg.range.length}]`);
            } else {
              cursors.removeCursor?.(msg.clientId);
              cursors.update?.();
            }
          } catch (e: unknown) {
            addLog('CURSOR_ERR', `Cursor render failed: ${e instanceof Error ? e.message : String(e)}`);
          }
          break;
        }

        case 'COMMENTS_UPDATE': {
          if (Array.isArray(msg.comments)) {
            setComments(msg.comments);
          }
          break;
        }

        case 'HEARTBEAT': {
          if (msg.user && msg.clientId !== (userProfileRef.current?.id || effectiveUser.id)) {
            knownPeersRef.current.set(msg.clientId, {
              id: msg.clientId,
              name: msg.user.name || 'Collaborator',
              email: msg.user.email || '',
              color: msg.user.color || '#4285F4',
              avatar: msg.user.avatar || null,
              role: msg.user.role || 'editor',
              isSelf: false,
              lastSeen: Date.now()
            });
            updateRoster();
          }
          break;
        }
      }
    };

    // ── 8. PIPELINE C: Y.Text observe → Update Quill view ────────────────
    ytext.observe(event => {
      const currentStr = ytext.toString();

      if (
        event.transaction.origin === 'remote_delta' ||
        event.transaction.origin === 'remote_handshake' ||
        event.transaction.origin === 'storage_restore'
      ) {
        addLog('VIEW_SYNC', `Remote update: "${currentStr.slice(0, 40)}"`);
        if (quillRef.current) {
          const quill = quillRef.current;
          const savedRange = quill.getSelection();
          const currentQuillText = quill.getText().replace(/\n$/, '');
          if (currentQuillText !== currentStr) {
            quill.setText(currentStr, 'api');
          }
          if (savedRange) {
            const safeIndex = Math.min(savedRange.index, quill.getLength() - 1);
            quill.setSelection(safeIndex, savedRange.length, 'api');
          }
          const cursors = quill.getModule('cursors') as { update?: Function } | null;
          if (cursors?.update) cursors.update();
        }
      }
    });

    // ── 9. Initialize Quill ────────────────────────────────────────────────
    if (editorContainerRef.current) {
      editorContainerRef.current.innerHTML = '';

      const quill = new Quill(editorContainerRef.current, {
        theme: 'snow',
        placeholder: 'Type @ to insert or start typing...',
        modules: {
          toolbar: false,
          cursors: {
            transformOnTextChange: true
          },
          history: { userOnly: true }
        },
        readOnly: initialRole === ROLES.VIEWER || initialRole === ROLES.COMMENTER
      });
      quillRef.current = quill;
      addLog('QUILL_READY', `Editor initialized (readOnly: ${quill.options.readOnly})`);

      const restoredText = ytext.toString();
      if (restoredText.length > 0) {
        quill.setText(restoredText, 'api');
        addLog('QUILL_PREPOPULATE', `Pre-filled Quill with ${restoredText.length} restored chars`);
      }

      quill.on('text-change', (delta: { ops?: unknown[] }, _oldDelta: unknown, source: string) => {
        if (source === 'user' && delta.ops) {
          ydoc.transact(() => {
            ytext.applyDelta(delta.ops as Parameters<typeof ytext.applyDelta>[0]);
          }, 'user_input');

          const currentTxt = quill.getText().replace(/\n$/, '');
          const currentUserVal = userProfileRef.current || effectiveUser;
          metaMap.set('lastEditUser', currentUserVal.name);
          metaMap.set('lastEditTime', 'seconds ago');
          setLastEditUser(currentUserVal.name);
          setLastEditTime('seconds ago');
          addLog('USER_INPUT', `Typed: "${currentTxt.slice(0, 40)}"`);

          channel.postMessage({
            type: 'REMOTE_CURSOR',
            clientId: currentUserVal.id,
            user: currentUserVal,
            range: quill.getSelection()
          });
        }
      });

      quill.on('selection-change', (range: { index: number; length: number } | null) => {
        const currentUserVal = userProfileRef.current || effectiveUser;
        channel.postMessage({
          type: 'REMOTE_CURSOR',
          clientId: currentUserVal.id,
          user: currentUserVal,
          range
        });
      });
    }

    // ── 10. Initial SYNC_STEP_1 announcement ──────────────────────────────
    const sv = Y.encodeStateVector(ydoc);
    channel.postMessage({
      type: 'SYNC_STEP_1',
      clientId: effectiveUser.id,
      user: effectiveUser,
      stateVector: Array.from(sv)
    });

    // ── 11. Heartbeat for presence ─────────────────────────────────────────
    const heartbeatInterval = setInterval(() => {
      const currentUserVal = userProfileRef.current || effectiveUser;
      channel.postMessage({ type: 'HEARTBEAT', clientId: currentUserVal.id, user: currentUserVal });
      updateRoster();
    }, 2000);
    updateRoster();

    // ── 12. Metadata observer ──────────────────────────────────────────────
    metaMap.observe(() => {
      const t = metaMap.get('title') as string; if (t) setTitle(t);
      const s = metaMap.get('starred') as boolean; if (s !== undefined) setIsStarred(s);
      const lu = metaMap.get('lastEditUser') as string; if (lu) setLastEditUser(lu);
      const lt = metaMap.get('lastEditTime') as string; if (lt) setLastEditTime(lt);
      const ga = metaMap.get('generalAccess') as 'restricted' | 'anyone'; if (ga) setGeneralAccess(ga);
      const gr = metaMap.get('generalRole') as UserRole; if (gr) setGeneralRole(gr);
    });

    // ── 13. Access requests observer ──────────────────────────────────────
    accessRequestsArray.observe(() => {
      const reqs = accessRequestsArray.toArray() as AccessRequestItem[];
      setAccessRequests(reqs.filter(r => r.status === 'pending'));
      const approved = reqs.find(r => r.userId === (userProfileRef.current?.id || effectiveUser.id) && r.status === 'approved');
      if (approved) {
        setCurrentRole(ROLES.EDITOR);
        if (userProfileRef.current) userProfileRef.current.role = ROLES.EDITOR;
        if (quillRef.current) quillRef.current.enable(true);
        addLog('PERMISSIONS', 'Elevated to EDITOR');
      }
    });

    // ── CLEANUP ────────────────────────────────────────────────────────────
    return () => {
      addLog('CLEANUP', 'Engine destroyed');
      clearInterval(heartbeatInterval);
      if (webrtcProvider) webrtcProvider.destroy();
      channel.close();
      ydoc.destroy();
      if (channelRef.current === channel) channelRef.current = null;
      if (ydocRef.current === ydoc) ydocRef.current = null;
      if (ytextRef.current === ytext) ytextRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Event Handlers ────────────────────────────────────────────────────────
  const handleTitleChange = useCallback((newTitle: string) => {
    setTitle(newTitle);
    ydocRef.current?.getMap('metadata').set('title', newTitle);
  }, []);

  const handleToggleStar = useCallback(() => {
    const next = !isStarred;
    setIsStarred(next);
    ydocRef.current?.getMap('metadata').set('starred', next);
  }, [isStarred]);

  const handleToggleFormatPainter = useCallback(() => {
    if (!quillRef.current) return;
    if (!formatPainterActive) {
      const range = quillRef.current.getSelection();
      if (range) {
        formatPainterRef.current.copyFormat(quillRef.current.getFormat(range.index, range.length));
        setFormatPainterActive(true);
      }
    } else {
      formatPainterRef.current.clear();
      setFormatPainterActive(false);
    }
  }, [formatPainterActive]);

  const handleRequestAccess = useCallback(() => {
    if (!ydocRef.current || hasRequestedAccess || !userProfileRef.current) return;
    const user = userProfileRef.current;
    ydocRef.current.getArray('accessRequests').push([{
      id: `req_${Date.now()}`,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      avatarColor: user.color,
      timestamp: 'Just now',
      status: 'pending'
    }]);
    setHasRequestedAccess(true);
    addLog('REQUEST', 'Submitted edit access request');
  }, [hasRequestedAccess, addLog]);

  const handleApproveAccessRequest = useCallback((reqId: string) => {
    if (!ydocRef.current) return;
    const arr = ydocRef.current.getArray<AccessRequestItem>('accessRequests');
    const list = arr.toArray();
    const req = list.find(r => r.id === reqId);
    if (req) {
      ydocRef.current.getMap('permissions').set(req.userId, ROLES.EDITOR);
      arr.delete(0, list.length);
      arr.push(list.map(r => r.id === reqId ? { ...r, status: 'approved' } : r));
      addLog('PERMISSIONS', `Approved access for ${req.userName}`);
    }
  }, [addLog]);

  const handleDenyAccessRequest = useCallback((reqId: string) => {
    if (!ydocRef.current) return;
    const arr = ydocRef.current.getArray<AccessRequestItem>('accessRequests');
    const list = arr.toArray().filter(r => r.id !== reqId);
    arr.delete(0, arr.length);
    arr.push(list);
  }, []);

  const handleFindNext = useCallback(() => {
    if (!quillRef.current || !findQuery) return;
    const text = quillRef.current.getText();
    const idx = text.toLowerCase().indexOf(findQuery.toLowerCase());
    if (idx >= 0) quillRef.current.setSelection(idx, findQuery.length);
  }, [findQuery]);

  const handleReplaceCurrent = useCallback(() => {
    if (!quillRef.current || !findQuery) return;
    const range = quillRef.current.getSelection();
    if (range && range.length > 0) {
      quillRef.current.deleteText(range.index, range.length);
      quillRef.current.insertText(range.index, replaceQuery);
      handleFindNext();
    }
  }, [findQuery, replaceQuery, handleFindNext]);

  const handleUpdateProfile = useCallback(({ name, color }: { name: string; color: string }) => {
    const updated = authManager.updateProfile({ name, color });
    setCurrentUser(updated);
    userProfileRef.current = updated;
    if (channelRef.current) {
      channelRef.current.postMessage({
        type: 'REMOTE_CURSOR',
        clientId: updated.id,
        user: updated,
        range: quillRef.current?.getSelection() || null
      });
    }
    addLog('PROFILE', `Updated display name to '${name}'`);
  }, [addLog]);

  const handleAuthSuccess = useCallback((user: UserProfile) => {
    setCurrentUser(user);
    userProfileRef.current = user;
    setIsMandatoryAuth(false);
    setIsAuthModalOpen(false);
    if (channelRef.current) {
      channelRef.current.postMessage({
        type: 'REMOTE_CURSOR',
        clientId: user.id,
        user: user,
        range: quillRef.current?.getSelection() || null
      });
    }
    addLog('AUTH', `Signed in as '${user.name}' (${user.email})`);
  }, [addLog]);

  const handleLogout = useCallback(() => {
    authManager.logout();
    setIsMandatoryAuth(true);
    setIsAuthModalOpen(true);
    addLog('AUTH', 'Signed out. Prompting sign in.');
  }, [addLog]);

  const handleOpenDocument = useCallback((selectedDocId: string) => {
    const currentUrl = new URL(window.location.href);
    currentUrl.hash = `#doc=${selectedDocId}&role=editor&user=${encodeURIComponent(currentUser.name)}`;
    window.location.href = currentUrl.toString();
    window.location.reload();
  }, [currentUser]);

  const handleNewDocument = useCallback(() => {
    const newDocId = 'doc_' + Math.random().toString(36).substring(2, 9);
    const currentUrl = new URL(window.location.href);
    currentUrl.hash = `#doc=${newDocId}&role=owner&user=${encodeURIComponent(currentUser.name)}`;
    window.location.href = currentUrl.toString();
    window.location.reload();
  }, [currentUser]);

  const handleMenuAction = useCallback((action: string) => {
    if (action === 'new') {
      handleNewDocument();
    } else if (action === 'download_md') {
      const exporter = new DocumentExporter({ title, content: quillRef.current?.root.innerHTML || '' });
      exporter.download('md');
    } else if (action === 'download_html') {
      const exporter = new DocumentExporter({ title, content: quillRef.current?.root.innerHTML || '' });
      exporter.download('html');
    } else if (action === 'download_txt') {
      const exporter = new DocumentExporter({ title, content: quillRef.current?.root.innerHTML || '' });
      exporter.download('txt');
    } else if (action === 'download_docx') {
      const exporter = new DocumentExporter({ title, content: quillRef.current?.root.innerHTML || '' });
      exporter.download('docx');
    } else if (action === 'download_pdf') {
      window.print();
    }
  }, [title, handleNewDocument]);

  const isReadOnly = currentRole === ROLES.VIEWER || currentRole === ROLES.COMMENTER;

  return (
    <div className={`h-screen flex flex-col ${theme === 'dark' ? 'dark bg-[#1e1f20]' : 'bg-[#f0f4f9]'} font-sans select-none overflow-hidden transition-colors relative`}>
      <Header
        title={title}
        onTitleChange={handleTitleChange}
        isStarred={isStarred}
        onToggleStar={handleToggleStar}
        lastEditUser={lastEditUser}
        lastEditTime={lastEditTime}
        collaborators={collaborators}
        currentUser={currentUser}
        currentRole={currentRole}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        theme={theme}
        onToggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
        showRuler={showRuler}
        onToggleRuler={() => setShowRuler(r => !r)}
        onMenuAction={handleMenuAction}
        onOpenDashboard={() => setIsDashboardOpen(true)}
        onUpdateProfile={handleUpdateProfile}
        onOpenAuthModal={() => { setIsMandatoryAuth(false); setIsAuthModalOpen(true); }}
        onLogout={handleLogout}
      />

      {isReadOnly && (
        <div className="bg-[#feefe3] dark:bg-[#3c2a1e] border-b border-[#fcd0b3] px-4 sm:px-6 py-2 flex items-center justify-between text-xs text-[#8c3300]">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#d93025] flex-shrink-0" />
            <span><strong>Viewing only.</strong> You don't have edit permission.</span>
          </div>
          <button
            onClick={handleRequestAccess}
            disabled={hasRequestedAccess}
            className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-full font-medium transition-all text-xs flex-shrink-0 ${
              hasRequestedAccess ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-[#1a73e8] hover:bg-[#1557b0] text-white cursor-pointer'
            }`}
          >
            {hasRequestedAccess ? 'Access Requested…' : 'Request Edit Access'}
          </button>
        </div>
      )}

      <Toolbar
        quill={quillRef.current}
        isReadOnly={isReadOnly}
        formatPainterActive={formatPainterActive}
        onToggleFormatPainter={handleToggleFormatPainter}
        zoom={zoom}
        onZoomChange={setZoom}
        onOpenCommentBox={() => {}}
      />

      {showRuler && (
        <Ruler
          pageWidth={816}
          leftMargin={margins.left}
          rightMargin={margins.right}
          firstLineIndent={margins.firstLineIndent}
          onMarginsChange={(m) => setMargins(prev => ({ ...prev, ...m }))}
          isReadOnly={isReadOnly}
        />
      )}

      <main
        className="flex-1 overflow-y-auto p-2 sm:p-6 md:p-8 flex justify-center bg-[#f0f4f9] dark:bg-[#18191a] transition-transform origin-top"
        style={{ transform: `scale(${zoom / 100})` }}
      >
        <div
          className="page-canvas bg-white dark:bg-[#1e1f20] text-[#202124] dark:text-[#e3e3e3] min-h-[calc(100vh-140px)] sm:min-h-[1056px] w-full max-w-[816px] shadow-sm sm:shadow-[0_1px_3px_1px_rgba(60,64,67,0.15)] border sm:border-[#dadce0] dark:border-[#444746] rounded-xs sm:rounded-sm transition-colors"
          style={{
            paddingLeft: `${Math.max(16, margins.left)}px`,
            paddingRight: `${Math.max(16, margins.right)}px`,
            paddingTop: `${Math.max(24, margins.top ?? 72)}px`,
            paddingBottom: `${Math.max(24, margins.bottom ?? 72)}px`
          }}
        >
          <div ref={editorContainerRef} className="min-h-[400px] sm:min-h-[900px] text-[15px] outline-none text-[#202124] dark:text-[#e3e3e3]" />
        </div>
      </main>

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        docTitle={title}
        owner={{ name: currentUser.name, email: currentUser.email }}
        collaborators={collaborators}
        generalAccess={generalAccess}
        generalRole={generalRole}
        onUpdateGeneralAccess={acc => { setGeneralAccess(acc); ydocRef.current?.getMap('metadata').set('generalAccess', acc); }}
        onUpdateGeneralRole={role => { setGeneralRole(role); ydocRef.current?.getMap('metadata').set('generalRole', role); }}
        onAddCollaborator={c => ydocRef.current?.getMap('permissions').set(c.name, c.role)}
        onUpdateCollaboratorRole={(id, role) => ydocRef.current?.getMap('permissions').set(id, role)}
        onRemoveCollaborator={id => ydocRef.current?.getMap('permissions').delete(id)}
        shareUrl={generateShareUrl({ docId, role: generalRole })}
      />

      <AccessRequestToast
        requests={accessRequests}
        onApprove={handleApproveAccessRequest}
        onDeny={handleDenyAccessRequest}
        onDismiss={id => setAccessRequests(prev => prev.filter(r => r.id !== id))}
      />

      {showFindReplace && (
        <div className="fixed top-20 sm:top-24 right-4 sm:right-12 z-50 bg-white dark:bg-[#282a2c] rounded-xl shadow-xl border border-[#e0e2e0] dark:border-[#444746] p-4 max-w-[calc(100vw-2rem)] w-80 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700">
            <span className="font-semibold text-sm text-gray-900 dark:text-white">Find and replace</span>
            <button onClick={() => setShowFindReplace(false)} className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-col gap-2 mt-3">
            <input
              type="text"
              placeholder="Find"
              value={findQuery}
              onChange={e => setFindQuery(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-transparent outline-none focus:border-blue-500 text-gray-900 dark:text-white"
            />
            <input
              type="text"
              placeholder="Replace with"
              value={replaceQuery}
              onChange={e => setReplaceQuery(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-transparent outline-none focus:border-blue-500 text-gray-900 dark:text-white"
            />
            <div className="flex items-center justify-end gap-2 mt-2">
              <button
                onClick={handleFindNext}
                className="px-3 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded font-medium text-gray-800 dark:text-gray-200 cursor-pointer"
              >
                Next
              </button>
              <button
                onClick={handleReplaceCurrent}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium cursor-pointer"
              >
                Replace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Authentication & Profile Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        isMandatory={isMandatoryAuth}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Google Docs Home Dashboard ("My Documents" Library) */}
      {isDashboardOpen && (
        <DocumentDashboard
          onOpenDocument={handleOpenDocument}
          onNewDocument={handleNewDocument}
          onClose={() => setIsDashboardOpen(false)}
        />
      )}
    </div>
  );
}
