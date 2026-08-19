import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  ROLES,
  normalizeRole,
  isValidRole,
  getRoleRank,
  AccessControl,
  PermissionManager
} from '../../src/permissions/manager.js';

import {
  generateShareUrl,
  parseShareUrl,
  CollaboratorListManager,
  ShareManager
} from '../../src/permissions/share.js';

describe('Permissions & Access Control Matrix', () => {
  test('role hierarchy and normalization', () => {
    assert.equal(normalizeRole('OWNER'), ROLES.OWNER);
    assert.equal(normalizeRole('Editor '), ROLES.EDITOR);
    assert.equal(normalizeRole('invalid', ROLES.VIEWER), ROLES.VIEWER);

    assert.equal(isValidRole('owner'), true);
    assert.equal(isValidRole('viewer'), true);
    assert.equal(isValidRole('hacker'), false);

    assert.ok(getRoleRank(ROLES.OWNER) > getRoleRank(ROLES.EDITOR));
    assert.ok(getRoleRank(ROLES.EDITOR) > getRoleRank(ROLES.COMMENTER));
    assert.ok(getRoleRank(ROLES.COMMENTER) > getRoleRank(ROLES.VIEWER));
  });

  test('AccessControl matrix enforces expected permissions', () => {
    // Owner
    assert.equal(AccessControl.canEdit(ROLES.OWNER), true);
    assert.equal(AccessControl.canComment(ROLES.OWNER), true);
    assert.equal(AccessControl.canShare(ROLES.OWNER), true);
    assert.equal(AccessControl.canDelete(ROLES.OWNER), true);
    assert.equal(AccessControl.canManagePermissions(ROLES.OWNER), true);

    // Editor
    assert.equal(AccessControl.canEdit(ROLES.EDITOR), true);
    assert.equal(AccessControl.canComment(ROLES.EDITOR), true);
    assert.equal(AccessControl.canShare(ROLES.EDITOR), true);
    assert.equal(AccessControl.canDelete(ROLES.EDITOR), false);
    assert.equal(AccessControl.canManagePermissions(ROLES.EDITOR), false);

    // Commenter
    assert.equal(AccessControl.canEdit(ROLES.COMMENTER), false);
    assert.equal(AccessControl.canComment(ROLES.COMMENTER), true);
    assert.equal(AccessControl.canShare(ROLES.COMMENTER), false);
    assert.equal(AccessControl.canDelete(ROLES.COMMENTER), false);

    // Viewer
    assert.equal(AccessControl.canEdit(ROLES.VIEWER), false);
    assert.equal(AccessControl.canComment(ROLES.VIEWER), false);
    assert.equal(AccessControl.canShare(ROLES.VIEWER), false);
    assert.equal(AccessControl.canDelete(ROLES.VIEWER), false);
    assert.equal(AccessControl.canView(ROLES.VIEWER), true);
    assert.equal(AccessControl.canExport(ROLES.VIEWER), true);
  });

  test('PermissionManager role elevation request & approval', () => {
    const manager = new PermissionManager(ROLES.VIEWER, 'user_alice');
    assert.equal(manager.getRole(), ROLES.VIEWER);
    assert.equal(manager.canEdit(), false);

    // Request elevation
    const req = manager.requestRoleElevation({
      requestedRole: ROLES.EDITOR,
      reason: 'Need to fix typo'
    });
    assert.equal(req.status, 'pending');
    assert.equal(req.requestedRole, ROLES.EDITOR);

    // Owner approves
    const approved = manager.approveRoleElevation(req.id, { id: 'owner_1' }, ROLES.OWNER);
    assert.equal(approved.status, 'approved');
    assert.equal(manager.getRole(), ROLES.EDITOR);
    assert.equal(manager.canEdit(), true);
  });
});

describe('Share URLs and Collaborator Management', () => {
  test('generates and parses hash share URLs', () => {
    const url = generateShareUrl({
      baseUrl: 'https://docs.local/app',
      docId: 'doc_strategy_2026',
      role: ROLES.EDITOR,
      user: 'Sarah Chen',
      format: 'hash'
    });

    assert.equal(url, 'https://docs.local/app#doc=doc_strategy_2026&role=editor&user=Sarah+Chen');

    const parsed = parseShareUrl(url);
    assert.equal(parsed.docId, 'doc_strategy_2026');
    assert.equal(parsed.role, 'editor');
    assert.equal(parsed.user, 'Sarah Chen');
  });

  test('generates and parses query share URLs', () => {
    const url = generateShareUrl({
      baseUrl: 'https://docs.local/app',
      docId: 'doc_q2',
      role: ROLES.COMMENTER,
      format: 'query'
    });

    assert.equal(url, 'https://docs.local/app?doc=doc_q2&role=commenter');

    const parsed = parseShareUrl(url);
    assert.equal(parsed.docId, 'doc_q2');
    assert.equal(parsed.role, 'commenter');
  });

  test('CollaboratorListManager adds, updates, and removes collaborators', () => {
    const list = new CollaboratorListManager();

    const sarah = list.addCollaborator({
      id: 'sarah_1',
      name: 'Sarah Chen',
      email: 'sarah@example.com',
      role: ROLES.COMMENTER
    });

    assert.equal(list.count(), 1);
    assert.equal(list.getCollaborator('sarah_1').role, ROLES.COMMENTER);

    // Elevate role
    list.updateRole('sarah_1', ROLES.EDITOR);
    assert.equal(list.getCollaborator('sarah_1').role, ROLES.EDITOR);

    assert.equal(list.getByRole(ROLES.EDITOR).length, 1);
    assert.equal(list.getByRole(ROLES.COMMENTER).length, 0);

    // Remove
    list.removeCollaborator('sarah_1');
    assert.equal(list.count(), 0);
  });
});
