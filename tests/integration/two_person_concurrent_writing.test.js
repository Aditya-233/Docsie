import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { CollaborationEngine, MockBroadcastChannel } from '../../src/collaboration/engine.ts';
import { ROLES } from '../../src/permissions/manager.ts';
import { CommentManager } from '../../src/comments/commentManager.ts';
import { generateTableHTML } from '../../src/core/editor.ts';

describe('Two-Person Concurrent Writing Integration Test Suite', () => {
  beforeEach(() => {
    MockBroadcastChannel.resetAllChannels();
  });

  afterEach(() => {
    MockBroadcastChannel.resetAllChannels();
  });

  test('exhaustive 2-person concurrent writing, table insertion, selection, commenting, and viewer promotion flow', async () => {
    const docId = 'doc_concurrent_flow_2026';

    // -------------------------------------------------------------------------
    // Setup: Initialize Alice (Owner) and Bob (Editor)
    // -------------------------------------------------------------------------
    const alice = new CollaborationEngine(
      docId,
      { id: 'user_alice_owner', name: 'Alice Smith', color: '#ea4335', email: 'alice@antigravity.dev' },
      ROLES.OWNER,
      { useMockChannel: true, staleThresholdMs: 10000 }
    );

    const bob = new CollaborationEngine(
      docId,
      { id: 'user_bob_editor', name: 'Bob Jones', color: '#34a853', email: 'bob@antigravity.dev' },
      ROLES.EDITOR,
      { useMockChannel: true, staleThresholdMs: 10000 }
    );

    const aliceCommentMgr = new CommentManager();
    const bobCommentMgr = new CommentManager();

    // Local document state containers for testing
    let aliceDoc = { html: '', version: 0, lastAuthor: null };
    let bobDoc = { html: '', version: 0, lastAuthor: null };

    alice.on('remoteDelta', ({ fullHtml, delta, version, senderUser }) => {
      aliceDoc.html = fullHtml;
      aliceDoc.version = version || aliceDoc.version + 1;
      aliceDoc.lastAuthor = senderUser.id;
    });

    bob.on('remoteDelta', ({ fullHtml, delta, version, senderUser }) => {
      bobDoc.html = fullHtml;
      bobDoc.version = version || bobDoc.version + 1;
      bobDoc.lastAuthor = senderUser.id;
    });

    // Wire comment syncing
    alice.on('commentSync', (payload, senderUser) => {
      if (payload.action === 'create' && payload.comment) {
        aliceCommentMgr.createComment(payload.comment);
      } else if (payload.action === 'reply' && payload.comment) {
        aliceCommentMgr.addReply(payload.commentId, payload.comment);
      }
    });

    bob.on('commentSync', (payload, senderUser) => {
      if (payload.action === 'create' && payload.comment) {
        bobCommentMgr.createComment(payload.comment);
      } else if (payload.action === 'reply' && payload.comment) {
        bobCommentMgr.addReply(payload.commentId, payload.comment);
      }
    });

    // Verify initial connection and mutual presence detection
    alice.broadcastPresence({ index: 0, length: 0 });
    bob.broadcastPresence({ index: 0, length: 0 });

    await new Promise((r) => setTimeout(r, 25));

    assert.equal(alice.getPeers().length, 1);
    assert.equal(alice.getPeers()[0].user.id, 'user_bob_editor');
    assert.equal(bob.getPeers().length, 1);
    assert.equal(bob.getPeers()[0].user.id, 'user_alice_owner');

    // -------------------------------------------------------------------------
    // STEP 1: Alice types Title and Paragraph 1
    // -------------------------------------------------------------------------
    const aliceTitle = '<h1>Distributed Consensus in Real-Time Systems</h1>';
    const alicePara1 = '<p>Modern collaborative editors rely on operation transformation or CRDTs to synchronize state.</p>';
    const aliceInitialHtml = `${aliceTitle}${alicePara1}`;
    const aliceDelta1 = {
      ops: [
        { insert: 'Distributed Consensus in Real-Time Systems\n', attributes: { header: 1 } },
        { insert: 'Modern collaborative editors rely on operation transformation or CRDTs to synchronize state.\n' }
      ]
    };

    aliceDoc.html = aliceInitialHtml;
    aliceDoc.version = 1;
    aliceDoc.lastAuthor = alice.currentUser.id;

    alice.broadcastDelta(aliceDelta1, aliceInitialHtml, 1);

    await new Promise((r) => setTimeout(r, 30));

    // Verify Bob received delta and updated document content
    assert.equal(bobDoc.html, aliceInitialHtml);
    assert.equal(bobDoc.version, 1);
    assert.equal(bobDoc.lastAuthor, 'user_alice_owner');
    assert.ok(bobDoc.html.includes('<h1>Distributed Consensus in Real-Time Systems</h1>'));
    assert.ok(bobDoc.html.includes('Modern collaborative editors rely on operation transformation'));

    // -------------------------------------------------------------------------
    // STEP 2: Bob types Paragraph 2 and inserts a 3x3 Table
    // -------------------------------------------------------------------------
    const bobPara2 = '<p>Table 1 describes latency metrics across geodistributed data centers.</p>';
    const bobTable = generateTableHTML(3, 3, { cellPadding: '8px 12px', borderColor: '#4285f4' });
    const fullHtmlStep2 = `${aliceInitialHtml}${bobPara2}${bobTable}`;
    const bobDelta2 = {
      ops: [
        { retain: 110 },
        { insert: 'Table 1 describes latency metrics across geodistributed data centers.\n' },
        { insert: { table: { rows: 3, cols: 3 } } }
      ]
    };

    bobDoc.html = fullHtmlStep2;
    bobDoc.version = 2;
    bobDoc.lastAuthor = bob.currentUser.id;

    bob.broadcastDelta(bobDelta2, fullHtmlStep2, 2);

    await new Promise((r) => setTimeout(r, 30));

    // Verify Alice received delta and updated content
    assert.equal(aliceDoc.html, fullHtmlStep2);
    assert.equal(aliceDoc.version, 2);
    assert.equal(aliceDoc.lastAuthor, 'user_bob_editor');
    assert.ok(aliceDoc.html.includes('Table 1 describes latency metrics'));
    assert.ok(aliceDoc.html.includes('<table style="width:100%;border-collapse:collapse;margin:12px 0;">'));
    assert.equal((aliceDoc.html.match(/<tr>/g) || []).length, 3);
    assert.equal((aliceDoc.html.match(/<td /g) || []).length, 9);

    // -------------------------------------------------------------------------
    // STEP 3: Alice moves cursor and selects text in Paragraph 1
    // -------------------------------------------------------------------------
    const aliceSelectionRange = { index: 45, length: 25 };
    const aliceSelectionBounds = { top: 120, left: 80, width: 200, height: 18 };
    const aliceCursorRange = { index: 70, length: 0 };
    const aliceCursorCoords = { top: 120, left: 280, height: 18 };

    let bobReceivedSelection = null;
    let bobReceivedCursor = null;

    bob.on('remoteSelection', (data) => {
      bobReceivedSelection = data;
    });

    bob.on('remoteCursor', (data) => {
      bobReceivedCursor = data;
    });

    alice.broadcastSelection(aliceSelectionRange, aliceSelectionBounds);
    alice.broadcastPresence(aliceCursorRange, aliceCursorCoords);

    await new Promise((r) => setTimeout(r, 30));

    // Verify Bob's presence tracker receives selection and cursor bounds
    assert.ok(bobReceivedSelection);
    assert.equal(bobReceivedSelection.peerId, 'user_alice_owner');
    assert.deepEqual(bobReceivedSelection.range, aliceSelectionRange);
    assert.deepEqual(bobReceivedSelection.bounds, aliceSelectionBounds);

    assert.ok(bobReceivedCursor);
    assert.equal(bobReceivedCursor.peerId, 'user_alice_owner');
    assert.deepEqual(bobReceivedCursor.cursorRange, aliceCursorRange);
    assert.deepEqual(bobReceivedCursor.cursorCoords, aliceCursorCoords);

    const alicePeerInBobTracker = bob.presence.getPeer('user_alice_owner');
    assert.ok(alicePeerInBobTracker);
    assert.deepEqual(alicePeerInBobTracker.selection, aliceSelectionRange);
    assert.deepEqual(alicePeerInBobTracker.cursorRange, aliceCursorRange);
    assert.deepEqual(alicePeerInBobTracker.cursorCoords, aliceCursorCoords);

    // -------------------------------------------------------------------------
    // STEP 4: Bob creates a threaded comment anchored to Alice's text; Alice replies
    // -------------------------------------------------------------------------
    const commentBob = bobCommentMgr.createComment({
      id: 'comment_sync_001',
      author: { id: bob.currentUser.id, name: bob.currentUser.name, color: bob.currentUser.color },
      text: 'Should we specify BroadcastChannel fallback semantics here?',
      anchorRange: { index: 45, length: 25 },
      anchorText: 'operation transformation'
    });

    bob.broadcastCommentSync('create', commentBob);

    await new Promise((r) => setTimeout(r, 30));

    // Verify Alice receives the comment
    const aliceRetrievedComment = aliceCommentMgr.getComment('comment_sync_001');
    assert.ok(aliceRetrievedComment);
    assert.equal(aliceRetrievedComment.text, 'Should we specify BroadcastChannel fallback semantics here?');
    assert.equal(aliceRetrievedComment.author.name, 'Bob Jones');
    assert.equal(aliceRetrievedComment.status, 'open');

    // Alice replies to Bob's comment
    const replyAlice = {
      id: 'reply_sync_001',
      author: { id: alice.currentUser.id, name: alice.currentUser.name, color: alice.currentUser.color },
      text: 'Yes, MockBroadcastChannel provides in-memory fallback for headless/Node environments!',
      createdAt: new Date().toISOString()
    };

    aliceCommentMgr.addReply('comment_sync_001', replyAlice);
    alice.broadcastCommentSync('reply', replyAlice, 'comment_sync_001');

    await new Promise((r) => setTimeout(r, 30));

    // Verify Bob receives Alice's reply
    const bobUpdatedComment = bobCommentMgr.getComment('comment_sync_001');
    assert.ok(bobUpdatedComment);
    assert.equal(bobUpdatedComment.replies.length, 1);
    assert.equal(bobUpdatedComment.replies[0].author.name, 'Alice Smith');
    assert.equal(
      bobUpdatedComment.replies[0].text,
      'Yes, MockBroadcastChannel provides in-memory fallback for headless/Node environments!'
    );

    // -------------------------------------------------------------------------
    // STEP 5: Charlie joins as Viewer, requests Edit Access, Alice approves
    // -------------------------------------------------------------------------
    const charlie = new CollaborationEngine(
      docId,
      { id: 'user_charlie_viewer', name: 'Charlie Davis', color: '#fbbc05', email: 'charlie@antigravity.dev' },
      ROLES.VIEWER,
      { useMockChannel: true, staleThresholdMs: 10000 }
    );

    let charlieReceivedElevation = null;
    charlie.on('roleElevated', (newRole) => {
      charlieReceivedElevation = newRole;
    });

    let aliceReceivedPermissionReq = null;
    alice.on('permissionRequest', (reqUser) => {
      aliceReceivedPermissionReq = reqUser;
      // Alice approves request and grants Editor role
      alice.grantEditAccess(reqUser.id, ROLES.EDITOR);
    });

    // Charlie announces presence as Viewer; Alice and Bob also announce
    charlie.broadcastPresence({ index: 0, length: 0 });
    alice.broadcastPresence({ index: 70, length: 0 });
    bob.broadcastPresence({ index: 120, length: 0 });

    await new Promise((r) => setTimeout(r, 30));

    // Charlie attempts edit while in Viewer role -> should be rejected/no-op
    assert.equal(charlie.canEdit(), false);
    let charlieEditAttemptReceived = false;
    alice.on('remoteDelta', (d) => {
      if (d.senderUser?.id === 'user_charlie_viewer') {
        charlieEditAttemptReceived = true;
      }
    });

    charlie.broadcastDelta({ ops: [{ insert: 'Unauthorized edit' }] }, '<p>Unauthorized edit</p>');

    await new Promise((r) => setTimeout(r, 20));
    assert.equal(charlieEditAttemptReceived, false, 'Viewer must not be permitted to broadcast deltas');

    // Charlie requests Edit Access
    charlie.requestEditAccess('Need to contribute performance benchmark figures');

    await new Promise((r) => setTimeout(r, 35));

    // Verify Alice received request and approved
    assert.ok(aliceReceivedPermissionReq);
    assert.equal(aliceReceivedPermissionReq.id, 'user_charlie_viewer');

    // Verify Charlie was promoted to Editor
    assert.equal(charlieReceivedElevation, ROLES.EDITOR);
    assert.equal(charlie.currentRole, ROLES.EDITOR);
    assert.equal(charlie.canEdit(), true);

    // Charlie can now write content
    const charliePara3 = '<p>Benchmark results indicate sub-5ms sync latency across tabs.</p>';
    const fullHtmlStep5 = `${fullHtmlStep2}${charliePara3}`;
    const charlieDelta = {
      ops: [{ retain: 250 }, { insert: 'Benchmark results indicate sub-5ms sync latency across tabs.\n' }]
    };

    charlie.broadcastDelta(charlieDelta, fullHtmlStep5, 3);

    await new Promise((r) => setTimeout(r, 30));

    // Verify Alice and Bob received Charlie's edit
    assert.equal(aliceDoc.html, fullHtmlStep5);
    assert.equal(bobDoc.html, fullHtmlStep5);
    assert.ok(aliceDoc.html.includes('Benchmark results indicate sub-5ms sync latency'));

    // -------------------------------------------------------------------------
    // Final Verification: Document State, Comments, and Presence Roster
    // -------------------------------------------------------------------------
    // 1. Document state consistency
    assert.equal(aliceDoc.html, bobDoc.html);
    assert.ok(aliceDoc.html.includes('Distributed Consensus'));
    assert.ok(aliceDoc.html.includes('Table 1 describes latency metrics'));
    assert.ok(aliceDoc.html.includes('<table style="width:100%;border-collapse:collapse;margin:12px 0;">'));
    assert.ok(aliceDoc.html.includes('Benchmark results indicate sub-5ms sync latency'));

    // 2. Comments consistency
    const aliceComments = aliceCommentMgr.getAllComments();
    const bobComments = bobCommentMgr.getAllComments();
    assert.equal(aliceComments.length, 1);
    assert.equal(bobComments.length, 1);
    assert.equal(aliceComments[0].id, bobComments[0].id);
    assert.equal(aliceComments[0].replies.length, 1);
    assert.equal(bobComments[0].replies.length, 1);
    assert.equal(aliceComments[0].replies[0].text, bobComments[0].replies[0].text);

    // 3. Presence roster count and status
    assert.equal(alice.getPeers().length, 2);
    assert.equal(bob.getPeers().length, 2);
    assert.equal(charlie.getPeers().length, 2);

    // Cleanup all instances
    alice.stop();
    bob.stop();
    charlie.stop();
  });

  test('simultaneous rapid edits are received and processed without dropping events', async () => {
    const docId = 'doc_rapid_concurrency';

    const user1 = new CollaborationEngine(
      docId,
      { id: 'user_p1', name: 'Participant 1' },
      ROLES.EDITOR,
      { useMockChannel: true }
    );

    const user2 = new CollaborationEngine(
      docId,
      { id: 'user_p2', name: 'Participant 2' },
      ROLES.EDITOR,
      { useMockChannel: true }
    );

    const receivedByUser1 = [];
    const receivedByUser2 = [];

    user1.on('remoteDelta', (data) => receivedByUser1.push(data));
    user2.on('remoteDelta', (data) => receivedByUser2.push(data));

    // Simultaneously broadcast 10 rapid edits from each user
    const EDIT_COUNT = 10;
    for (let i = 0; i < EDIT_COUNT; i++) {
      user1.broadcastDelta({ ops: [{ insert: `P1 edit ${i}\n` }] }, `<p>P1 edit ${i}</p>`, i + 1);
      user2.broadcastDelta({ ops: [{ insert: `P2 edit ${i}\n` }] }, `<p>P2 edit ${i}</p>`, i + 1);
    }

    await new Promise((r) => setTimeout(r, 60));

    assert.equal(receivedByUser1.length, EDIT_COUNT);
    assert.equal(receivedByUser2.length, EDIT_COUNT);

    user1.stop();
    user2.stop();
  });
});
