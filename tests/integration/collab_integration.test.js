import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { CollaborationEngine, MockBroadcastChannel } from '../../src/collaboration/engine.ts';
import { ROLES } from '../../src/permissions/manager.ts';
import { CommentManager } from '../../src/comments/commentManager.ts';
import { generateShareUrl, parseShareUrl } from '../../src/permissions/share.ts';

describe('Real-Time Collaboration End-to-End Integration', () => {
  beforeEach(() => {
    MockBroadcastChannel.resetAllChannels();
  });

  test('3-peer multi-role collaboration session (Owner, Editor, Viewer)', async () => {
    const docId = 'doc_e2e_strategy';

    // 1. Owner initializes document
    const owner = new CollaborationEngine(docId, { id: 'user_owner', name: 'Alice (Owner)', color: '#ea4335' }, ROLES.OWNER, {
      useMockChannel: true
    });

    // 2. Editor joins via share link
    const editorLink = generateShareUrl({ docId, role: ROLES.EDITOR, user: 'Bob (Editor)' });
    const editorParams = parseShareUrl(editorLink);

    const editor = new CollaborationEngine(editorParams.docId, { id: 'user_editor', name: editorParams.user, color: '#34a853' }, editorParams.role, {
      useMockChannel: true
    });

    // 3. Viewer joins via share link
    const viewerLink = generateShareUrl({ docId, role: ROLES.VIEWER, user: 'Charlie (Viewer)' });
    const viewerParams = parseShareUrl(viewerLink);

    const viewer = new CollaborationEngine(viewerParams.docId, { id: 'user_viewer', name: viewerParams.user, color: '#fbbc05' }, viewerParams.role, {
      useMockChannel: true
    });

    // Broadcast initial presences
    owner.broadcastPresence({ index: 0, length: 0 });
    editor.broadcastPresence({ index: 50, length: 0 });
    viewer.broadcastPresence({ index: 10, length: 0 });

    await new Promise((r) => setTimeout(r, 40));

    // Verify presence visibility across peers
    assert.equal(owner.getPeers().length, 2);
    assert.equal(editor.getPeers().length, 2);
    assert.equal(viewer.getPeers().length, 2);

    // 4. Editor writes content
    let ownerReceivedDelta = null;
    owner.on('remoteDelta', (data) => {
      ownerReceivedDelta = data;
    });

    editor.broadcastDelta({ ops: [{ insert: 'New section on architecture.' }] }, '<p>New section on architecture.</p>');

    await new Promise((r) => setTimeout(r, 30));

    assert.ok(ownerReceivedDelta);
    assert.equal(ownerReceivedDelta.fullHtml, '<p>New section on architecture.</p>');

    // 5. Viewer attempts elevation request and owner approves
    owner.on('permissionRequest', (reqUser) => {
      owner.grantEditAccess(reqUser.id, ROLES.EDITOR);
    });

    viewer.requestEditAccess('Need to edit conclusions section');

    await new Promise((r) => setTimeout(r, 40));

    assert.equal(viewer.currentRole, ROLES.EDITOR);
    assert.equal(viewer.canEdit(), true);

    // 6. Comments exchange
    const commentMgr = new CommentManager();
    const comment = commentMgr.createComment({
      author: { id: viewer.currentUser.id, name: viewer.currentUser.name },
      text: 'Great work team!',
      anchorRange: { index: 0, length: 15 }
    });

    viewer.broadcastCommentSync('create', comment);

    let editorReceivedCommentAction = null;
    editor.on('commentSync', (commentData) => {
      editorReceivedCommentAction = commentData;
    });

    viewer.broadcastCommentSync('create', comment);

    await new Promise((r) => setTimeout(r, 30));

    assert.ok(editorReceivedCommentAction);
    assert.equal(editorReceivedCommentAction.action, 'create');
    assert.equal(editorReceivedCommentAction.comment.text, 'Great work team!');

    owner.stop();
    editor.stop();
    viewer.stop();
  });
});
