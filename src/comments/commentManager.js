/**
 * Threaded comments manager for Google Docs: creation, replies,
 * resolution, deletion, filtering, and text anchor range adjustments.
 */

/**
 * Generate unique comment ID.
 * @param {string} prefix
 * @returns {string} Unique ID
 */
export function generateCommentId(prefix = 'c') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
}

export class CommentManager {
  constructor(initialComments = []) {
    this.comments = new Map(); // commentId -> CommentObject
    this.listeners = new Map();

    if (Array.isArray(initialComments)) {
      this.loadFromJSON(initialComments);
    }
  }

  /**
   * Subscribe to comment manager events.
   * @param {string} event - Event name ('add', 'reply', 'resolve', 'reopen', 'delete', 'update', 'change')
   * @param {Function} callback - Event handler
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from events.
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  /**
   * Emit event to listeners.
   * @param {string} event - Event name
   * @param {...any} args - Arguments
   */
  emit(event, ...args) {
    if (this.listeners.has(event)) {
      for (const cb of this.listeners.get(event)) {
        try {
          cb(...args);
        } catch (err) {
          console.error(`Error in CommentManager listener for "${event}":`, err);
        }
      }
    }
  }

  /**
   * Create a new threaded comment.
   * @param {object} params
   * @param {object} params.author - Author profile { id, name, avatar, color }
   * @param {string} params.text - Comment body text
   * @param {object} [params.anchorRange] - Range in document { index, length }
   * @param {string} [params.anchorText] - Quoted text highlighted
   * @param {string} [params.id] - Optional custom ID
   * @param {string} [params.docId] - Optional document ID
   * @returns {object} Created comment thread
   */
  createComment({ author = {}, text = '', anchorRange = null, anchorText = '', id = null, docId = null } = {}) {
    if (!text || typeof text !== 'string' || !text.trim()) {
      throw new Error('Comment text cannot be empty');
    }

    const commentId = id || generateCommentId('c');
    const now = Date.now();

    const comment = {
      id: commentId,
      docId: docId || null,
      author: {
        id: author.id || 'anonymous',
        name: author.name || 'Anonymous',
        avatar: author.avatar || null,
        color: author.color || '#4285F4'
      },
      text: text.trim(),
      anchorRange: anchorRange ? { index: Number(anchorRange.index) || 0, length: Number(anchorRange.length) || 0 } : null,
      anchorText: anchorText || '',
      status: 'open', // 'open' | 'resolved'
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
      resolvedBy: null,
      replies: []
    };

    this.comments.set(commentId, comment);

    this.emit('add', comment);
    this.emit('change', this.getAllComments());

    return comment;
  }

  /**
   * Add a reply to an existing comment thread.
   * @param {string} commentId - Target comment thread ID
   * @param {object} params - Reply parameters
   * @param {object} params.author - Reply author { id, name, avatar, color }
   * @param {string} params.text - Reply text
   * @param {string} [params.id] - Optional reply ID
   * @returns {object} Added reply object
   */
  addReply(commentId, { author = {}, text = '', id = null } = {}) {
    const comment = this.comments.get(commentId);
    if (!comment) {
      throw new Error(`Comment with ID "${commentId}" not found`);
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      throw new Error('Reply text cannot be empty');
    }

    const replyId = id || generateCommentId('r');
    const now = Date.now();

    const reply = {
      id: replyId,
      author: {
        id: author.id || 'anonymous',
        name: author.name || 'Anonymous',
        avatar: author.avatar || null,
        color: author.color || '#4285F4'
      },
      text: text.trim(),
      createdAt: now,
      updatedAt: now
    };

    comment.replies.push(reply);
    comment.updatedAt = now;

    this.emit('reply', { commentId, reply, comment });
    this.emit('change', this.getAllComments());

    return reply;
  }

  /**
   * Resolve a comment thread.
   * @param {string} commentId - Target comment ID
   * @param {object|string} [resolvedBy] - User who resolved the comment
   * @returns {object} Updated comment
   */
  resolveComment(commentId, resolvedBy = null) {
    const comment = this.comments.get(commentId);
    if (!comment) {
      throw new Error(`Comment with ID "${commentId}" not found`);
    }

    const now = Date.now();
    comment.status = 'resolved';
    comment.resolvedAt = now;
    comment.resolvedBy = resolvedBy ? (typeof resolvedBy === 'object' ? resolvedBy : { id: resolvedBy }) : null;
    comment.updatedAt = now;

    this.emit('resolve', comment);
    this.emit('change', this.getAllComments());

    return comment;
  }

  /**
   * Reopen a resolved comment thread.
   * @param {string} commentId - Target comment ID
   * @returns {object} Updated comment
   */
  reopenComment(commentId) {
    const comment = this.comments.get(commentId);
    if (!comment) {
      throw new Error(`Comment with ID "${commentId}" not found`);
    }

    const now = Date.now();
    comment.status = 'open';
    comment.resolvedAt = null;
    comment.resolvedBy = null;
    comment.updatedAt = now;

    this.emit('reopen', comment);
    this.emit('change', this.getAllComments());

    return comment;
  }

  /**
   * Delete an entire comment thread.
   * @param {string} commentId - Target comment ID
   * @returns {boolean} True if comment existed and was removed
   */
  deleteComment(commentId) {
    if (this.comments.has(commentId)) {
      const removed = this.comments.get(commentId);
      this.comments.delete(commentId);
      this.emit('delete', removed);
      this.emit('change', this.getAllComments());
      return true;
    }
    return false;
  }

  /**
   * Delete a specific reply from a comment thread.
   * @param {string} commentId - Thread ID
   * @param {string} replyId - Reply ID to remove
   * @returns {boolean} True if reply was removed
   */
  deleteReply(commentId, replyId) {
    const comment = this.comments.get(commentId);
    if (!comment) return false;

    const initialLength = comment.replies.length;
    comment.replies = comment.replies.filter(r => r.id !== replyId);

    if (comment.replies.length !== initialLength) {
      comment.updatedAt = Date.now();
      this.emit('update', comment);
      this.emit('change', this.getAllComments());
      return true;
    }
    return false;
  }

  /**
   * Edit comment root text.
   * @param {string} commentId - Comment ID
   * @param {string} newText - Updated text
   * @returns {object} Updated comment
   */
  editComment(commentId, newText) {
    const comment = this.comments.get(commentId);
    if (!comment) {
      throw new Error(`Comment with ID "${commentId}" not found`);
    }

    if (!newText || typeof newText !== 'string' || !newText.trim()) {
      throw new Error('Comment text cannot be empty');
    }

    comment.text = newText.trim();
    comment.updatedAt = Date.now();

    this.emit('update', comment);
    this.emit('change', this.getAllComments());

    return comment;
  }

  /**
   * Edit a specific reply text.
   * @param {string} commentId - Comment ID
   * @param {string} replyId - Reply ID
   * @param {string} newText - Updated text
   * @returns {object} Updated reply
   */
  editReply(commentId, replyId, newText) {
    const comment = this.comments.get(commentId);
    if (!comment) {
      throw new Error(`Comment with ID "${commentId}" not found`);
    }

    const reply = comment.replies.find(r => r.id === replyId);
    if (!reply) {
      throw new Error(`Reply with ID "${replyId}" not found in comment "${commentId}"`);
    }

    if (!newText || typeof newText !== 'string' || !newText.trim()) {
      throw new Error('Reply text cannot be empty');
    }

    reply.text = newText.trim();
    reply.updatedAt = Date.now();
    comment.updatedAt = Date.now();

    this.emit('update', comment);
    this.emit('change', this.getAllComments());

    return reply;
  }

  /**
   * Get comment by ID.
   * @param {string} commentId - Comment ID
   * @returns {object|null}
   */
  getComment(commentId) {
    return this.comments.get(commentId) || null;
  }

  /**
   * Check if comment exists.
   * @param {string} commentId - Comment ID
   * @returns {boolean}
   */
  hasComment(commentId) {
    return this.comments.has(commentId);
  }

  /**
   * Get all comments as an array, sorted by anchor index or creation timestamp.
   * @returns {object[]} Array of comment threads
   */
  getAllComments() {
    return Array.from(this.comments.values()).sort((a, b) => {
      if (a.anchorRange && b.anchorRange) {
        return a.anchorRange.index - b.anchorRange.index;
      }
      return a.createdAt - b.createdAt;
    });
  }

  /**
   * Filter comments by status or custom predicate.
   * @param {'all'|'open'|'resolved'|Function} filter - Filter mode or function
   * @returns {object[]} Filtered comments
   */
  filterComments(filter = 'all') {
    const all = this.getAllComments();
    if (typeof filter === 'function') {
      return all.filter(filter);
    }
    if (filter === 'open') {
      return all.filter(c => c.status === 'open');
    }
    if (filter === 'resolved') {
      return all.filter(c => c.status === 'resolved');
    }
    return all;
  }

  /**
   * Adjust anchor ranges when text changes before the anchor.
   * @param {number} changeIndex - Position where text was inserted or deleted
   * @param {number} lengthChange - Positive for insertion, negative for deletion
   */
  adjustAnchorRanges(changeIndex, lengthChange) {
    if (!lengthChange || typeof changeIndex !== 'number') return;

    let modified = false;
    for (const comment of this.comments.values()) {
      if (!comment.anchorRange) continue;

      const { index, length } = comment.anchorRange;

      if (changeIndex <= index) {
        // Change occurred before the anchor, shift the anchor start
        comment.anchorRange.index = Math.max(0, index + lengthChange);
        modified = true;
      } else if (changeIndex > index && changeIndex < index + length) {
        // Change occurred inside the anchor, adjust the anchor length
        comment.anchorRange.length = Math.max(1, length + lengthChange);
        modified = true;
      }
    }

    if (modified) {
      this.emit('change', this.getAllComments());
    }
  }

  /**
   * Clear all comments.
   */
  clear() {
    const count = this.comments.size;
    this.comments.clear();
    if (count > 0) {
      this.emit('change', []);
    }
  }

  /**
   * Export all comments to JSON-serializable array.
   * @returns {object[]} Serialized comments
   */
  toJSON() {
    return this.getAllComments();
  }

  /**
   * Load comments from an array of comment objects.
   * @param {object[]} array - Array of comments
   */
  loadFromJSON(array = []) {
    this.comments.clear();
    if (Array.isArray(array)) {
      for (const item of array) {
        if (item && item.id) {
          this.comments.set(item.id, {
            id: item.id,
            docId: item.docId || null,
            author: item.author || { id: 'anonymous', name: 'Anonymous' },
            text: item.text || '',
            anchorRange: item.anchorRange ? { index: Number(item.anchorRange.index) || 0, length: Number(item.anchorRange.length) || 0 } : null,
            anchorText: item.anchorText || '',
            status: item.status || 'open',
            createdAt: item.createdAt || Date.now(),
            updatedAt: item.updatedAt || Date.now(),
            resolvedAt: item.resolvedAt || null,
            resolvedBy: item.resolvedBy || null,
            replies: Array.isArray(item.replies) ? item.replies.map(r => ({
              id: r.id || generateCommentId('r'),
              author: r.author || { id: 'anonymous', name: 'Anonymous' },
              text: r.text || '',
              createdAt: r.createdAt || Date.now(),
              updatedAt: r.updatedAt || Date.now()
            })) : []
          });
        }
      }
    }
    this.emit('change', this.getAllComments());
  }
}
