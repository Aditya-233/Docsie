import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  MESSAGE_TYPES,
  validatePacket,
  isValidPacket,
  createPacket,
  createDocDeltaPacket,
  createPresencePacket,
  createSelectionPacket,
  createPermissionReqPacket,
  createPermissionGrantPacket,
  createDocSyncPacket,
  createCommentSyncPacket,
  CollaborationProtocol
} from '../../src/collaboration/protocol.js';

import { PresenceTracker } from '../../src/collaboration/presence.js';
import { CollaborationEngine, MockBroadcastChannel } from '../../src/collaboration/engine.js';
import { ROLES } from '../../src/permissions/manager.js';

describe('Collaboration Protocol', () => {
  test('defines required message types', () => {
    assert.equal(MESSAGE_TYPES.DOC_DELTA, 'DOC_DELTA');
    assert.equal(MESSAGE_TYPES.PRESENCE, 'PRESENCE');
    assert.equal(MESSAGE_TYPES.SELECTION, 'SELECTION');
    assert.equal(MESSAGE_TYPES.PERMISSION_REQ, 'PERMISSION_REQ');
    assert.equal(MESSAGE_TYPES.PERMISSION_GRANT, 'PERMISSION_GRANT');
    assert.equal(MESSAGE_TYPES.DOC_SYNC, 'DOC_SYNC');
    assert.equal(MESSAGE_TYPES.COMMENT_SYNC, 'COMMENT_SYNC');
  });

  test('validates well-formed packets', () => {
    const packet = createDocDeltaPacket({ id: 'u1', name: 'Alice' }, 'editor', 'doc_1', {
      delta: { ops: [{ insert: 'Hello' }] }
    });

    const res = validatePacket(packet);
    assert.equal(res.valid, true);
    assert.equal(res.errors.length, 0);
    assert.equal(isValidPacket(packet), true);
  });

  test('rejects invalid packets', () => {
    assert.equal(isValidPacket(null), false);
    assert.equal(isValidPacket({}), false);
    assert.equal(isValidPacket({ type: 'INVALID_TYPE', senderId: 'u1', payload: {} }), false);
    assert.equal(isValidPacket({ type: 'DOC_DELTA', senderId: 'u1', payload: {} }), false);
  });

  test('creates all specialized packet types correctly', () => {
    const user = { id: 'u1', name: 'Alice', color: '#ff0000' };

    const presence = createPresencePacket(user, 'editor', 'doc_1', {
      cursorRange: { index: 5, length: 0 },
      status: 'active'
    });
    assert.equal(presence.type, MESSAGE_TYPES.PRESENCE);
    assert.equal(presence.payload.cursorRange.index, 5);

    const selection = createSelectionPacket(user, 'editor', 'doc_1', {
      range: { index: 2, length: 10 }
    });
    assert.equal(selection.type, MESSAGE_TYPES.SELECTION);
    assert.equal(selection.payload.range.length, 10);

    const req = createPermissionReqPacket(user, 'viewer', 'doc_1', { reason: 'Need to edit section 2' });
    assert.equal(req.type, MESSAGE_TYPES.PERMISSION_REQ);
    assert.equal(req.payload.reason, 'Need to edit section 2');

    const grant = createPermissionGrantPacket(user, 'owner', 'doc_1', { targetUserId: 'u2', newRole: 'editor' });
    assert.equal(grant.type, MESSAGE_TYPES.PERMISSION_GRANT);
    assert.equal(grant.payload.targetUserId, 'u2');

    const docSync = createDocSyncPacket(user, 'owner', 'doc_1', { action: 'request' });
    assert.equal(docSync.type, MESSAGE_TYPES.DOC_SYNC);

    const commentSync = createCommentSyncPacket(user, 'commenter', 'doc_1', { action: 'create', commentId: 'c1' });
    assert.equal(commentSync.type, MESSAGE_TYPES.COMMENT_SYNC);
  });
});

describe('PresenceTracker', () => {
  let tracker;

  beforeEach(() => {
    tracker = new PresenceTracker({ staleThresholdMs: 500 });
  });

  test('registers and updates peer presence', () => {
    tracker.updatePeer('peer_1', {
      user: { id: 'peer_1', name: 'Bob', color: '#00ff00' },
      role: 'editor',
      cursorRange: { index: 12, length: 0 }
    });

    assert.equal(tracker.hasPeer('peer_1'), true);
    const peer = tracker.getPeer('peer_1');
    assert.equal(peer.user.name, 'Bob');
    assert.equal(peer.cursorRange.index, 12);
    assert.equal(tracker.getAllPeers().length, 1);
  });

  test('updates cursor and selection independently', () => {
    tracker.updatePeer('peer_1', { user: { id: 'peer_1', name: 'Bob' } });
    tracker.updateCursor('peer_1', { index: 20, length: 0 }, { top: 100, left: 50 });
    tracker.updateSelection('peer_1', { index: 20, length: 5 });

    const peer = tracker.getPeer('peer_1');
    assert.equal(peer.cursorRange.index, 20);
    assert.equal(peer.cursorCoords.top, 100);
    assert.equal(peer.selection.length, 5);
  });

  test('evicts stale peers exceeding threshold', async () => {
    tracker.updatePeer('peer_1', { user: { id: 'peer_1', name: 'Bob' } });
    tracker.updatePeer('peer_2', { user: { id: 'peer_2', name: 'Alice' } });

    assert.equal(tracker.getAllPeers().length, 2);

    // Simulate time passing by manually modifying lastSeen on peer_1
    const p1 = tracker.getPeer('peer_1');
    p1.lastSeen = Date.now() - 1000;

    const evicted = tracker.evictStalePeers(500);
    assert.deepEqual(evicted, ['peer_1']);
    assert.equal(tracker.hasPeer('peer_1'), false);
    assert.equal(tracker.hasPeer('peer_2'), true);
    assert.equal(tracker.getAllPeers().length, 1);
  });
});

describe('CollaborationEngine Multi-peer Synchronization', () => {
  beforeEach(() => {
    MockBroadcastChannel.resetAllChannels();
  });

  test('synchronizes delta and presence between peers via MockBroadcastChannel', async () => {
    const alice = new CollaborationEngine('doc_test_1', { id: 'alice_1', name: 'Alice', color: '#ff0000' }, ROLES.OWNER, {
      useMockChannel: true,
      heartbeatIntervalMs: 100000,
      cleanupIntervalMs: 100000
    });

    const bob = new CollaborationEngine('doc_test_1', { id: 'bob_1', name: 'Bob', color: '#0000ff' }, ROLES.EDITOR, {
      useMockChannel: true,
      heartbeatIntervalMs: 100000,
      cleanupIntervalMs: 100000
    });

    let receivedDelta = null;
    bob.on('remoteDelta', (data) => {
      receivedDelta = data;
    });

    // Alice broadcasts a delta
    alice.broadcastDelta({ ops: [{ insert: 'Antigravity Collab' }] }, '<p>Antigravity Collab</p>');

    await new Promise((r) => setTimeout(r, 20));

    assert.ok(receivedDelta);
    assert.deepEqual(receivedDelta.delta, { ops: [{ insert: 'Antigravity Collab' }] });
    assert.equal(receivedDelta.fullHtml, '<p>Antigravity Collab</p>');

    alice.stop();
    bob.stop();
  });

  test('handles dynamic role elevation flow between Viewer and Owner', async () => {
    const owner = new CollaborationEngine('doc_test_2', { id: 'owner_1', name: 'Owner' }, ROLES.OWNER, {
      useMockChannel: true
    });

    const viewer = new CollaborationEngine('doc_test_2', { id: 'viewer_1', name: 'Viewer' }, ROLES.VIEWER, {
      useMockChannel: true
    });

    let permissionRequestedUser = null;
    owner.on('permissionRequest', (user) => {
      permissionRequestedUser = user;
      // Owner grants access
      owner.grantEditAccess(user.id, ROLES.EDITOR);
    });

    let roleElevatedTo = null;
    viewer.on('roleElevated', (newRole) => {
      roleElevatedTo = newRole;
    });

    // Viewer requests edit access
    viewer.requestEditAccess('Need to contribute to chapter 1');

    await new Promise((r) => setTimeout(r, 30));

    assert.ok(permissionRequestedUser);
    assert.equal(permissionRequestedUser.id, 'viewer_1');
    assert.equal(roleElevatedTo, ROLES.EDITOR);
    assert.equal(viewer.currentRole, ROLES.EDITOR);
    assert.equal(viewer.canEdit(), true);

    owner.stop();
    viewer.stop();
  });
});
