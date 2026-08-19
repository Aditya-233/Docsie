import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import Quill from 'quill';
import QuillCursors from 'quill-cursors';

import 'quill/dist/quill.snow.css';
import 'quill-cursors/css';
import './collab/remoteCursors.css';

import Header from './components/Header.jsx';
import Toolbar from './components/Toolbar.jsx';
import Ruler from './components/Ruler.jsx';
import ShareModal from './components/ShareModal.jsx';
import AccessRequestToast from './components/AccessRequestToast.jsx';

import { parseShareUrl, generateShareUrl } from './permissions/share.js';
import { ROLES, normalizeRole } from './permissions/manager.js';
import { FormatPainter } from './core/editor.js';
import { DocumentExporter } from './export/exporter.js';
import { WebrtcProvider } from 'y-webrtc';

import { Eye, Wifi, Copy, RefreshCw, ChevronDown, ChevronUp, X } from 'lucide-react';

// Register QuillCursors once at module level (safe from StrictMode re-runs)
try {
    Quill.register('modules/cursors', QuillCursors, true);
} catch (_) {}

const COLLAB_COLORS = [
    '#ea4335', '#34a853', '#e91e63', '#1a73e8',
    '#fbbc05', '#9c27b0', '#ff6d00', '#00897b'
];

function getCollaboratorColor(name, role) {
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
    const [docId, setDocId] = useState('demo');
    const [title, setTitle] = useState('Project Overview & Strategy 2026');
    const [isStarred, setIsStarred] = useState(false);
    const [lastEditUser, setLastEditUser] = useState('Alice');
    const [lastEditTime, setLastEditTime] = useState('seconds ago');
    const [currentRole, setCurrentRole] = useState(ROLES.OWNER);
    const [currentUser, setCurrentUser] = useState({
        id: 'user_alice', name: 'Alice',
        email: 'alice@example.com', color: '#ea4335', avatar: null
    });
    const [collaborators, setCollaborators] = useState([]);
    const [generalAccess, setGeneralAccess] = useState('restricted');
    const [generalRole, setGeneralRole] = useState('viewer');
    const [accessRequests, setAccessRequests] = useState([]);
    const [hasRequestedAccess, setHasRequestedAccess] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [theme, setTheme] = useState('light');
    const [showRuler, setShowRuler] = useState(true);
    const [zoom, setZoom] = useState(100);
    const [margins, setMargins] = useState({ left: 72, right: 72, firstLineIndent: 0 });
    const [formatPainterActive, setFormatPainterActive] = useState(false);
    const [showDebugHUD, setShowDebugHUD] = useState(true);
    const [logs, setLogs] = useState([]);
    const [crdtTextPreview, setCrdtTextPreview] = useState('');
    const [quillTextPreview, setQuillTextPreview] = useState('');
    const [syncStats, setSyncStats] = useState({ peersCount: 1, updatesSent: 0, updatesReceived: 0 });
    const [showFindReplace, setShowFindReplace] = useState(false);
    const [findQuery, setFindQuery] = useState('');
    const [replaceQuery, setReplaceQuery] = useState('');

    const editorContainerRef = useRef(null);
    const quillRef = useRef(null);
    const ydocRef = useRef(null);
    const ytextRef = useRef(null);
    const channelRef = useRef(null);
    const knownPeersRef = useRef(new Map());
    const userProfileRef = useRef(null);
    const formatPainterRef = useRef(new FormatPainter());
    // StrictMode guard: prevent double-initialization
    const engineAliveRef = useRef(false);

    const addLog = useCallback((category, message) => {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${category}] ${timestamp} — ${message}`);
        setLogs(prev => [{ timestamp, category, message }, ...prev.slice(0, 99)]);
    }, []);

    const triggerSyncHandshake = useCallback(() => {
        if (!channelRef.current || !ydocRef.current || !userProfileRef.current) return;
        const sv = Y.encodeStateVector(ydocRef.current);
        channelRef.current.postMessage({
            type: 'SYNC_STEP_1',
            clientId: userProfileRef.current.id,
            user: userProfileRef.current,
            stateVector: Array.from(sv)
        });
        addLog('HANDSHAKE_OUT', 'Manually triggered SYNC_STEP_1');
    }, [addLog]);

    useEffect(() => {
        // ── STRICT MODE GUARD ──────────────────────────────────────────────────
        // React 18 StrictMode mounts → cleanup → remounts. We allow each mount
        // to run fully (each gets its own ydoc/channel) because the cleanup
        // correctly destroys the previous instance. Storage ensures continuity.
        // ──────────────────────────────────────────────────────────────────────

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

        if (!initialName) {
            initialName = sessionStorage.getItem('gdocs_user_name') ||
                (initialRole === ROLES.OWNER ? 'Alice' : `User${Math.floor(Math.random() * 90 + 10)}`);
            sessionStorage.setItem('gdocs_user_name', initialName);
        }

        let userId = sessionStorage.getItem('gdocs_user_id');
        if (!userId) {
            userId = `user_${initialName.toLowerCase().replace(/\s+/g, '_')}_${Math.random().toString(36).slice(2, 6)}`;
            sessionStorage.setItem('gdocs_user_id', userId);
        }

        const userProfile = {
            id: userId,
            name: initialName,
            email: `${initialName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
            color: getCollaboratorColor(initialName, initialRole),
            avatar: null,
            role: initialRole
        };
        userProfileRef.current = userProfile;
        setDocId(initialDocId);
        setCurrentRole(initialRole);
        setCurrentUser(userProfile);

        addLog('SYSTEM_BOOT', `User '${initialName}' (${initialRole}) in doc '${initialDocId}'`);

        // ── 2. Initialize Y.Doc ────────────────────────────────────────────────
        const ydoc = new Y.Doc();
        const ytext = ydoc.getText('quill');
        const metaMap = ydoc.getMap('metadata');
        const accessRequestsArray = ydoc.getArray('accessRequests');

        ydocRef.current = ydoc;
        ytextRef.current = ytext;

        // ── 3. Restore from localStorage BEFORE channel opens ─────────────────
        // (So SYNC_STEP_1 we broadcast includes restored content)
        try {
            const saved = localStorage.getItem(`gdocs_ydoc_${initialDocId}`);
            if (saved) {
                const bytes = new Uint8Array(JSON.parse(saved));
                Y.applyUpdate(ydoc, bytes, 'storage_restore');
                const restoredText = ytext.toString();
                addLog('STORAGE_RESTORE', `Restored ${ytext.length} chars: "${restoredText.slice(0, 40)}"`);
                setCrdtTextPreview(restoredText);
            }
        } catch (e) {
            addLog('ERROR', `Storage restore failed: ${e.message}`);
        }

        // ── 4. Open BroadcastChannel & WebRTC Signaling Mesh ─────────────────
        const channelName = `gdocs_crdt_channel_${initialDocId}`;
        const channel = new BroadcastChannel(channelName);
        channelRef.current = channel;
        addLog('CHANNEL_READY', `BroadcastChannel '${channelName}'`);

        // Initialize WebRTC Provider for internet cross-device collaboration
        let webrtcProvider = null;
        try {
            webrtcProvider = new WebrtcProvider(`gdocs_room_${initialDocId}`, ydoc, {
                signaling: [
                    'wss://signaling.yjs.dev',
                    'wss://y-webrtc-signaling-eu.herokuapp.com',
                    'wss://y-webrtc-signaling-us.herokuapp.com'
                ]
            });
            webrtcProvider.awareness.setLocalStateField('user', userProfile);
            addLog('WEBRTC_READY', `WebRTC signaling mesh active on 'gdocs_room_${initialDocId}'`);

            webrtcProvider.awareness.on('change', () => {
                const states = webrtcProvider.awareness.getStates();
                states.forEach((state) => {
                    if (state.user && state.user.id !== userProfile.id) {
                        knownPeersRef.current.set(state.user.id, {
                            ...state.user,
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
        knownPeersRef.current.set(userProfile.id, { ...userProfile, isSelf: true, lastSeen: Date.now() });

        const updateRoster = () => {
            const now = Date.now();
            const active = [];
            knownPeersRef.current.forEach((peer, id) => {
                if (peer.isSelf || now - peer.lastSeen < 12000) {
                    active.push(peer);
                } else {
                    knownPeersRef.current.delete(id);
                }
            });
            setCollaborators(active);
            setSyncStats(prev => ({ ...prev, peersCount: active.length }));
        };

        // ── 6. PIPELINE A: Y.Doc update → Save to localStorage + Broadcast ────
        // This is the proven pattern from CollabEngine tests.
        // Origin 'user_input' → broadcast CRDT_DELTA to all tabs
        // Origin 'remote_*' or 'storage_restore' → only save, do NOT re-broadcast
        ydoc.on('update', (update, origin) => {
            // Always persist
            try {
                const state = Y.encodeStateAsUpdate(ydoc);
                localStorage.setItem(`gdocs_ydoc_${initialDocId}`, JSON.stringify(Array.from(state)));
            } catch (e) {}

            // Only broadcast local changes
            if (
                origin !== 'remote_handshake' &&
                origin !== 'remote_delta' &&
                origin !== 'storage_restore'
            ) {
                channel.postMessage({
                    type: 'CRDT_DELTA',
                    clientId: userProfile.id,
                    user: userProfile,
                    update: Array.from(update)
                });
                setSyncStats(prev => ({ ...prev, updatesSent: prev.updatesSent + 1 }));
                addLog('DELTA_SEND', `Sent ${update.length}B. YText="${ytext.toString().slice(0, 40)}"`);
            }
        });

        // ── 7. PIPELINE B: BroadcastChannel → Y.Doc (inbound sync) ───────────
        channel.onmessage = ({ data: msg }) => {
            if (!msg || msg.clientId === userProfile.id) return;

            // Update peer roster on any message
            if (msg.user) {
                knownPeersRef.current.set(msg.clientId, {
                    ...msg.user, isSelf: false, lastSeen: Date.now()
                });
                updateRoster();
            }

            switch (msg.type) {
                case 'SYNC_STEP_1': {
                    // Remote peer joined — send them our full document diff
                    const sv = new Uint8Array(msg.stateVector);
                    const diff = Y.encodeStateAsUpdate(ydoc, sv);
                    addLog('HANDSHAKE_IN', `SYNC_STEP_1 from ${msg.user?.name}. Diff=${diff.length}B, our text="${ytext.toString().slice(0, 30)}"`);
                    // Always reply (even if diff is small — they need our state vector)
                    channel.postMessage({
                        type: 'SYNC_STEP_2',
                        targetId: msg.clientId,
                        clientId: userProfile.id,
                        user: userProfile,
                        update: Array.from(diff)
                    });
                    addLog('HANDSHAKE_OUT', `Replied SYNC_STEP_2 (${diff.length}B) to ${msg.user?.name}`);
                    break;
                }

                case 'SYNC_STEP_2': {
                    if (msg.targetId !== userProfile.id || !msg.update) break;
                    try {
                        Y.applyUpdate(ydoc, new Uint8Array(msg.update), 'remote_handshake');
                        setSyncStats(prev => ({ ...prev, updatesReceived: prev.updatesReceived + 1 }));
                        addLog('HANDSHAKE_APPLY', `Got SYNC_STEP_2 (${msg.update.length}B) from ${msg.user?.name}. YText="${ytext.toString().slice(0, 40)}"`);
                    } catch (e) {
                        addLog('ERROR', `SYNC_STEP_2 apply failed: ${e.message}`);
                    }
                    break;
                }

                case 'CRDT_DELTA': {
                    if (!msg.update) break;
                    try {
                        Y.applyUpdate(ydoc, new Uint8Array(msg.update), 'remote_delta');
                        setSyncStats(prev => ({ ...prev, updatesReceived: prev.updatesReceived + 1 }));
                        addLog('DELTA_RECV', `From ${msg.user?.name}: "${ytext.toString().slice(0, 40)}"`);
                    } catch (e) {
                        addLog('ERROR', `CRDT_DELTA apply failed: ${e.message}`);
                    }
                    break;
                }

                case 'REMOTE_CURSOR': {
                    if (!quillRef.current) break;
                    const cursors = quillRef.current.getModule('cursors');
                    if (!cursors) break;
                    try {
                        if (msg.range) {
                            // createCursor is idempotent — safe to call every time
                            cursors.createCursor(msg.clientId, msg.user?.name, msg.user?.color);
                            cursors.moveCursor(msg.clientId, msg.range);
                            // CRITICAL: must call update() to repaint DOM cursor positions
                            cursors.update();
                            addLog('CURSOR_RECV', `${msg.user?.name} at [${msg.range.index}, len:${msg.range.length}]`);
                        } else {
                            cursors.removeCursor(msg.clientId);
                            cursors.update();
                        }
                    } catch (e) {
                        addLog('CURSOR_ERR', `Cursor render failed: ${e.message}`);
                    }
                    break;
                }

                case 'HEARTBEAT':
                    break;
            }
        };

        // ── 8. PIPELINE C: Y.Text observe → Update Quill view (remote only) ───
        // CRITICAL: Only apply to Quill when origin is NOT 'user_input'.
        // If we call quill.setText/updateContents for 'user_input', it creates
        // a feedback loop: type → Y.Text → observe → setText → text-change(api)
        ytext.observe(event => {
            const currentStr = ytext.toString();
            setCrdtTextPreview(currentStr);

            if (
                event.transaction.origin === 'remote_delta' ||
                event.transaction.origin === 'remote_handshake' ||
                event.transaction.origin === 'storage_restore'
            ) {
                addLog('VIEW_SYNC', `Remote update: "${currentStr.slice(0, 40)}"`);
                if (quillRef.current) {
                    const quill = quillRef.current;
                    const savedRange = quill.getSelection();
                    // Use delta application to preserve formatting & minimize cursor jump
                    const currentQuillText = quill.getText().replace(/\n$/, '');
                    if (currentQuillText !== currentStr) {
                        quill.setText(currentStr, 'api');
                    }
                    if (savedRange) {
                        const safeIndex = Math.min(savedRange.index, quill.getLength() - 1);
                        quill.setSelection(safeIndex, savedRange.length, 'api');
                    }
                    // Reposition all remote cursor overlays after text layout changes
                    const cursors = quill.getModule('cursors');
                    if (cursors) cursors.update();
                }
                setQuillTextPreview(currentStr);
            }
        });

        // ── 9. Initialize Quill ────────────────────────────────────────────────
        if (editorContainerRef.current) {
            // Clean up any existing Quill instance from previous mount
            editorContainerRef.current.innerHTML = '';

            const quill = new Quill(editorContainerRef.current, {
                theme: 'snow',
                placeholder: 'Type @ to insert or start typing...',
                modules: {
                    toolbar: false,
                    cursors: true,
                    history: { userOnly: true }
                },
                readOnly: initialRole === ROLES.VIEWER || initialRole === ROLES.COMMENTER
            });
            quillRef.current = quill;
            addLog('QUILL_READY', `Editor initialized (readOnly: ${quill.options.readOnly})`);

            // Pre-populate Quill from restored Y.Text content
            const restoredText = ytext.toString();
            if (restoredText.length > 0) {
                quill.setText(restoredText, 'api');
                setQuillTextPreview(restoredText);
                addLog('QUILL_PREPOPULATE', `Pre-filled Quill with ${restoredText.length} restored chars`);
            }

            // ── PIPELINE A ENTRY: Quill user input → Y.Text transaction ────────
            // This is the CRITICAL path. source === 'user' means human typed.
            // We call ydoc.transact(..., 'user_input') so:
            //   a) Y.Doc updates → ydoc.on('update') fires → CRDT_DELTA broadcast
            //   b) ytext.observe sees origin='user_input' → does NOT call setText (no loop)
            quill.on('text-change', (delta, _oldDelta, source) => {
                const currentTxt = quill.getText().replace(/\n$/, '');
                setQuillTextPreview(currentTxt);

                if (source === 'user') {
                    // Transact with 'user_input' origin so observe can distinguish it
                    ydoc.transact(() => {
                        ytext.applyDelta(delta.ops);
                    }, 'user_input');

                    metaMap.set('lastEditUser', userProfile.name);
                    metaMap.set('lastEditTime', 'seconds ago');
                    setLastEditUser(userProfile.name);
                    setLastEditTime('seconds ago');
                    addLog('USER_INPUT', `Typed: "${currentTxt.slice(0, 40)}" (len:${currentTxt.length})`);

                    // Sync cursor position after text change
                    channel.postMessage({
                        type: 'REMOTE_CURSOR',
                        clientId: userProfile.id,
                        user: userProfile,
                        range: quill.getSelection()
                    });
                }
            });

            // ── Broadcast local cursor/selection position ─────────────────────
            // Send on selection-change (click, arrow keys, mouse select)
            quill.on('selection-change', (range, _oldRange, source) => {
                channel.postMessage({
                    type: 'REMOTE_CURSOR',
                    clientId: userProfile.id,
                    user: userProfile,
                    range  // null means editor lost focus (cursor hidden)
                });
            });
        }

        // ── 10. Initial SYNC_STEP_1 announcement ──────────────────────────────
        // Broadcast after storage is restored so our state vector is accurate
        const sv = Y.encodeStateVector(ydoc);
        channel.postMessage({
            type: 'SYNC_STEP_1',
            clientId: userProfile.id,
            user: userProfile,
            stateVector: Array.from(sv)
        });
        addLog('HANDSHAKE_INIT', `Broadcasted SYNC_STEP_1 with ${ytext.length} chars in state`);

        // ── 11. Heartbeat for presence ─────────────────────────────────────────
        const heartbeatInterval = setInterval(() => {
            channel.postMessage({ type: 'HEARTBEAT', clientId: userProfile.id, user: userProfile });
            updateRoster();
        }, 2000);
        updateRoster();

        // ── 12. Metadata observer ──────────────────────────────────────────────
        metaMap.observe(() => {
            const t = metaMap.get('title'); if (t) setTitle(t);
            const s = metaMap.get('starred'); if (s !== undefined) setIsStarred(s);
            const lu = metaMap.get('lastEditUser'); if (lu) setLastEditUser(lu);
            const lt = metaMap.get('lastEditTime'); if (lt) setLastEditTime(lt);
            const ga = metaMap.get('generalAccess'); if (ga) setGeneralAccess(ga);
            const gr = metaMap.get('generalRole'); if (gr) setGeneralRole(gr);
        });

        // ── 13. Access requests observer ──────────────────────────────────────
        accessRequestsArray.observe(() => {
            const reqs = accessRequestsArray.toArray();
            setAccessRequests(reqs.filter(r => r.status === 'pending'));
            const approved = reqs.find(r => r.userId === userProfile.id && r.status === 'approved');
            if (approved) {
                setCurrentRole(ROLES.EDITOR);
                userProfile.role = ROLES.EDITOR;
                if (quillRef.current) quillRef.current.enable(true);
                addLog('PERMISSIONS', 'Elevated to EDITOR');
            }
        });

        // ── CLEANUP ────────────────────────────────────────────────────────────
        // Runs on StrictMode cleanup OR real unmount
        return () => {
            addLog('CLEANUP', 'Engine destroyed');
            clearInterval(heartbeatInterval);
            if (webrtcProvider) webrtcProvider.destroy();
            channel.close();
            ydoc.destroy();
            // Null out refs so next mount starts fresh
            if (channelRef.current === channel) channelRef.current = null;
            if (ydocRef.current === ydoc) ydocRef.current = null;
            if (ytextRef.current === ytext) ytextRef.current = null;
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Event Handlers ────────────────────────────────────────────────────────
    const handleTitleChange = useCallback(newTitle => {
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
        if (!ydocRef.current || hasRequestedAccess) return;
        const user = userProfileRef.current;
        ydocRef.current.getArray('accessRequests').push([{
            id: `req_${Date.now()}`, userId: user.id, userName: user.name,
            userEmail: user.email, avatarColor: user.color, timestamp: 'Just now', status: 'pending'
        }]);
        setHasRequestedAccess(true);
        addLog('REQUEST', 'Submitted edit access request');
    }, [hasRequestedAccess, addLog]);

    const handleApproveAccessRequest = useCallback(reqId => {
        if (!ydocRef.current) return;
        const arr = ydocRef.current.getArray('accessRequests');
        const list = arr.toArray();
        const req = list.find(r => r.id === reqId);
        if (req) {
            ydocRef.current.getMap('permissions').set(req.userId, ROLES.EDITOR);
            arr.delete(0, list.length);
            arr.push(list.map(r => r.id === reqId ? { ...r, status: 'approved' } : r));
            addLog('PERMISSIONS', `Approved access for ${req.userName}`);
        }
    }, [addLog]);

    const handleDenyAccessRequest = useCallback(reqId => {
        if (!ydocRef.current) return;
        const arr = ydocRef.current.getArray('accessRequests');
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
        if (range?.length > 0) {
            quillRef.current.deleteText(range.index, range.length);
            quillRef.current.insertText(range.index, replaceQuery);
            handleFindNext();
        }
    }, [findQuery, replaceQuery, handleFindNext]);

    const handleCopyLogs = useCallback(() => {
        navigator.clipboard.writeText(logs.map(l => `[${l.timestamp}] [${l.category}] ${l.message}`).join('\n'));
    }, [logs]);

    const handleMenuAction = useCallback((action) => {
        if (action === 'new') {
            const newDocId = 'doc_' + Math.random().toString(36).substring(2, 9);
            const currentUrl = new URL(window.location.href);
            currentUrl.hash = `#doc=${newDocId}&role=owner&user=Alice`;
            window.open(currentUrl.toString(), '_blank');
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
    }, [title]);

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
                onOpenFindReplace={() => setShowFindReplace(true)}
                onMenuAction={handleMenuAction}
            />

            {isReadOnly && (
                <div className="bg-[#feefe3] dark:bg-[#3c2a1e] border-b border-[#fcd0b3] px-6 py-2 flex items-center justify-between text-xs text-[#8c3300]">
                    <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-[#d93025]" />
                        <span><strong>Viewing only.</strong> You don't have edit permission.</span>
                    </div>
                    <button
                        onClick={handleRequestAccess}
                        disabled={hasRequestedAccess}
                        className={`px-4 py-1.5 rounded-full font-medium transition-all ${hasRequestedAccess ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-[#1a73e8] hover:bg-[#1557b0] text-white'}`}
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
                    onMarginsChange={setMargins}
                    isReadOnly={isReadOnly}
                />
            )}

            <main
                className="flex-1 overflow-y-auto p-8 flex justify-center bg-[#f0f4f9] dark:bg-[#18191a] transition-transform origin-top"
                style={{ transform: `scale(${zoom / 100})` }}
            >
                <div
                    className="page-canvas bg-white text-[#202124] min-h-[1056px] w-[816px] shadow-[0_1px_3px_1px_rgba(60,64,67,0.15)] border border-[#dadce0] rounded-xs"
                    style={{ paddingLeft: `${margins.left}px`, paddingRight: `${margins.right}px`, paddingTop: '72px', paddingBottom: '72px' }}
                >
                    <div ref={editorContainerRef} className="min-h-[900px] text-[15px] outline-none text-[#202124]" />
                </div>
            </main>

            {/* ── Real-Time Diagnostic & Telemetry HUD ────────────────────────── */}
            <div className="fixed bottom-3 left-4 z-50 bg-[#161718]/95 text-white backdrop-blur-md rounded-2xl shadow-2xl border border-gray-700/80 p-3 max-w-xl w-full text-xs font-sans">
                <div className="flex items-center justify-between pb-2 border-b border-gray-700/60">
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
                        <span className="font-semibold text-gray-200 text-sm">Real-Time Diagnostic Console</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-400">
                        <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Wifi className="w-3 h-3" /> {syncStats.peersCount} Peer(s)
                        </span>
                        <button onClick={triggerSyncHandshake} className="bg-blue-600 hover:bg-blue-500 text-white px-2 py-0.5 rounded flex items-center gap-1 font-medium transition cursor-pointer">
                            <RefreshCw className="w-3 h-3" /> Sync Now
                        </button>
                        <button onClick={handleCopyLogs} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-0.5 rounded flex items-center gap-1 transition cursor-pointer">
                            <Copy className="w-3 h-3" /> Copy
                        </button>
                        <button onClick={() => setShowDebugHUD(v => !v)} className="text-gray-400 hover:text-white p-1">
                            {showDebugHUD ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-1.5 py-2 text-[10px] text-gray-300">
                    <div className="bg-gray-800/70 p-1.5 rounded border border-gray-700/50">
                        <div className="text-gray-400">User</div>
                        <div className="font-semibold text-white flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentUser.color }} />
                            {currentUser.name} ({currentRole})
                        </div>
                    </div>
                    <div className="bg-gray-800/70 p-1.5 rounded border border-gray-700/50">
                        <div className="text-gray-400">CRDT Text</div>
                        <div className="font-semibold text-emerald-400 truncate" title={crdtTextPreview || '(empty)'}>
                            {crdtTextPreview ? `"${crdtTextPreview.slice(0, 20)}"` : '(empty)'}
                        </div>
                    </div>
                    <div className="bg-gray-800/70 p-1.5 rounded border border-gray-700/50">
                        <div className="text-gray-400">Quill View</div>
                        <div className="font-semibold text-blue-400 truncate" title={quillTextPreview || '(empty)'}>
                            {quillTextPreview ? `"${quillTextPreview.slice(0, 20)}"` : '(empty)'}
                        </div>
                    </div>
                    <div className="bg-gray-800/70 p-1.5 rounded border border-gray-700/50">
                        <div className="text-gray-400">Sent / Recv</div>
                        <div className="font-semibold text-purple-400">
                            {syncStats.updatesSent} / {syncStats.updatesReceived}
                        </div>
                    </div>
                </div>

                {showDebugHUD && (
                    <div className="mt-1 bg-black/90 rounded-lg p-2 max-h-40 overflow-y-auto font-mono text-[10px] space-y-1 border border-gray-800">
                        {logs.length === 0
                            ? <div className="text-gray-500 italic">Listening…</div>
                            : logs.map((log, i) => (
                                <div key={i} className="flex items-start gap-2 leading-tight">
                                    <span className="text-gray-500 shrink-0">{log.timestamp}</span>
                                    <span className={`shrink-0 font-semibold px-1 rounded text-[9px] ${
                                        log.category.includes('RECV') || log.category.includes('APPLY') ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                                        log.category.includes('SEND') || log.category.includes('INPUT') ? 'bg-blue-950 text-blue-400 border border-blue-800' :
                                        log.category.includes('HANDSHAKE') ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' :
                                        log.category.includes('RESTORE') || log.category.includes('PREPOP') ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                                        log.category.includes('ERROR') ? 'bg-red-950 text-red-400 border border-red-800' :
                                        'bg-gray-800 text-gray-300'
                                    }`}>[{log.category}]</span>
                                    <span className="text-gray-200 break-all">{log.message}</span>
                                </div>
                            ))}
                    </div>
                )}
            </div>

            <ShareModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                docTitle={title}
                owner={{ name: 'Alice', email: 'alice@example.com' }}
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
                <div className="fixed top-24 right-12 z-50 bg-white dark:bg-[#282a2c] rounded-xl shadow-xl border border-[#e0e2e0] p-4 w-80 text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                        <span className="font-semibold text-sm">Find and replace</span>
                        <button onClick={() => setShowFindReplace(false)}><X className="w-4 h-4 text-gray-500" /></button>
                    </div>
                    <div className="flex flex-col gap-2 mt-3">
                        <input type="text" placeholder="Find" value={findQuery} onChange={e => setFindQuery(e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1.5 bg-transparent outline-none focus:border-blue-500" />
                        <input type="text" placeholder="Replace with" value={replaceQuery} onChange={e => setReplaceQuery(e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1.5 bg-transparent outline-none focus:border-blue-500" />
                        <div className="flex items-center justify-end gap-2 mt-2">
                            <button onClick={handleFindNext} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded font-medium">Next</button>
                            <button onClick={handleReplaceCurrent} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium">Replace</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
