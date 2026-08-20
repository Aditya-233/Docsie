import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import {
  uint8ArrayToHex,
  parseByteaToUint8Array,
  uint8ArrayToBase64,
  base64ToUint8Array,
  SupabaseYjsProvider,
  MESSAGE_SYNC,
} from "../lib/supabase/provider";

describe("Supabase Yjs Provider & State Synchronization", () => {
  describe("State Compaction and Bytea Encode/Decode", () => {
    it("should encode Uint8Array to Postgres BYTEA hex format (\\x...)", () => {
      const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x00, 0xff]);
      const hex = uint8ArrayToHex(bytes);
      assert.strictEqual(hex, "\\xdeadbeef00ff");
    });

    it("should parse Postgres BYTEA hex format back to Uint8Array", () => {
      const hex = "\\xdeadbeef00ff";
      const parsed = parseByteaToUint8Array(hex);
      assert.ok(parsed instanceof Uint8Array);
      assert.deepStrictEqual(Array.from(parsed), [0xde, 0xad, 0xbe, 0xef, 0x00, 0xff]);
    });

    it("should handle 0x prefix hex format", () => {
      const hex = "0x01020304";
      const parsed = parseByteaToUint8Array(hex);
      assert.ok(parsed instanceof Uint8Array);
      assert.deepStrictEqual(Array.from(parsed), [1, 2, 3, 4]);
    });

    it("should round-trip binary payloads through base64 conversion", () => {
      const original = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 255, 0, 128]);
      const base64 = uint8ArrayToBase64(original);
      const restored = base64ToUint8Array(base64);
      assert.deepStrictEqual(restored, original);
    });

    it("should parse raw Uint8Array and array inputs seamlessly", () => {
      const arr = [1, 2, 3];
      const fromArr = parseByteaToUint8Array(arr);
      assert.deepStrictEqual(Array.from(fromArr!), [1, 2, 3]);

      const uint8 = new Uint8Array([4, 5, 6]);
      const fromUint8 = parseByteaToUint8Array(uint8);
      assert.strictEqual(fromUint8, uint8);

      assert.strictEqual(parseByteaToUint8Array(null), null);
      assert.strictEqual(parseByteaToUint8Array(undefined), null);
    });

    it("should compact multiple incremental document updates into a single snapshot", () => {
      const doc = new Y.Doc();
      const ytext = doc.getText("content");
      const ymap = doc.getMap("meta");

      // Multiple incremental transactions
      for (let i = 0; i < 20; i++) {
        ytext.insert(ytext.length, "Paragraph " + i + ". ");
        ymap.set("version", i);
      }

      // Compact state into single snapshot update
      const compactSnapshot = Y.encodeStateAsUpdate(doc);
      assert.ok(compactSnapshot instanceof Uint8Array);
      assert.ok(compactSnapshot.length > 0);

      // Restore snapshot into a clean target doc
      const targetDoc = new Y.Doc();
      Y.applyUpdate(targetDoc, compactSnapshot);

      assert.strictEqual(targetDoc.getText("content").toString(), ytext.toString());
      assert.strictEqual(targetDoc.getMap("meta").get("version"), 19);

      doc.destroy();
      targetDoc.destroy();
    });

    it("should encode snapshot to BYTEA hex, store it, and decode to identical state in a new doc", () => {
      const sourceDoc = new Y.Doc();
      const text = sourceDoc.getText("editor");
      text.insert(0, "Collaborative Next.js + Tiptap + Supabase Document");
      sourceDoc.getMap("settings").set("theme", "dark");
      sourceDoc.getArray("tags").push(["collab", "crdt", "tiptap"]);

      // Encode to compact snapshot and then to bytea hex
      const snapshot = Y.encodeStateAsUpdate(sourceDoc);
      const byteaHex = uint8ArrayToHex(snapshot);

      // Decode from bytea hex
      const decodedBytes = parseByteaToUint8Array(byteaHex);
      assert.ok(decodedBytes !== null);

      const targetDoc = new Y.Doc();
      Y.applyUpdate(targetDoc, decodedBytes!);

      assert.strictEqual(targetDoc.getText("editor").toString(), "Collaborative Next.js + Tiptap + Supabase Document");
      assert.strictEqual(targetDoc.getMap("settings").get("theme"), "dark");
      assert.deepStrictEqual(targetDoc.getArray("tags").toArray(), ["collab", "crdt", "tiptap"]);

      sourceDoc.destroy();
      targetDoc.destroy();
    });
  });

  describe("2-Step Sync Handshake Protocol (SyncStep1, SyncStep2)", () => {
    it("should execute 2-step synchronization handshake between two divergent docs", () => {
      const docA = new Y.Doc();
      const docB = new Y.Doc();

      const textA = docA.getText("prosemirror");
      textA.insert(0, "Initial content from Doc A. ");

      const textB = docB.getText("prosemirror");
      textB.insert(0, "Pre-existing content from Doc B. ");

      // Step 1: Doc A sends SyncStep1 (its state vector) to Doc B
      const encoderA1 = encoding.createEncoder();
      encoding.writeVarUint(encoderA1, MESSAGE_SYNC);
      syncProtocol.writeSyncStep1(encoderA1, docA);
      const step1MsgFromA = encoding.toUint8Array(encoderA1);

      // Doc B receives SyncStep1 from A and generates SyncStep2 (missing updates for A)
      const decoderB = decoding.createDecoder(step1MsgFromA);
      const msgTypeB = decoding.readVarUint(decoderB);
      assert.strictEqual(msgTypeB, MESSAGE_SYNC);

      const encoderBResponse = encoding.createEncoder();
      encoding.writeVarUint(encoderBResponse, MESSAGE_SYNC);
      syncProtocol.readSyncMessage(decoderB, encoderBResponse, docB, "peerA");
      const step2MsgFromB = encoding.toUint8Array(encoderBResponse);

      // Doc A receives SyncStep2 from B and applies updates
      const decoderA = decoding.createDecoder(step2MsgFromB);
      const msgTypeA = decoding.readVarUint(decoderA);
      assert.strictEqual(msgTypeA, MESSAGE_SYNC);

      const dummyEncoderA = encoding.createEncoder();
      syncProtocol.readSyncMessage(decoderA, dummyEncoderA, docA, "peerB");

      // Now Doc B initiates SyncStep1 to get missing updates from Doc A
      const encoderB1 = encoding.createEncoder();
      encoding.writeVarUint(encoderB1, MESSAGE_SYNC);
      syncProtocol.writeSyncStep1(encoderB1, docB);
      const step1MsgFromB = encoding.toUint8Array(encoderB1);

      // Doc A replies with SyncStep2
      const decoderAFromB = decoding.createDecoder(step1MsgFromB);
      decoding.readVarUint(decoderAFromB);
      const encoderAResponse = encoding.createEncoder();
      encoding.writeVarUint(encoderAResponse, MESSAGE_SYNC);
      syncProtocol.readSyncMessage(decoderAFromB, encoderAResponse, docA, "peerB");
      const step2MsgFromA = encoding.toUint8Array(encoderAResponse);

      // Doc B applies SyncStep2 from A
      const decoderBFromA = decoding.createDecoder(step2MsgFromA);
      decoding.readVarUint(decoderBFromA);
      syncProtocol.readSyncMessage(decoderBFromA, encoding.createEncoder(), docB, "peerA");

      // Verify convergence
      assert.strictEqual(textA.toString(), textB.toString());
      assert.ok(textA.toString().includes("Initial content from Doc A. "));
      assert.ok(textA.toString().includes("Pre-existing content from Doc B. "));

      docA.destroy();
      docB.destroy();
    });

    it("should handle empty state vector handshake for newly joining client", () => {
      const serverDoc = new Y.Doc();
      serverDoc.getText("shared").insert(0, "Existing persistent document text");
      serverDoc.getMap("perms").set("allow", true);

      const clientDoc = new Y.Doc();

      // Client sends Step 1
      const clientStep1Encoder = encoding.createEncoder();
      syncProtocol.writeSyncStep1(clientStep1Encoder, clientDoc);

      // Server generates Step 2 response
      const serverStep2Encoder = encoding.createEncoder();
      const step1Decoder = decoding.createDecoder(encoding.toUint8Array(clientStep1Encoder));
      syncProtocol.readSyncMessage(step1Decoder, serverStep2Encoder, serverDoc, "client");

      // Client applies Step 2
      const step2Decoder = decoding.createDecoder(encoding.toUint8Array(serverStep2Encoder));
      syncProtocol.readSyncMessage(step2Decoder, encoding.createEncoder(), clientDoc, "server");

      assert.strictEqual(clientDoc.getText("shared").toString(), "Existing persistent document text");
      assert.strictEqual(clientDoc.getMap("perms").get("allow"), true);

      serverDoc.destroy();
      clientDoc.destroy();
    });
  });

  describe("Delta Exchange between Multiple Y.Doc Instances", () => {
    it("should synchronize real-time updates bidirectionally between 2 peer documents", () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();

      const text1 = doc1.getText("content");
      const text2 = doc2.getText("content");

      // Connect update listeners
      doc1.on("update", (update, origin) => {
        if (origin !== "peer2") {
          Y.applyUpdate(doc2, update, "peer1");
        }
      });

      doc2.on("update", (update, origin) => {
        if (origin !== "peer1") {
          Y.applyUpdate(doc1, update, "peer2");
        }
      });

      // Peer 1 types
      text1.insert(0, "Hello");
      assert.strictEqual(text2.toString(), "Hello");

      // Peer 2 appends
      text2.insert(5, " World");
      assert.strictEqual(text1.toString(), "Hello World");

      // Peer 1 inserts in the middle
      text1.insert(5, " Beautiful");
      assert.strictEqual(text2.toString(), "Hello Beautiful World");
      assert.strictEqual(text1.toString(), text2.toString());

      doc1.destroy();
      doc2.destroy();
    });

    it("should resolve 3-way concurrent conflicting edits deterministically", () => {
      const docA = new Y.Doc();
      const docB = new Y.Doc();
      const docC = new Y.Doc();

      const initialText = "The quick brown fox jumps over the lazy dog";
      docA.getText("doc").insert(0, initialText);

      // Full sync initially
      const initUpdate = Y.encodeStateAsUpdate(docA);
      Y.applyUpdate(docB, initUpdate);
      Y.applyUpdate(docC, initUpdate);

      // Concurrently edit without immediate propagation
      const updatesA: Uint8Array[] = [];
      const updatesB: Uint8Array[] = [];
      const updatesC: Uint8Array[] = [];

      docA.on("update", (u) => updatesA.push(u));
      docB.on("update", (u) => updatesB.push(u));
      docC.on("update", (u) => updatesC.push(u));

      docA.getText("doc").insert(4, "extremely "); // The extremely quick...
      docB.getText("doc").delete(10, 5); // delete brown
      docC.getText("doc").insert(initialText.length, " repeatedly!"); // append

      // Cross-apply all pending updates
      for (const u of updatesA) {
        Y.applyUpdate(docB, u);
        Y.applyUpdate(docC, u);
      }
      for (const u of updatesB) {
        Y.applyUpdate(docA, u);
        Y.applyUpdate(docC, u);
      }
      for (const u of updatesC) {
        Y.applyUpdate(docA, u);
        Y.applyUpdate(docB, u);
      }

      const resA = docA.getText("doc").toString();
      const resB = docB.getText("doc").toString();
      const resC = docC.getText("doc").toString();

      assert.strictEqual(resA, resB);
      assert.strictEqual(resB, resC);
      assert.ok(resA.includes("extremely"));
      assert.ok(resA.includes("repeatedly!"));

      docA.destroy();
      docB.destroy();
      docC.destroy();
    });
  });

  describe("SupabaseYjsProvider Lifecycle and Snapshot Storage", () => {
    it("should instantiate provider, configure user awareness and handle snapshot serialization", async () => {
      const doc = new Y.Doc();
      const provider = new SupabaseYjsProvider("test-room-101", doc, {
        connect: false,
        user: {
          id: "usr-42",
          name: "Alice Tester",
          email: "alice@example.com",
          color: "#4285F4",
        },
      });

      assert.strictEqual(provider.roomName, "test-room-101");
      assert.strictEqual(provider.doc, doc);

      const localUserState = provider.awareness.getLocalState();
      assert.ok(localUserState !== null);
      assert.strictEqual(localUserState?.user?.name, "Alice Tester");
      assert.strictEqual(localUserState?.user?.color, "#4285F4");

      // Make edits and verify snapshot save serialization
      doc.getText("tiptap").insert(0, "Snapshot persistence verification");
      await provider.saveSnapshot();

      provider.destroy();
      doc.destroy();
    });

    it("should hydrate document state from mocked Supabase storage record", async () => {
      const seedDoc = new Y.Doc();
      seedDoc.getText("body").insert(0, "Hydrated from Supabase BYTEA state");
      seedDoc.getMap("config").set("font", "Roboto");
      const seedBytes = Y.encodeStateAsUpdate(seedDoc);
      const hexPayload = uint8ArrayToHex(seedBytes);

      // Mock supabase client
      const mockSupabase: any = {
        from: (_table: string) => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { room: "hydrate-test-room", state: hexPayload },
                error: null,
              }),
            }),
          }),
        }),
        channel: () => ({
          on: () => ({ subscribe: () => {} }),
          send: () => {},
          unsubscribe: () => {},
        }),
      };

      const testDoc = new Y.Doc();
      const provider = new SupabaseYjsProvider("hydrate-test-room", testDoc, {
        connect: false,
        supabase: mockSupabase,
      });

      await provider.hydrate();

      assert.strictEqual(provider.synced, true);
      assert.strictEqual(testDoc.getText("body").toString(), "Hydrated from Supabase BYTEA state");
      assert.strictEqual(testDoc.getMap("config").get("font"), "Roboto");

      provider.destroy();
      seedDoc.destroy();
      testDoc.destroy();
    });
  });
});
