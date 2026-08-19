/**
 * Threaded comments manager for Google Docs: creation, replies,
 * resolution, deletion, filtering, and text anchor range adjustments.
 */

import type { DocumentComment, CommentReply } from '../types/index.ts';

export function generateCommentId(prefix: string = 'c'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
}

export class CommentManager {
  private comments: Map<string, DocumentComment>;
  private listeners: Map<string, Set<Function>>;

  constructor(initialComments: any[] = []) {
    this.comments = new Map();
    this.listeners = new Map();

    if (Array.isArray(initialComments)) {
      this.loadFromJSON(initialComments);
    }
  }

  on(event: string, callback: Function): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(callback);
    return () => this.off(event, callback);
  }

  off(event: string, callback: Function): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
    }
  }

  emit(event: string, ...args: unknown[]): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const cb of set) {
        try {
          cb(...args);
        } catch (err) {
          console.error(`Error in CommentManager listener for "${event}":`, err);
        }
      }
    }
  }

  createComment({
    author = { name: 'Anonymous', color: '#4285F4' },
    text = '',
    anchorRange = null,
    anchorText = '',
    id = null,
    docId: _docId = null
  }: {
    author?: any;
    text?: string;
    anchorRange?: { index: number; length: number } | null;
    anchorText?: string;
    id?: string | null;
    docId?: string | null;
  } = {}): DocumentComment {
    if (!text || typeof text !== 'string' || !text.trim()) {
      throw new Error('Comment text cannot be empty');
    }

    const commentId = id || generateCommentId('c');
    const now = Date.now();

    const authorObj = typeof author === 'object' && author !== null
      ? { ...author, name: author.name || 'Anonymous', color: author.color || '#4285F4' }
      : { name: String(author || 'Anonymous'), color: '#4285F4' };

    const comment: DocumentComment = {
      id: commentId,
      author: authorObj,
      authorColor: authorObj.color || '#4285F4',
      text: text.trim(),
      range: anchorRange ? { index: Number(anchorRange.index) || 0, length: Number(anchorRange.length) || 0 } : { index: 0, length: 0 },
      createdAt: now,
      resolved: false,
      replies: []
    };

    (comment as any).anchorRange = comment.range;
    (comment as any).anchorText = anchorText || '';
    (comment as any).status = 'open';

    this.comments.set(commentId, comment);

    this.emit('add', comment);
    this.emit('change', this.getAllComments());

    return comment;
  }

  addReply(
    commentId: string,
    replyData: any = {}
  ): CommentReply {
    const comment = this.comments.get(commentId);
    if (!comment) {
      throw new Error(`Comment with ID "${commentId}" not found`);
    }

    const author = replyData.author || { name: 'Anonymous', color: '#4285F4' };
    const text = replyData.text || '';
    const id = replyData.id || null;

    if (!text || typeof text !== 'string' || !text.trim()) {
      throw new Error('Reply text cannot be empty');
    }

    const replyId = id || generateCommentId('r');
    const now = Date.now();

    const authorObj = typeof author === 'object' && author !== null
      ? { ...author, name: author.name || 'Anonymous', color: author.color || '#4285F4' }
      : { name: String(author || 'Anonymous'), color: '#4285F4' };

    const reply: CommentReply = {
      id: replyId,
      author: authorObj,
      authorColor: authorObj.color || '#4285F4',
      text: text.trim(),
      createdAt: now
    };

    comment.replies.push(reply);
    (comment as any).updatedAt = now;

    this.emit('reply', { commentId, reply, comment });
    this.emit('change', this.getAllComments());

    return reply;
  }

  resolveComment(commentId: string, resolvedBy: any = null): DocumentComment {
    const comment = this.comments.get(commentId);
    if (!comment) {
      throw new Error(`Comment with ID "${commentId}" not found`);
    }

    const now = Date.now();
    comment.resolved = true;
    (comment as any).status = 'resolved';
    (comment as any).resolvedAt = now;
    (comment as any).resolvedBy = resolvedBy ? (typeof resolvedBy === 'object' ? resolvedBy : { id: resolvedBy }) : null;
    (comment as any).updatedAt = now;

    this.emit('resolve', comment);
    this.emit('change', this.getAllComments());

    return comment;
  }

  reopenComment(commentId: string): DocumentComment {
    const comment = this.comments.get(commentId);
    if (!comment) {
      throw new Error(`Comment with ID "${commentId}" not found`);
    }

    const now = Date.now();
    comment.resolved = false;
    (comment as any).status = 'open';
    (comment as any).resolvedAt = null;
    (comment as any).resolvedBy = null;
    (comment as any).updatedAt = now;

    this.emit('reopen', comment);
    this.emit('change', this.getAllComments());

    return comment;
  }

  deleteComment(commentId: string): boolean {
    if (this.comments.has(commentId)) {
      const removed = this.comments.get(commentId);
      this.comments.delete(commentId);
      this.emit('delete', removed);
      this.emit('change', this.getAllComments());
      return true;
    }
    return false;
  }

  deleteReply(commentId: string, replyId: string): boolean {
    const comment = this.comments.get(commentId);
    if (!comment) return false;

    const initialLength = comment.replies.length;
    comment.replies = comment.replies.filter((r) => r.id !== replyId);

    if (comment.replies.length !== initialLength) {
      (comment as any).updatedAt = Date.now();
      this.emit('update', comment);
      this.emit('change', this.getAllComments());
      return true;
    }
    return false;
  }

  editComment(commentId: string, newText: string): DocumentComment {
    const comment = this.comments.get(commentId);
    if (!comment) {
      throw new Error(`Comment with ID "${commentId}" not found`);
    }

    if (!newText || typeof newText !== 'string' || !newText.trim()) {
      throw new Error('Comment text cannot be empty');
    }

    comment.text = newText.trim();
    (comment as any).updatedAt = Date.now();

    this.emit('update', comment);
    this.emit('change', this.getAllComments());

    return comment;
  }

  editReply(commentId: string, replyId: string, newText: string): CommentReply {
    const comment = this.comments.get(commentId);
    if (!comment) {
      throw new Error(`Comment with ID "${commentId}" not found`);
    }

    const reply = comment.replies.find((r) => r.id === replyId);
    if (!reply) {
      throw new Error(`Reply with ID "${replyId}" not found in comment "${commentId}"`);
    }

    if (!newText || typeof newText !== 'string' || !newText.trim()) {
      throw new Error('Reply text cannot be empty');
    }

    reply.text = newText.trim();
    (reply as any).updatedAt = Date.now();
    (comment as any).updatedAt = Date.now();

    this.emit('update', comment);
    this.emit('change', this.getAllComments());

    return reply;
  }

  getComment(commentId: string): DocumentComment | null {
    return this.comments.get(commentId) || null;
  }

  hasComment(commentId: string): boolean {
    return this.comments.has(commentId);
  }

  getAllComments(): DocumentComment[] {
    return Array.from(this.comments.values()).sort((a, b) => {
      const aRange = (a as any).anchorRange || a.range;
      const bRange = (b as any).anchorRange || b.range;
      if (aRange && bRange) {
        return aRange.index - bRange.index;
      }
      return a.createdAt - b.createdAt;
    });
  }

  filterComments(filter: string | ((c: DocumentComment) => boolean) = 'all'): DocumentComment[] {
    const all = this.getAllComments();
    if (typeof filter === 'function') {
      return all.filter(filter);
    }
    if (filter === 'open') {
      return all.filter((c) => !c.resolved && (c as any).status !== 'resolved');
    }
    if (filter === 'resolved') {
      return all.filter((c) => c.resolved || (c as any).status === 'resolved');
    }
    return all;
  }

  adjustAnchorRanges(changeIndex: number, lengthChange: number): void {
    if (!lengthChange || typeof changeIndex !== 'number') return;

    let modified = false;
    for (const comment of this.comments.values()) {
      const anchorRange = (comment as any).anchorRange || comment.range;
      if (!anchorRange) continue;

      const { index, length } = anchorRange;

      if (changeIndex <= index) {
        anchorRange.index = Math.max(0, index + lengthChange);
        comment.range.index = anchorRange.index;
        modified = true;
      } else if (changeIndex > index && changeIndex < index + length) {
        anchorRange.length = Math.max(1, length + lengthChange);
        comment.range.length = anchorRange.length;
        modified = true;
      }
    }

    if (modified) {
      this.emit('change', this.getAllComments());
    }
  }

  clear(): void {
    const count = this.comments.size;
    this.comments.clear();
    if (count > 0) {
      this.emit('change', []);
    }
  }

  toJSON(): DocumentComment[] {
    return this.getAllComments();
  }

  loadFromJSON(array: any[] = []): void {
    this.comments.clear();
    if (Array.isArray(array)) {
      for (const item of array) {
        if (item && item.id) {
          const authorObj = typeof item.author === 'object' && item.author !== null
            ? item.author
            : { name: String(item.author || 'Anonymous'), color: item.authorColor || '#4285F4' };

          const docComment: DocumentComment = {
            id: item.id,
            author: authorObj,
            authorColor: authorObj.color || item.authorColor || '#4285F4',
            text: item.text || '',
            range: item.anchorRange ? { index: Number(item.anchorRange.index) || 0, length: Number(item.anchorRange.length) || 0 } : (item.range || { index: 0, length: 0 }),
            createdAt: item.createdAt || Date.now(),
            resolved: item.status === 'resolved' || item.resolved === true,
            replies: Array.isArray(item.replies)
              ? item.replies.map((r: any) => {
                  const replyAuthorObj = typeof r.author === 'object' && r.author !== null
                    ? r.author
                    : { name: String(r.author || 'Anonymous'), color: r.authorColor || '#4285F4' };
                  return {
                    id: r.id || generateCommentId('r'),
                    author: replyAuthorObj,
                    authorColor: replyAuthorObj.color || r.authorColor || '#4285F4',
                    text: r.text || '',
                    createdAt: r.createdAt || Date.now()
                  };
                })
              : []
          };
          (docComment as any).anchorRange = docComment.range;
          (docComment as any).anchorText = item.anchorText || '';
          (docComment as any).status = docComment.resolved ? 'resolved' : 'open';
          this.comments.set(item.id, docComment);
        }
      }
    }
    this.emit('change', this.getAllComments());
  }
}
