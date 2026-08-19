import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { CommentManager } from '../../src/comments/commentManager.ts';

describe('CommentManager', () => {
  let manager;

  beforeEach(() => {
    manager = new CommentManager();
  });

  test('creates comments with anchor ranges', () => {
    const comment = manager.createComment({
      author: { id: 'u1', name: 'Alice', color: '#ff0000' },
      text: 'Consider rewording this paragraph for clarity.',
      anchorRange: { index: 15, length: 30 },
      anchorText: 'modular collaboration engine'
    });

    assert.ok(comment.id);
    assert.equal(comment.status, 'open');
    assert.equal(comment.text, 'Consider rewording this paragraph for clarity.');
    assert.equal(comment.anchorRange.index, 15);
    assert.equal(comment.anchorRange.length, 30);
    assert.equal(manager.getAllComments().length, 1);
  });

  test('adds threaded replies to a comment', () => {
    const comment = manager.createComment({
      author: { id: 'u1', name: 'Alice' },
      text: 'Should we add tests here?'
    });

    const reply = manager.addReply(comment.id, {
      author: { id: 'u2', name: 'Bob' },
      text: 'Yes, 100% test coverage is required.'
    });

    assert.ok(reply.id);
    assert.equal(reply.text, 'Yes, 100% test coverage is required.');

    const retrieved = manager.getComment(comment.id);
    assert.equal(retrieved.replies.length, 1);
    assert.equal(retrieved.replies[0].author.name, 'Bob');
  });

  test('resolves and reopens comments', () => {
    const comment = manager.createComment({
      author: { id: 'u1', name: 'Alice' },
      text: 'Fix typo here'
    });

    manager.resolveComment(comment.id, { id: 'u1', name: 'Alice' });
    assert.equal(manager.getComment(comment.id).status, 'resolved');
    assert.ok(manager.getComment(comment.id).resolvedAt);

    // Filter resolved vs open
    assert.equal(manager.filterComments('resolved').length, 1);
    assert.equal(manager.filterComments('open').length, 0);

    // Reopen
    manager.reopenComment(comment.id);
    assert.equal(manager.getComment(comment.id).status, 'open');
    assert.equal(manager.filterComments('open').length, 1);
  });

  test('deletes comments and replies', () => {
    const c1 = manager.createComment({ author: { id: 'u1' }, text: 'Comment 1' });
    const r1 = manager.addReply(c1.id, { author: { id: 'u2' }, text: 'Reply 1' });

    assert.equal(c1.replies.length, 1);
    manager.deleteReply(c1.id, r1.id);
    assert.equal(c1.replies.length, 0);

    manager.deleteComment(c1.id);
    assert.equal(manager.getAllComments().length, 0);
  });

  test('adjusts anchor ranges correctly when text is inserted before the anchor', () => {
    const comment = manager.createComment({
      author: { id: 'u1' },
      text: 'Review this',
      anchorRange: { index: 50, length: 20 }
    });

    // 10 characters inserted at index 10 (before anchor at 50)
    manager.adjustAnchorRanges(10, 10);
    assert.equal(comment.anchorRange.index, 60);
    assert.equal(comment.anchorRange.length, 20);

    // 5 characters deleted at index 0
    manager.adjustAnchorRanges(0, -5);
    assert.equal(comment.anchorRange.index, 55);
  });
});
