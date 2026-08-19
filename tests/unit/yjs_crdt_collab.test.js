import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  deriveRoomId,
  getRandomCollabColor,
  COLLAB_COLORS,
  DEFAULT_SIGNALING_SERVERS
} from '../../src/collab/useYjsDoc.ts';

describe('Yjs CRDT Collaboration - Room & Palette Utilities', () => {
  test('returns valid collaborator colors from Google Docs palette', () => {
    assert.ok(COLLAB_COLORS.length >= 8);
    const color = getRandomCollabColor();
    assert.ok(COLLAB_COLORS.includes(color));
    assert.match(color, /^#[0-9A-Fa-f]{6}$/);
  });

  test('derives room ID correctly from explicit string', () => {
    assert.equal(deriveRoomId('my-doc-123'), 'my-doc-123');
    assert.equal(deriveRoomId('#doc=project-phoenix'), 'project-phoenix');
    assert.equal(deriveRoomId('?doc=finance-q3'), 'finance-q3');
  });

  test('falls back to default room ID if empty or missing in non-browser context', () => {
    assert.equal(deriveRoomId(null), 'google-docs-demo');
    assert.equal(deriveRoomId(''), 'google-docs-demo');
    assert.equal(deriveRoomId('   '), 'google-docs-demo');
  });

  test('provides public default WebRTC signaling servers', () => {
    assert.ok(Array.isArray(DEFAULT_SIGNALING_SERVERS));
    assert.ok(DEFAULT_SIGNALING_SERVERS.length >= 2);
    assert.ok(DEFAULT_SIGNALING_SERVERS[0].startsWith('wss://'));
  });
});

describe('Yjs CRDT Document & Permissions Synchronization', () => {
  let doc1, doc2;

  beforeEach(() => {
    doc1 = new Y.Doc();
    doc2 = new Y.Doc();

    // Mutual update syncing simulation between doc1 and doc2
    doc1.on('update', (update) => {
      Y.applyUpdate(doc2, update);
    });
    doc2.on('update', (update) => {
      Y.applyUpdate(doc1, update);
    });
  });

  afterEach(() => {
    doc1.destroy();
    doc2.destroy();
  });

  test('synchronizes rich-text operations concurrently without conflict', () => {
    const text1 = doc1.getText('quill');
    const text2 = doc2.getText('quill');

    // Alice types in doc1
    text1.insert(0, 'Hello World');

    assert.equal(text2.toString(), 'Hello World');

    // Bob types concurrently at end in doc2, Alice types at start in doc1
    text1.insert(0, '[Draft] ');
    text2.insert(text2.length, ' - Finalized');

    assert.equal(text1.toString(), '[Draft] Hello World - Finalized');
    assert.equal(text2.toString(), '[Draft] Hello World - Finalized');
  });

  test('synchronizes permissions map across collaborating peers', () => {
    const perms1 = doc1.getMap('permissions');
    const perms2 = doc2.getMap('permissions');

    let peer2ObservedRole = null;
    perms2.observe(() => {
      peer2ObservedRole = perms2.get('user_bob');
    });

    // Owner in Doc1 assigns editor role to Bob
    perms1.set('user_bob', 'editor');

    assert.equal(perms2.get('user_bob'), 'editor');
    assert.equal(peer2ObservedRole, 'editor');

    // Owner elevates Bob to Owner
    perms1.set('user_bob', 'owner');
    assert.equal(perms2.get('user_bob'), 'owner');
    assert.equal(peer2ObservedRole, 'owner');
  });

  test('manages access requests queue and approval workflow via Y.Array', () => {
    const reqArray1 = doc1.getArray('accessRequests');
    const reqArray2 = doc2.getArray('accessRequests');
    const perms1 = doc1.getMap('permissions');
    const perms2 = doc2.getMap('permissions');

    // Charlie (viewer on doc2) requests edit access
    const request = {
      id: 'req_101',
      userId: 'user_charlie',
      userName: 'Charlie Davis',
      requestedRole: 'editor',
      reason: 'Need to add benchmarking data',
      status: 'pending',
      timestamp: Date.now()
    };

    reqArray2.push([request]);

    // Doc1 observes the request
    assert.equal(reqArray1.length, 1);
    assert.equal(reqArray1.get(0).userName, 'Charlie Davis');
    assert.equal(reqArray1.get(0).status, 'pending');

    // Owner on doc1 approves Charlie's request and grants edit access
    doc1.transact(() => {
      perms1.set('user_charlie', 'editor');
      const reqs = reqArray1.toArray();
      reqs.forEach((r, idx) => {
        if (r.userId === 'user_charlie' && r.status === 'pending') {
          reqArray1.delete(idx, 1);
          reqArray1.insert(idx, [{ ...r, status: 'approved', resolvedAt: Date.now() }]);
        }
      });
    });

    // Verify convergence on both documents
    assert.equal(perms2.get('user_charlie'), 'editor');
    assert.equal(reqArray2.get(0).status, 'approved');
  });

  test('tracks document metadata title synchronization', () => {
    const meta1 = doc1.getMap('meta');
    const meta2 = doc2.getMap('meta');

    meta1.set('title', 'Distributed Consensus Protocol 2026');
    assert.equal(meta2.get('title'), 'Distributed Consensus Protocol 2026');
  });

  test('supports UndoManager undo and redo for text modifications', () => {
    const text1 = doc1.getText('quill');
    const undoManager = new Y.UndoManager(text1);

    text1.insert(0, 'Initial text.');
    assert.equal(text1.toString(), 'Initial text.');

    undoManager.undo();
    assert.equal(text1.toString(), '');

    undoManager.redo();
    assert.equal(text1.toString(), 'Initial text.');

    undoManager.destroy();
  });
});

describe('Remote Cursors & Selection Stylesheet', () => {
  test('remoteCursors.css exists and defines expected classes', () => {
    const cssPath = resolve('src/collab/remoteCursors.css');
    assert.ok(existsSync(cssPath), 'remoteCursors.css must exist');

    const cssContent = readFileSync(cssPath, 'utf8');

    // Verify .yRemoteSelection
    assert.ok(cssContent.includes('.ql-editor .yRemoteSelection'), 'CSS must include .ql-editor .yRemoteSelection');

    // Verify .yRemoteSelectionHead
    assert.ok(cssContent.includes('.ql-editor .yRemoteSelectionHead'), 'CSS must include .ql-editor .yRemoteSelectionHead');

    // Verify floating name tags and tooltips
    assert.ok(cssContent.includes('.yRemoteSelectionHeadLabel') || cssContent.includes('.yRemoteSelectionHead > div') || cssContent.includes('.yRemoteSelectionHead::after'), 'CSS must include tooltip/tag styling for remote selection head');

    // Verify cursor compatibility classes
    assert.ok(cssContent.includes('.remote-cursor'), 'CSS must style .remote-cursor');
    assert.ok(cssContent.includes('.ql-cursor'), 'CSS must style .ql-cursor');
  });
});
