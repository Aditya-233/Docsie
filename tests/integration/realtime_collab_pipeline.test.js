/**
 * Real-Time Collaboration Pipeline Integration Tests
 * Tests the EXACT failure conditions seen in the diagnostic logs:
 *
 * Failure 1: User types → [QUILL_INPUT] logged BUT no [DELTA_SEND] → Y.Doc stays empty
 * Failure 2: Peer sends SYNC_STEP_1 → reply is always 2 bytes (empty doc)
 * Failure 3: Tab reload → content erased (localStorage not persisted)
 * Failure 4: React StrictMode double-mount → two separate Y.Doc instances, second one never syncs
 * Failure 5: setText() in ytext.observe() causes feedback loop and overwrites typing
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as Y from 'yjs';

// ─── Mock BroadcastChannel (Node.js has no BroadcastChannel) ──────────────────
class MockBC {
    static _channels = new Map();

    constructor(name) {
        this.name = name;
        this.onmessage = null;
        this.closed = false;
        if (!MockBC._channels.has(name)) MockBC._channels.set(name, new Set());
        MockBC._channels.get(name).add(this);
    }

    postMessage(data) {
        if (this.closed) return;
        MockBC._channels.get(this.name)?.forEach(ch => {
            if (ch !== this && ch.onmessage && !ch.closed) {
                ch.onmessage({ data });
            }
        });
    }

    close() {
        this.closed = true;
        MockBC._channels.get(this.name)?.delete(this);
    }

    static clearAll() {
        MockBC._channels.clear();
    }
}

// ─── Mock localStorage ─────────────────────────────────────────────────────────
class MockStorage {
    constructor() { this._store = {}; }
    getItem(k) { return this._store[k] ?? null; }
    setItem(k, v) { this._store[k] = v; }
    removeItem(k) { delete this._store[k]; }
    clear() { this._store = {}; }
}

// ─── CollabEngine — minimal version of what App.jsx should do ─────────────────
/**
 * This is a direct port of the App.jsx collaboration logic in pure JS so we
 * can test it without a browser DOM. If this engine passes all tests, the
 * React component will too (once it uses this same logic).
 */
class CollabEngine {
    constructor({ docId, userId, userName, userColor, storage }) {
        this.docId = docId;
        this.userId = userId;
        this.userName = userName;
        this.userColor = userColor;
        this.storage = storage;

        this.ydoc = new Y.Doc();
        this.ytext = this.ydoc.getText('quill');
        this.channel = new MockBC(`gdocs_crdt_channel_${docId}`);
        this.logs = [];
        this.sentDeltas = 0;
        this.receivedDeltas = 0;

        // Restore from storage FIRST before opening channel
        this._restoreFromStorage();

        // Wire up the two core pipelines
        this._wireYdocBroadcast();
        this._wireChannelReceiver();

        // Announce presence & request history
        this._sendHandshake();
    }

    // ── Pipeline 1: Y.Doc changes → BroadcastChannel broadcast ──────────────
    _wireYdocBroadcast() {
        this.ydoc.on('update', (update, origin) => {
            // Save to storage on every update (for reload persistence)
            this._saveToStorage();

            // Only broadcast LOCAL changes (not re-broadcast remote ones)
            if (
                origin !== 'remote_handshake' &&
                origin !== 'remote_delta' &&
                origin !== 'storage_restore'
            ) {
                this.channel.postMessage({
                    type: 'CRDT_DELTA',
                    clientId: this.userId,
                    userName: this.userName,
                    update: Array.from(update)
                });
                this.sentDeltas++;
                this._log('DELTA_SEND', `Sent delta (${update.length}B). YText="${this.ytext.toString()}"`);
            }
        });
    }

    // ── Pipeline 2: BroadcastChannel → Y.Doc (inbound sync) ─────────────────
    _wireChannelReceiver() {
        this.channel.onmessage = ({ data: msg }) => {
            if (!msg || msg.clientId === this.userId) return;

            switch (msg.type) {
                case 'SYNC_STEP_1': {
                    const sv = new Uint8Array(msg.stateVector);
                    const diff = Y.encodeStateAsUpdate(this.ydoc, sv);
                    this._log('HANDSHAKE_IN', `SYNC_STEP_1 from ${msg.userName}. Diff=${diff.length}B`);
                    // ALWAYS send SYNC_STEP_2 — remote needs our vector
                    this.channel.postMessage({
                        type: 'SYNC_STEP_2',
                        targetId: msg.clientId,
                        clientId: this.userId,
                        update: Array.from(diff)
                    });
                    break;
                }

                case 'SYNC_STEP_2': {
                    if (msg.targetId !== this.userId) break;
                    const bytes = new Uint8Array(msg.update);
                    Y.applyUpdate(this.ydoc, bytes, 'remote_handshake');
                    this.receivedDeltas++;
                    this._log('HANDSHAKE_APPLY', `SYNC_STEP_2 applied. YText="${this.ytext.toString()}"`);
                    break;
                }

                case 'CRDT_DELTA': {
                    const bytes = new Uint8Array(msg.update);
                    Y.applyUpdate(this.ydoc, bytes, 'remote_delta');
                    this.receivedDeltas++;
                    this._log('DELTA_RECV', `Got delta from ${msg.userName}. YText="${this.ytext.toString()}"`);
                    break;
                }
            }
        };
    }

    // ── User types → Y.Text (simulates Quill text-change with source='user') ─
    simulateUserType(quillDeltaOps) {
        this.ydoc.transact(() => {
            this.ytext.applyDelta(quillDeltaOps);
        }, 'user_input');
        this._log('USER_INPUT', `Applied Quill delta. YText="${this.ytext.toString()}"`);
    }

    // ── Type plain text at end (convenience wrapper) ──────────────────────────
    typeText(text) {
        const currentLen = this.ytext.length;
        if (currentLen === 0) {
            this.simulateUserType([{ insert: text }]);
        } else {
            this.simulateUserType([{ retain: currentLen }, { insert: text }]);
        }
    }

    // ── Delete N chars at position ────────────────────────────────────────────
    deleteAt(index, length) {
        this.simulateUserType([{ retain: index }, { delete: length }]);
    }

    _sendHandshake() {
        const sv = Y.encodeStateVector(this.ydoc);
        this.channel.postMessage({
            type: 'SYNC_STEP_1',
            clientId: this.userId,
            userName: this.userName,
            stateVector: Array.from(sv)
        });
        this._log('HANDSHAKE_INIT', 'Sent initial SYNC_STEP_1');
    }

    _saveToStorage() {
        if (!this.storage) return;
        try {
            const state = Y.encodeStateAsUpdate(this.ydoc);
            this.storage.setItem(`gdocs_ydoc_${this.docId}`, JSON.stringify(Array.from(state)));
        } catch (e) {}
    }

    _restoreFromStorage() {
        if (!this.storage) return;
        try {
            const saved = this.storage.getItem(`gdocs_ydoc_${this.docId}`);
            if (saved) {
                const bytes = new Uint8Array(JSON.parse(saved));
                Y.applyUpdate(this.ydoc, bytes, 'storage_restore');
                this._log('STORAGE_RESTORE', `Restored. YText="${this.ytext.toString()}"`);
            }
        } catch (e) {}
    }

    _log(category, msg) {
        this.logs.push({ category, msg });
    }

    destroy() {
        this.channel.close();
        this.ydoc.destroy();
    }
}


// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Real-Time Collaboration Pipeline — Exact Failure Mode Coverage', () => {

    beforeEach(() => {
        MockBC.clearAll();
    });

    // ─────────────────────────────────────────────────────────────────────────
    // FAILURE 1: User typing never enters Y.Doc
    // ─────────────────────────────────────────────────────────────────────────
    describe('Failure 1 — User Typing Must Enter Y.Doc and Trigger Broadcast', () => {

        it('typing a single character enters Y.Doc immediately', () => {
            const alice = new CollabEngine({ docId: 'test', userId: 'alice', userName: 'Alice', userColor: '#f00' });

            assert.equal(alice.ytext.length, 0, 'Y.Doc must start empty');
            assert.equal(alice.sentDeltas, 0, 'No deltas sent yet');

            alice.simulateUserType([{ insert: 'S' }]);

            assert.equal(alice.ytext.toString(), 'S', 'Y.Doc must contain typed text');
            assert.ok(alice.sentDeltas > 0, `DELTA_SEND must fire (was: ${alice.sentDeltas} deltas sent)`);

            alice.destroy();
        });

        it('typing full sentence — Y.Doc reflects each keystroke', () => {
            const alice = new CollabEngine({ docId: 'test', userId: 'alice', userName: 'Alice', userColor: '#f00' });

            alice.typeText('So');
            assert.equal(alice.ytext.toString(), 'So');

            alice.typeText(' chats');
            assert.equal(alice.ytext.toString(), 'So chats');

            alice.typeText(" what's cooking");
            assert.equal(alice.ytext.toString(), "So chats what's cooking");

            assert.ok(alice.sentDeltas >= 3, `At least 3 delta broadcasts expected, got ${alice.sentDeltas}`);

            alice.destroy();
        });

        it('deleting text also enters Y.Doc and triggers broadcast', () => {
            const alice = new CollabEngine({ docId: 'test', userId: 'alice', userName: 'Alice', userColor: '#f00' });
            alice.typeText('Hello World');
            const beforeSent = alice.sentDeltas;

            alice.deleteAt(5, 6);
            assert.equal(alice.ytext.toString(), 'Hello');
            assert.ok(alice.sentDeltas > beforeSent, 'Delete must trigger DELTA_SEND');

            alice.destroy();
        });

        it('Y.Doc update must broadcast with type=CRDT_DELTA containing real content', () => {
            const alice = new CollabEngine({ docId: 'test', userId: 'alice', userName: 'Alice', userColor: '#f00' });

            const messages = [];
            const originalPost = alice.channel.postMessage.bind(alice.channel);
            alice.channel.postMessage = (data) => {
                messages.push(data);
                originalPost(data);
            };

            alice.typeText('Test broadcast');

            const deltaMsg = messages.find(m => m.type === 'CRDT_DELTA');
            assert.ok(deltaMsg, `CRDT_DELTA message must be posted. Got: ${JSON.stringify(messages.map(m => m.type))}`);
            assert.ok(deltaMsg.update && deltaMsg.update.length > 2, 'CRDT_DELTA must contain non-empty update bytes');
            assert.equal(deltaMsg.clientId, 'alice');

            alice.destroy();
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // FAILURE 2: SYNC_STEP_1 from remote returns 2 bytes (empty doc)
    // ─────────────────────────────────────────────────────────────────────────
    describe('Failure 2 — SYNC_STEP_1 Must Return Full Document Content Not 2 Bytes', () => {

        it('when Tab A has content, Tab B joining gets the full content via handshake', (_, done) => {
            const alice = new CollabEngine({ docId: 'room1', userId: 'alice', userName: 'Alice', userColor: '#f00' });
            alice.typeText("So chats what's cooking");
            assert.equal(alice.ytext.toString(), "So chats what's cooking");

            const bob = new CollabEngine({ docId: 'room1', userId: 'bob', userName: 'Bob', userColor: '#0f0' });

            setImmediate(() => {
                assert.equal(bob.ytext.toString(), "So chats what's cooking",
                    `Bob must receive full content. Got: "${bob.ytext.toString()}"`);

                const handshakeApply = bob.logs.find(l => l.category === 'HANDSHAKE_APPLY');
                assert.ok(handshakeApply, 'Bob must have a HANDSHAKE_APPLY log entry');
                assert.ok(handshakeApply.msg.includes("So chats what's cooking"),
                    `HANDSHAKE_APPLY must show full content. Got: "${handshakeApply?.msg}"`);

                alice.destroy();
                bob.destroy();
                done();
            });
        });

        it('3-tab scenario: all tabs see same content after joining', (_, done) => {
            const alice = new CollabEngine({ docId: 'room2', userId: 'alice', userName: 'Alice', userColor: '#f00' });
            alice.typeText('Hello from Alice');

            const bob = new CollabEngine({ docId: 'room2', userId: 'bob', userName: 'Bob', userColor: '#0f0' });
            const christine = new CollabEngine({ docId: 'room2', userId: 'christine', userName: 'Christine', userColor: '#f0f' });

            setImmediate(() => {
                assert.equal(bob.ytext.toString(), 'Hello from Alice',
                    `Bob should have Alice's text. Got: "${bob.ytext.toString()}"`);
                assert.equal(christine.ytext.toString(), 'Hello from Alice',
                    `Christine should have Alice's text. Got: "${christine.ytext.toString()}"`);

                alice.destroy(); bob.destroy(); christine.destroy();
                done();
            });
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // FAILURE 3: Tab reload erases content
    // ─────────────────────────────────────────────────────────────────────────
    describe('Failure 3 — Tab Reload Must Not Erase Content (localStorage Persistence)', () => {

        it('typing text saves to localStorage automatically', () => {
            const storage = new MockStorage();
            const alice = new CollabEngine({ docId: 'persist', userId: 'alice', userName: 'Alice', userColor: '#f00', storage });

            alice.typeText('Project Overview: Phase 1');

            const saved = storage.getItem('gdocs_ydoc_persist');
            assert.ok(saved, 'State must be saved to localStorage after typing');

            const bytes = new Uint8Array(JSON.parse(saved));
            assert.ok(bytes.length > 2, `Saved state must be non-trivial (${bytes.length} bytes)`);

            alice.destroy();
        });

        it('after reload: new engine restores content from localStorage', () => {
            const storage = new MockStorage();

            const alice1 = new CollabEngine({ docId: 'persist', userId: 'alice', userName: 'Alice', userColor: '#f00', storage });
            alice1.typeText('Do not erase me on reload!');
            assert.equal(alice1.ytext.toString(), 'Do not erase me on reload!');
            alice1.destroy();

            MockBC.clearAll();

            // Tab reloads — new engine, same storage
            const alice2 = new CollabEngine({ docId: 'persist', userId: 'alice', userName: 'Alice', userColor: '#f00', storage });
            assert.equal(alice2.ytext.toString(), 'Do not erase me on reload!',
                `Content must be restored from localStorage after reload. Got: "${alice2.ytext.toString()}"`);

            alice2.destroy();
        });

        it('reload preserves content AND new peers get full history via handshake', (_, done) => {
            const storage = new MockStorage();

            const alice1 = new CollabEngine({ docId: 'persist', userId: 'alice', userName: 'Alice', userColor: '#f00', storage });
            alice1.typeText('Existing content');
            alice1.destroy();

            MockBC.clearAll();

            const alice2 = new CollabEngine({ docId: 'persist', userId: 'alice', userName: 'Alice', userColor: '#f00', storage });
            assert.equal(alice2.ytext.toString(), 'Existing content', 'Reload must restore content');

            const bob = new CollabEngine({ docId: 'persist', userId: 'bob', userName: 'Bob', userColor: '#0f0', storage });

            setImmediate(() => {
                assert.equal(bob.ytext.toString(), 'Existing content',
                    `Bob must receive reloaded content. Got: "${bob.ytext.toString()}"`);

                alice2.destroy(); bob.destroy();
                done();
            });
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // FAILURE 4: StrictMode double-mount orphan engines
    // ─────────────────────────────────────────────────────────────────────────
    describe('Failure 4 — StrictMode: Old Engine Properly Destroyed, New One Works', () => {

        it('destroyed engine channel is closed and does not ghost-receive messages', (_, done) => {
            const receivedByGhost = [];

            const alice = new CollabEngine({ docId: 'ghost', userId: 'alice', userName: 'Alice', userColor: '#f00' });
            const ghostChannel = alice.channel;
            const originalOnMessage = ghostChannel.onmessage;
            ghostChannel.onmessage = (e) => {
                receivedByGhost.push(e.data);
                if (originalOnMessage) originalOnMessage(e);
            };

            alice.destroy();
            assert.ok(ghostChannel.closed, 'Channel must be closed after destroy()');

            const bob = new CollabEngine({ docId: 'ghost', userId: 'bob', userName: 'Bob', userColor: '#0f0' });
            bob.typeText('Bob types after alice destroyed');

            setImmediate(() => {
                const ghostDeltas = receivedByGhost.filter(m => m.type === 'CRDT_DELTA');
                assert.equal(ghostDeltas.length, 0,
                    `Destroyed engine must not receive messages. Got ${ghostDeltas.length} ghost messages`);

                bob.destroy();
                done();
            });
        });

        it('StrictMode remount with storage: second engine restores content correctly', () => {
            const storage = new MockStorage();

            // First mount
            const e1 = new CollabEngine({ docId: 'strictPersist', userId: 'alice', userName: 'Alice', userColor: '#f00', storage });
            e1.typeText('Persistent text');
            e1.destroy();

            MockBC.clearAll();

            // StrictMode remount
            const e2 = new CollabEngine({ docId: 'strictPersist', userId: 'alice', userName: 'Alice', userColor: '#f00', storage });
            assert.equal(e2.ytext.toString(), 'Persistent text',
                'Second mount (after StrictMode cleanup) must restore from storage');

            e2.destroy();
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // FAILURE 5: ytext.observe feedback loop
    // ─────────────────────────────────────────────────────────────────────────
    describe('Failure 5 — ytext.observe Must Not Overwrite Local User Input', () => {

        it('user_input transactions do NOT trigger remote view-sync observer path', () => {
            const alice = new CollabEngine({ docId: 'loop', userId: 'alice', userName: 'Alice', userColor: '#f00' });

            let viewSyncCount = 0;
            alice.ytext.observe((event) => {
                if (event.transaction.origin !== 'user_input') {
                    viewSyncCount++;
                }
            });

            alice.typeText('Hello');
            alice.typeText(' World');

            assert.equal(viewSyncCount, 0,
                `View sync must NOT fire for user_input transactions. Fired ${viewSyncCount} times.`);

            alice.destroy();
        });

        it('remote CRDT_DELTA correctly triggers view-sync observer for remote changes', (_, done) => {
            const alice = new CollabEngine({ docId: 'loop2', userId: 'alice', userName: 'Alice', userColor: '#f00' });
            const bob = new CollabEngine({ docId: 'loop2', userId: 'bob', userName: 'Bob', userColor: '#0f0' });

            let remoteViewSyncs = 0;
            alice.ytext.observe((event) => {
                if (event.transaction.origin === 'remote_delta' || event.transaction.origin === 'remote_handshake') {
                    remoteViewSyncs++;
                }
            });

            setImmediate(() => {
                bob.typeText('Bob is typing');

                setImmediate(() => {
                    assert.ok(remoteViewSyncs > 0,
                        `Alice's observer must fire for remote deltas. Fired ${remoteViewSyncs} times.`);
                    assert.equal(alice.ytext.toString(), 'Bob is typing',
                        `Alice's Y.Doc must reflect Bob's text. Got: "${alice.ytext.toString()}"`);

                    alice.destroy(); bob.destroy();
                    done();
                });
            });
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // REAL-TIME SYNC — No reload required
    // ─────────────────────────────────────────────────────────────────────────
    describe('Real-Time Sync — No Reload Required', () => {

        it('Tab A types → Tab B sees it immediately without any reload', (_, done) => {
            const alice = new CollabEngine({ docId: 'rt', userId: 'alice', userName: 'Alice', userColor: '#f00' });
            const bob = new CollabEngine({ docId: 'rt', userId: 'bob', userName: 'Bob', userColor: '#0f0' });

            setImmediate(() => {
                alice.typeText('Real-time message');

                setImmediate(() => {
                    assert.equal(bob.ytext.toString(), 'Real-time message',
                        `Bob must see Alice's text in real-time. Got: "${bob.ytext.toString()}"`);

                    alice.destroy(); bob.destroy();
                    done();
                });
            });
        });

        it('concurrent typing from 3 tabs converges to same state', (_, done) => {
            const alice = new CollabEngine({ docId: 'concurrent', userId: 'alice', userName: 'Alice', userColor: '#f00' });
            const bob = new CollabEngine({ docId: 'concurrent', userId: 'bob', userName: 'Bob', userColor: '#0f0' });
            const chris = new CollabEngine({ docId: 'concurrent', userId: 'chris', userName: 'Chris', userColor: '#00f' });

            setImmediate(() => {
                alice.typeText('Alice');
                bob.typeText('Bob');
                chris.typeText('Chris');

                setImmediate(() => {
                    const aliceText = alice.ytext.toString();
                    const bobText = bob.ytext.toString();
                    const chrisText = chris.ytext.toString();

                    assert.equal(aliceText, bobText,
                        `Alice and Bob must converge. Alice="${aliceText}", Bob="${bobText}"`);
                    assert.equal(bobText, chrisText,
                        `Bob and Chris must converge. Bob="${bobText}", Chris="${chrisText}"`);
                    assert.ok(aliceText.length > 0, 'Document must not be empty after concurrent typing');

                    alice.destroy(); bob.destroy(); chris.destroy();
                    done();
                });
            });
        });

        it('Tab B joins AFTER Tab A has typed — gets full history without reload', (_, done) => {
            const alice = new CollabEngine({ docId: 'late-join', userId: 'alice', userName: 'Alice', userColor: '#f00' });
            alice.typeText('Alice typed this before Bob joined');

            const bob = new CollabEngine({ docId: 'late-join', userId: 'bob', userName: 'Bob', userColor: '#0f0' });

            setImmediate(() => {
                assert.equal(bob.ytext.toString(), 'Alice typed this before Bob joined',
                    `Bob must get full history. Got: "${bob.ytext.toString()}"`);

                alice.typeText('\nMore text after Bob joined');

                setImmediate(() => {
                    assert.ok(bob.ytext.toString().includes('More text after Bob joined'),
                        `Bob must receive Alice's new text in real-time. Got: "${bob.ytext.toString()}"`);

                    alice.destroy(); bob.destroy();
                    done();
                });
            });
        });

        it('both tabs type → converge to same final state', (_, done) => {
            const alice = new CollabEngine({ docId: 'cross', userId: 'alice', userName: 'Alice', userColor: '#f00' });
            const bob = new CollabEngine({ docId: 'cross', userId: 'bob', userName: 'Bob', userColor: '#0f0' });

            setImmediate(() => {
                alice.typeText('Hello ');
                bob.typeText('World');

                setImmediate(() => {
                    const aliceText = alice.ytext.toString();
                    const bobText = bob.ytext.toString();

                    assert.equal(aliceText, bobText,
                        `Both tabs must converge. Alice="${aliceText}", Bob="${bobText}"`);
                    assert.ok(aliceText.includes('Hello') && aliceText.includes('World'),
                        `Final text must include both contributions. Got: "${aliceText}"`);

                    alice.destroy(); bob.destroy();
                    done();
                });
            });
        });

        it('bidirectional handshake: both tabs exchange state and converge', (_, done) => {
            const alice = new CollabEngine({ docId: 'bidir', userId: 'alice', userName: 'Alice', userColor: '#f00' });
            alice.typeText('Alice content');

            const bob = new CollabEngine({ docId: 'bidir', userId: 'bob', userName: 'Bob', userColor: '#0f0' });
            bob.typeText('Bob content');

            setImmediate(() => {
                setImmediate(() => {
                    const aliceText = alice.ytext.toString();
                    const bobText = bob.ytext.toString();

                    assert.ok(aliceText.includes('Alice content'), `Alice must have her own text. Got: "${aliceText}"`);
                    assert.ok(aliceText.includes('Bob content'), `Alice must have Bob's text. Got: "${aliceText}"`);
                    assert.equal(aliceText, bobText, 'Both must converge to same text');

                    alice.destroy(); bob.destroy();
                    done();
                });
            });
        });
    });
});
