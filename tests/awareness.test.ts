import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";
import { AwarenessManager } from "../lib/awareness";

describe("Awareness Protocol & Multi-User Presence", () => {
  describe("Local Awareness State Initialization and Updates", () => {
    it("should initialize awareness instance on a Y.Doc", () => {
      const doc = new Y.Doc();
      const awareness = new awarenessProtocol.Awareness(doc);

      assert.strictEqual(awareness.doc, doc);
      assert.strictEqual(awareness.clientID, doc.clientID);
      assert.deepStrictEqual(awareness.getLocalState(), {});

      awareness.destroy();
      doc.destroy();
    });

    it("should set and update user profile data (name, color, avatar, email)", () => {
      const doc = new Y.Doc();
      const awareness = new awarenessProtocol.Awareness(doc);

      const userProfile = {
        id: "usr-alice",
        name: "Alice Smith",
        email: "alice@example.com",
        color: "#4285F4",
        avatar_url: "https://example.com/alice.png",
      };

      awareness.setLocalStateField("user", userProfile);

      const localState = awareness.getLocalState();
      assert.ok(localState !== null);
      assert.deepStrictEqual(localState?.user, userProfile);
      assert.strictEqual(localState?.user?.name, "Alice Smith");
      assert.strictEqual(localState?.user?.color, "#4285F4");

      // Update user color
      awareness.setLocalStateField("user", {
        ...userProfile,
        color: "#EA4335",
      });

      assert.strictEqual(awareness.getLocalState()?.user?.color, "#EA4335");

      awareness.destroy();
      doc.destroy();
    });

    it("should set and update multi-user cursor and selection ranges", () => {
      const doc = new Y.Doc();
      const awareness = new awarenessProtocol.Awareness(doc);

      awareness.setLocalState({
        user: { id: "u-1", name: "Bob", color: "#34A853" },
        cursor: { anchor: 42, head: 42 },
        selection: null,
      });

      let state = awareness.getLocalState();
      assert.deepStrictEqual(state?.cursor, { anchor: 42, head: 42 });

      // Move cursor and select text
      awareness.setLocalStateField("cursor", { anchor: 10, head: 25 });
      awareness.setLocalStateField("selection", { anchor: 10, head: 25 });

      state = awareness.getLocalState();
      assert.deepStrictEqual(state?.cursor, { anchor: 10, head: 25 });
      assert.deepStrictEqual(state?.selection, { anchor: 10, head: 25 });

      awareness.destroy();
      doc.destroy();
    });
  });

  describe("Multi-User Presence Synchronization & Update Exchange", () => {
    it("should exchange presence updates between multiple clients", () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();
      const awareness1 = new awarenessProtocol.Awareness(doc1);
      const awareness2 = new awarenessProtocol.Awareness(doc2);

      // Pipe awareness updates between peer 1 and peer 2
      awareness1.on("update", ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
        if (origin !== "peer2") {
          const update = awarenessProtocol.encodeAwarenessUpdate(awareness1, added.concat(updated, removed));
          awarenessProtocol.applyAwarenessUpdate(awareness2, update, "peer1");
        }
      });

      awareness2.on("update", ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
        if (origin !== "peer1") {
          const update = awarenessProtocol.encodeAwarenessUpdate(awareness2, added.concat(updated, removed));
          awarenessProtocol.applyAwarenessUpdate(awareness1, update, "peer2");
        }
      });

      // Peer 1 sets user & cursor
      awareness1.setLocalState({
        user: { id: "p1", name: "Peer One", color: "#1A73E8" },
        cursor: { anchor: 5, head: 5 },
      });

      // Verify Peer 2 received Peer 1 state
      const stateOn2 = awareness2.getStates().get(doc1.clientID);
      assert.ok(stateOn2);
      assert.strictEqual(stateOn2.user.name, "Peer One");
      assert.deepStrictEqual(stateOn2.cursor, { anchor: 5, head: 5 });

      // Peer 2 sets user & selection
      awareness2.setLocalState({
        user: { id: "p2", name: "Peer Two", color: "#FBBC04" },
        cursor: { anchor: 120, head: 135 },
      });

      // Verify Peer 1 received Peer 2 state
      const stateOn1 = awareness1.getStates().get(doc2.clientID);
      assert.ok(stateOn1);
      assert.strictEqual(stateOn1.user.name, "Peer Two");
      assert.deepStrictEqual(stateOn1.cursor, { anchor: 120, head: 135 });

      awareness1.destroy();
      awareness2.destroy();
      doc1.destroy();
      doc2.destroy();
    });

    it("should track 3 concurrent collaborators in a shared document session", () => {
      const docs = [new Y.Doc(), new Y.Doc(), new Y.Doc()];
      const awarenessList = docs.map((d) => new awarenessProtocol.Awareness(d));

      const broadcastAwareness = (senderIdx: number, changedClients: number[]) => {
        const update = awarenessProtocol.encodeAwarenessUpdate(awarenessList[senderIdx], changedClients);
        awarenessList.forEach((targetAwareness, targetIdx) => {
          if (targetIdx !== senderIdx) {
            awarenessProtocol.applyAwarenessUpdate(targetAwareness, update, "broadcast");
          }
        });
      };

      awarenessList.forEach((aw, idx) => {
        aw.on("update", ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
          if (origin !== "broadcast") {
            broadcastAwareness(idx, added.concat(updated, removed));
          }
        });
      });

      // Client 0 (Owner)
      awarenessList[0].setLocalState({
        user: { id: "owner-1", name: "Alice (Owner)", color: "#1A73E8" },
        cursor: { anchor: 0, head: 0 },
      });

      // Client 1 (Editor)
      awarenessList[1].setLocalState({
        user: { id: "editor-1", name: "Bob (Editor)", color: "#34A853" },
        cursor: { anchor: 50, head: 50 },
      });

      // Client 2 (Viewer)
      awarenessList[2].setLocalState({
        user: { id: "viewer-1", name: "Charlie (Viewer)", color: "#EA4335" },
        cursor: { anchor: 150, head: 175 },
      });

      // Verify all 3 awareness instances track all 3 clients
      for (const aw of awarenessList) {
        const states = aw.getStates();
        assert.strictEqual(states.size, 3);
        assert.ok(states.has(docs[0].clientID));
        assert.ok(states.has(docs[1].clientID));
        assert.ok(states.has(docs[2].clientID));
      }

      // Client 1 moves cursor
      awarenessList[1].setLocalStateField("cursor", { anchor: 75, head: 80 });

      assert.deepStrictEqual(
        awarenessList[0].getStates().get(docs[1].clientID)?.cursor,
        { anchor: 75, head: 80 }
      );

      awarenessList.forEach((aw) => aw.destroy());
      docs.forEach((d) => d.destroy());
    });

    it("should notify awareness change listeners on added, updated, and removed events", () => {
      const docA = new Y.Doc();
      const docB = new Y.Doc();
      const awA = new awarenessProtocol.Awareness(docA);
      const awB = new awarenessProtocol.Awareness(docB);

      const events: Array<{ added: number[]; updated: number[]; removed: number[] }> = [];
      awA.on("change", (change: { added: number[]; updated: number[]; removed: number[] }) => {
        events.push(change);
      });

      // Apply Peer B update to Peer A
      awB.setLocalState({ user: { name: "Collaborator" } });
      const update = awarenessProtocol.encodeAwarenessUpdate(awB, [docB.clientID]);
      awarenessProtocol.applyAwarenessUpdate(awA, update, "peerB");

      assert.strictEqual(events.length, 1);
      assert.deepStrictEqual(events[0].added, [docB.clientID]);

      // Remove Peer B
      awarenessProtocol.removeAwarenessStates(awA, [docB.clientID], "disconnect");
      assert.strictEqual(events.length, 2);
      assert.deepStrictEqual(events[1].removed, [docB.clientID]);

      awA.destroy();
      awB.destroy();
      docA.destroy();
      docB.destroy();
    });
  });

  describe("AwarenessManager and Stale Client Timeout Eviction", () => {
    it("should aggregate active peers with user and cursor positions via AwarenessManager", () => {
      const doc = new Y.Doc();
      const manager = new AwarenessManager(doc);

      manager.setUser({
        id: "usr-mgr",
        name: "Dana Scully",
        email: "dana@fbi.gov",
        color: "#AF5CF7",
      });
      manager.setCursor({ anchor: 30, head: 45 });
      manager.setSelection({ anchor: 30, head: 45 });

      const peers = manager.getActivePeers();
      assert.strictEqual(peers.length, 1);
      assert.strictEqual(peers[0].clientId, doc.clientID);
      assert.strictEqual(peers[0].user.name, "Dana Scully");
      assert.strictEqual(peers[0].color, "#AF5CF7");
      assert.deepStrictEqual(peers[0].cursor, { anchor: 30, head: 45 });
      assert.deepStrictEqual(peers[0].selection, { anchor: 30, head: 45 });

      manager.destroy();
      doc.destroy();
    });

    it("should evict stale remote clients after timeout threshold", () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();
      const doc3 = new Y.Doc();

      const manager1 = new AwarenessManager(doc1);
      const aw2 = new awarenessProtocol.Awareness(doc2);
      const aw3 = new awarenessProtocol.Awareness(doc3);

      const now = Date.now();

      // Client 2 (Inactive, last updated 40 seconds ago)
      aw2.setLocalState({
        user: { id: "stale-bob", name: "Bob", color: "#34A853" },
        lastUpdated: now - 40000,
      });

      // Client 3 (Active, updated 2 seconds ago)
      aw3.setLocalState({
        user: { id: "active-charlie", name: "Charlie", color: "#EA4335" },
        lastUpdated: now - 2000,
      });

      // Feed both remote states to manager1
      const update2 = awarenessProtocol.encodeAwarenessUpdate(aw2, [doc2.clientID]);
      const update3 = awarenessProtocol.encodeAwarenessUpdate(aw3, [doc3.clientID]);
      awarenessProtocol.applyAwarenessUpdate(manager1.awareness, update2, "remote");
      awarenessProtocol.applyAwarenessUpdate(manager1.awareness, update3, "remote");

      assert.strictEqual(manager1.awareness.getStates().size, 3);

      // Perform eviction sweep with 30s timeout threshold
      const evicted = manager1.evictStaleClients(30000, now);

      assert.strictEqual(evicted.length, 1);
      assert.strictEqual(evicted[0], doc2.clientID);

      // Verify Bob was removed and Charlie remains
      const remainingStates = manager1.awareness.getStates();
      assert.strictEqual(remainingStates.has(doc2.clientID), false);
      assert.strictEqual(remainingStates.has(doc3.clientID), true);
      assert.strictEqual(remainingStates.size, 2);

      manager1.destroy();
      aw2.destroy();
      aw3.destroy();
      doc1.destroy();
      doc2.destroy();
      doc3.destroy();
    });

    it("should never evict local client during stale sweeper runs", () => {
      const doc = new Y.Doc();
      const manager = new AwarenessManager(doc);

      const pastTime = Date.now() - 100000;
      manager.awareness.setLocalState({
        user: { id: "self", name: "Myself" },
        lastUpdated: pastTime,
      });

      const evicted = manager.evictStaleClients(30000, Date.now());
      assert.deepStrictEqual(evicted, []);
      assert.ok(manager.awareness.getStates().has(doc.clientID));

      manager.destroy();
      doc.destroy();
    });
  });
});
