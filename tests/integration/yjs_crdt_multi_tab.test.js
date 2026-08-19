import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from 'y-protocols/awareness';

describe('Yjs CRDT Multi-Tab Real-Time Sync & Awareness Integration', () => {
  let docA, docB, docC;
  let awarenessA, awarenessB, awarenessC;

  beforeEach(() => {
    docA = new Y.Doc();
    docB = new Y.Doc();
    docC = new Y.Doc();

    awarenessA = new Awareness(docA);
    awarenessB = new Awareness(docB);
    awarenessC = new Awareness(docC);

    // Wire simulated mesh sync between tabs (BroadcastChannel simulation)
    const docs = [docA, docB, docC];
    docs.forEach((doc, idx) => {
      doc.on('update', (update) => {
        docs.forEach((otherDoc, otherIdx) => {
          if (idx !== otherIdx) {
            Y.applyUpdate(otherDoc, update);
          }
        });
      });
    });

    const awarenesses = [awarenessA, awarenessB, awarenessC];
    awarenesses.forEach((aw, idx) => {
      aw.on('update', ({ added, updated, removed }, origin) => {
        if (origin !== 'remote') {
          const changedClients = added.concat(updated, removed);
          const update = encodeAwarenessUpdate(aw, changedClients);
          awarenesses.forEach((otherAw, otherIdx) => {
            if (idx !== otherIdx) {
              applyAwarenessUpdate(otherAw, update, 'remote');
            }
          });
        }
      });
    });
  });

  afterEach(() => {
    awarenessA.destroy();
    awarenessB.destroy();
    awarenessC.destroy();
    docA.destroy();
    docB.destroy();
    docC.destroy();
  });

  test('3-tab concurrent typing and convergence without dropped edits', () => {
    const textA = docA.getText('quill');
    const textB = docB.getText('quill');
    const textC = docC.getText('quill');

    // Tab A initializes title
    textA.insert(0, 'System Architecture\n');

    // Tab B and Tab C concurrently insert sections
    textB.insert(textB.length, 'Section 1: CRDTs\n');
    textC.insert(textC.length, 'Section 2: WebRTC\n');

    assert.equal(textA.toString(), textB.toString());
    assert.equal(textB.toString(), textC.toString());
    assert.ok(textA.toString().includes('System Architecture'));
    assert.ok(textA.toString().includes('Section 1: CRDTs'));
    assert.ok(textA.toString().includes('Section 2: WebRTC'));
  });

  test('3-tab presence awareness propagates user profiles and cursor states', () => {
    // Set awareness states for 3 tabs
    awarenessA.setLocalStateField('user', {
      id: 'user_alice',
      name: 'Alice (Owner)',
      color: '#EA4335',
      role: 'owner'
    });

    awarenessB.setLocalStateField('user', {
      id: 'user_bob',
      name: 'Bob (Editor)',
      color: '#34A853',
      role: 'editor'
    });

    awarenessC.setLocalStateField('user', {
      id: 'user_charlie',
      name: 'Charlie (Viewer)',
      color: '#FBBC05',
      role: 'viewer'
    });

    // Check states observed in Tab A
    const statesInA = awarenessA.getStates();
    assert.equal(statesInA.size, 3);

    const userNames = Array.from(statesInA.values()).map(s => s.user?.name);
    assert.ok(userNames.includes('Alice (Owner)'));
    assert.ok(userNames.includes('Bob (Editor)'));
    assert.ok(userNames.includes('Charlie (Viewer)'));

    // Move cursor in Tab B
    awarenessB.setLocalStateField('cursor', { anchor: 10, head: 15 });

    const bobInA = Array.from(awarenessA.getStates().values()).find(s => s.user?.id === 'user_bob');
    assert.deepEqual(bobInA.cursor, { anchor: 10, head: 15 });
  });

  test('3-tab permission elevation flow from Viewer to Editor', () => {
    const permsA = docA.getMap('permissions');
    const reqsC = docC.getArray('accessRequests');
    const reqsA = docA.getArray('accessRequests');
    const permsC = docC.getMap('permissions');

    // Charlie requests edit access in Tab C
    reqsC.push([{
      id: 'req_viewer_1',
      userId: 'user_charlie',
      userName: 'Charlie',
      requestedRole: 'editor',
      status: 'pending'
    }]);

    // Alice sees the request in Tab A and approves
    assert.equal(reqsA.length, 1);
    assert.equal(reqsA.get(0).userId, 'user_charlie');

    docA.transact(() => {
      permsA.set('user_charlie', 'editor');
      reqsA.delete(0, 1);
      reqsA.insert(0, [{
        id: 'req_viewer_1',
        userId: 'user_charlie',
        userName: 'Charlie',
        requestedRole: 'editor',
        status: 'approved'
      }]);
    });

    // Charlie in Tab C receives the elevated permission
    assert.equal(permsC.get('user_charlie'), 'editor');
    assert.equal(reqsC.get(0).status, 'approved');
  });
});
