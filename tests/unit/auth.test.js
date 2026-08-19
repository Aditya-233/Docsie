/**
 * Unit Test Suite for AuthManager & User Identity System.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AuthManager } from '../../src/auth/authManager.js';
import { ROLES } from '../../src/permissions/manager.js';

class MockStorage {
  constructor() {
    this.store = {};
  }
  getItem(k) {
    return this.store[k] ?? null;
  }
  setItem(k, v) {
    this.store[k] = String(v);
  }
  removeItem(k) {
    delete this.store[k];
  }
  clear() {
    this.store = {};
  }
}

describe('AuthManager & Identity Engine', () => {
  let auth;
  let storage;

  beforeEach(() => {
    storage = new MockStorage();
    auth = new AuthManager(storage);
  });

  describe('Guest Login & Identity', () => {
    it('creates a frictionless guest session with valid color and role', () => {
      const user = auth.loginAsGuest('Bob Editor', '#34a853', ROLES.EDITOR);

      assert.equal(user.name, 'Bob Editor');
      assert.equal(user.color, '#34a853');
      assert.equal(user.role, ROLES.EDITOR);
      assert.equal(user.isGuest, true);
      assert.equal(user.isAuthenticated, true);
      assert.ok(user.id.startsWith('guest_bob_editor_'));

      // Check persisted session
      const current = auth.getCurrentUser();
      assert.deepEqual(current, user);
    });

    it('falls back to default guest name and automatic color if omitted', () => {
      const user = auth.loginAsGuest();

      assert.equal(user.name, 'Guest Collaborator');
      assert.ok(user.color);
      assert.equal(user.role, ROLES.EDITOR);
    });
  });

  describe('Email & Password Registration and Authentication', () => {
    it('registers a new account and creates session', () => {
      const user = auth.signUpWithEmail('aditya@example.com', 'superSecret123', 'Aditya Padhi');

      assert.equal(user.email, 'aditya@example.com');
      assert.equal(user.name, 'Aditya Padhi');
      assert.equal(user.isGuest, false);
      assert.equal(user.isAuthenticated, true);

      // Verify current session
      const session = auth.getCurrentUser();
      assert.equal(session.email, 'aditya@example.com');
    });

    it('prevents duplicate registration with same email', () => {
      auth.signUpWithEmail('alice@example.com', 'password123', 'Alice');

      assert.throws(() => {
        auth.signUpWithEmail('alice@example.com', 'password456', 'Alice Clone');
      }, /already exists/);
    });

    it('validates email format and password length', () => {
      assert.throws(() => {
        auth.signUpWithEmail('invalid-email', '1234');
      }, /valid email/);

      assert.throws(() => {
        auth.signUpWithEmail('valid@email.com', '12');
      }, /at least 4 characters/);
    });

    it('authenticates existing account with correct password', () => {
      auth.signUpWithEmail('charlie@example.com', 'securePass', 'Charlie Lead');
      auth.logout();

      assert.equal(auth.getCurrentUser(), null);

      const loggedIn = auth.loginWithEmail('charlie@example.com', 'securePass');
      assert.equal(loggedIn.name, 'Charlie Lead');
      assert.equal(loggedIn.email, 'charlie@example.com');
      assert.equal(auth.getCurrentUser().email, 'charlie@example.com');
    });

    it('rejects login with wrong password or unknown email', () => {
      auth.signUpWithEmail('test@example.com', 'correctPass', 'Tester');

      assert.throws(() => {
        auth.loginWithEmail('test@example.com', 'wrongPass');
      }, /Incorrect password/);

      assert.throws(() => {
        auth.loginWithEmail('unknown@example.com', 'anyPass');
      }, /No account found/);
    });
  });

  describe('Profile Customization (Names & Caret Colors)', () => {
    it('updates display name and custom caret color live', () => {
      auth.loginAsGuest('Initial Name', '#ea4335');

      const updated = auth.updateProfile({
        name: 'Renamed Collaborator',
        color: '#e91e63'
      });

      assert.equal(updated.name, 'Renamed Collaborator');
      assert.equal(updated.color, '#e91e63');

      const stored = auth.getCurrentUser();
      assert.equal(stored.name, 'Renamed Collaborator');
      assert.equal(stored.color, '#e91e63');
    });
  });

  describe('Document Library & Recent Files Management', () => {
    it('saves and lists recent document metadata', () => {
      auth.saveDocumentMetadata('doc_alpha', {
        title: 'Project Roadmap 2026',
        snippet: 'Quarter 1 Goals...'
      });

      auth.saveDocumentMetadata('doc_beta', {
        title: 'Architecture Overview',
        snippet: 'CRDT synchronizer specs...'
      });

      const docs = auth.listUserDocuments();
      assert.equal(docs.length, 2);
      assert.equal(docs[0].id, 'doc_beta'); // most recent first
      assert.equal(docs[1].id, 'doc_alpha');
    });

    it('updates existing document entry without creating duplicates', () => {
      auth.saveDocumentMetadata('doc_alpha', { title: 'Old Title' });
      auth.saveDocumentMetadata('doc_alpha', { title: 'Updated Title' });

      const docs = auth.listUserDocuments();
      assert.equal(docs.length, 1);
      assert.equal(docs[0].title, 'Updated Title');
    });

    it('deletes document from user library', () => {
      auth.saveDocumentMetadata('doc_1', { title: 'Doc 1' });
      auth.saveDocumentMetadata('doc_2', { title: 'Doc 2' });

      const afterDelete = auth.deleteDocumentFromLibrary('doc_1');
      assert.equal(afterDelete.length, 1);
      assert.equal(afterDelete[0].id, 'doc_2');
    });
  });
});
