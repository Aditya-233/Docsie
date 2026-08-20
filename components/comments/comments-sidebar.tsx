"use client";

import { useState, useEffect, useMemo } from "react";
import {
  MessageSquare,
  X,
  Plus,
  Send,
  MessageSquareQuote,
  Inbox
} from "lucide-react";
import { CommentBubble, CommentItem } from "./comment-bubble";
import type * as Y from "yjs";

export interface CommentsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  docId?: string;
  comments?: CommentItem[];
  onAddComment?: (newComment: {
    text: string;
    anchorText?: string;
    anchorRange?: { from: number; to: number };
  }) => void;
  onReplyComment?: (commentId: string, text: string) => void;
  onResolveComment?: (commentId: string) => void;
  onReopenComment?: (commentId: string) => void;
  onDeleteComment?: (commentId: string) => void;
  onDeleteReply?: (commentId: string, replyId: string) => void;
  currentUser?: {
    id: string;
    name: string;
    email?: string;
    avatar?: string;
    color?: string;
  };
  selectedText?: string;
  selectionRange?: { from: number; to: number } | null;
  activeCommentId?: string | null;
  onSelectComment?: (commentId: string | null) => void;
  onScrollToAnchor?: (anchorRange?: { from: number; to: number }) => void;
  ydoc?: Y.Doc | null;
}

export function CommentsSidebar({
  isOpen,
  onClose,
  comments: propComments,
  onAddComment,
  onReplyComment,
  onResolveComment,
  onReopenComment,
  onDeleteComment,
  onDeleteReply,
  currentUser,
  selectedText,
  selectionRange,
  activeCommentId,
  onSelectComment,
  onScrollToAnchor,
  ydoc,
}: CommentsSidebarProps) {
  const [filter, setFilter] = useState<"all" | "resolved">("all");
  const [newCommentText, setNewCommentText] = useState("");
  const [isDrafting, setIsDrafting] = useState(false);
  const [internalComments, setInternalComments] = useState<CommentItem[]>([]);

  // If ydoc is provided, bind with Y.Array("comments")
  useEffect(() => {
    if (!ydoc) return undefined;
    try {
      const yComments = ydoc.getArray<CommentItem>("comments");
      const syncYjsComments = () => {
        setInternalComments(yComments.toArray());
      };
      syncYjsComments();
      yComments.observe(syncYjsComments);
      return () => {
        yComments.unobserve(syncYjsComments);
      };
    } catch {
      return undefined;
    }
  }, [ydoc]);

  const allComments = useMemo(() => {
    if (ydoc && internalComments.length > 0) {
      return internalComments;
    }
    return propComments || [];
  }, [ydoc, internalComments, propComments]);

  // If text is selected in the editor, automatically open drafting mode
  useEffect(() => {
    if (selectedText && selectedText.trim().length > 0) {
      setIsDrafting(true);
    }
  }, [selectedText]);

  const filteredComments = useMemo(() => {
    if (filter === "resolved") {
      return allComments.filter((c) => c.resolved);
    }
    return allComments.filter((c) => !c.resolved);
  }, [allComments, filter]);

  const handleCreateComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    const newCommentObj: CommentItem = {
      id: `comment_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      author: {
        id: currentUser?.id || "guest",
        name: currentUser?.name || "Anonymous",
        email: currentUser?.email,
        avatar: currentUser?.avatar,
        color: currentUser?.color || "#1A73E8",
      },
      text: newCommentText.trim(),
      anchorText: selectedText || undefined,
      anchorRange: selectionRange || undefined,
      createdAt: new Date().toISOString(),
      resolved: false,
      replies: [],
    };

    if (ydoc) {
      try {
        const yComments = ydoc.getArray<CommentItem>("comments");
        yComments.push([newCommentObj]);
      } catch (err) {
        console.error("Failed to push comment to Yjs", err);
      }
    }

    if (onAddComment) {
      onAddComment({
        text: newCommentText.trim(),
        anchorText: selectedText || undefined,
        anchorRange: selectionRange || undefined,
      });
    }

    setNewCommentText("");
    setIsDrafting(false);
  };

  const handleReply = (commentId: string, replyText: string) => {
    if (ydoc) {
      try {
        const yComments = ydoc.getArray<CommentItem>("comments");
        const list = yComments.toArray();
        const idx = list.findIndex((c) => c.id === commentId);
        if (idx >= 0) {
          const target = list[idx];
          const newReply = {
            id: `reply_${Date.now()}`,
            author: {
              id: currentUser?.id || "guest",
              name: currentUser?.name || "Anonymous",
              email: currentUser?.email,
              avatar: currentUser?.avatar,
              color: currentUser?.color || "#1A73E8",
            },
            text: replyText,
            createdAt: new Date().toISOString(),
          };
          const updated = {
            ...target,
            replies: [...(target.replies || []), newReply],
          };
          yComments.delete(idx, 1);
          yComments.insert(idx, [updated]);
        }
      } catch (err) {
        console.error("Failed to reply in Yjs", err);
      }
    }

    if (onReplyComment) {
      onReplyComment(commentId, replyText);
    }
  };

  const handleResolve = (commentId: string) => {
    if (ydoc) {
      try {
        const yComments = ydoc.getArray<CommentItem>("comments");
        const list = yComments.toArray();
        const idx = list.findIndex((c) => c.id === commentId);
        if (idx >= 0) {
          const target = list[idx];
          const updated: CommentItem = {
            ...target,
            resolved: true,
            resolvedAt: new Date().toISOString(),
            resolvedBy: {
              name: currentUser?.name || "Anonymous",
            },
          };
          yComments.delete(idx, 1);
          yComments.insert(idx, [updated]);
        }
      } catch (err) {
        console.error("Failed to resolve in Yjs", err);
      }
    }

    if (onResolveComment) {
      onResolveComment(commentId);
    }
  };

  const handleReopen = (commentId: string) => {
    if (ydoc) {
      try {
        const yComments = ydoc.getArray<CommentItem>("comments");
        const list = yComments.toArray();
        const idx = list.findIndex((c) => c.id === commentId);
        if (idx >= 0) {
          const target = list[idx];
          const updated: CommentItem = {
            ...target,
            resolved: false,
            resolvedAt: undefined,
            resolvedBy: undefined,
          };
          yComments.delete(idx, 1);
          yComments.insert(idx, [updated]);
        }
      } catch (err) {
        console.error("Failed to reopen in Yjs", err);
      }
    }

    if (onReopenComment) {
      onReopenComment(commentId);
    }
  };

  const handleDelete = (commentId: string) => {
    if (ydoc) {
      try {
        const yComments = ydoc.getArray<CommentItem>("comments");
        const list = yComments.toArray();
        const idx = list.findIndex((c) => c.id === commentId);
        if (idx >= 0) {
          yComments.delete(idx, 1);
        }
      } catch (err) {
        console.error("Failed to delete comment from Yjs", err);
      }
    }

    if (onDeleteComment) {
      onDeleteComment(commentId);
    }
  };

  const handleDeleteReply = (commentId: string, replyId: string) => {
    if (ydoc) {
      try {
        const yComments = ydoc.getArray<CommentItem>("comments");
        const list = yComments.toArray();
        const idx = list.findIndex((c) => c.id === commentId);
        if (idx >= 0) {
          const target = list[idx];
          const updated = {
            ...target,
            replies: (target.replies || []).filter((r) => r.id !== replyId),
          };
          yComments.delete(idx, 1);
          yComments.insert(idx, [updated]);
        }
      } catch (err) {
        console.error("Failed to delete reply from Yjs", err);
      }
    }

    if (onDeleteReply) {
      onDeleteReply(commentId, replyId);
    }
  };

  if (!isOpen) return null;

  const openCount = allComments.filter((c) => !c.resolved).length;
  const resolvedCount = allComments.filter((c) => c.resolved).length;

  return (
    <aside
      className="w-80 md:w-96 bg-white border-l border-gray-200 h-full flex flex-col shadow-lg z-30 transition-all duration-200 animate-in slide-in-from-right"
      aria-label="Document Comments"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-900">Comments</h2>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
            {openCount}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {!isDrafting && (
            <button
              type="button"
              onClick={() => setIsDrafting(true)}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium cursor-pointer"
              title="Add comment"
            >
              <Plus className="w-4 h-4" />
              <span>New</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            title="Close comments"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex px-4 pt-2 border-b border-gray-100 bg-gray-50/50">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`flex-1 pb-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
            filter === "all"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Open ({openCount})
        </button>
        <button
          type="button"
          onClick={() => setFilter("resolved")}
          className={`flex-1 pb-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
            filter === "resolved"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Resolved ({resolvedCount})
        </button>
      </div>

      {/* Content Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* New Comment Draft Box */}
        {isDrafting && (
          <div className="bg-white border-2 border-blue-500 rounded-xl p-3 shadow-md animate-in fade-in duration-150">
            {currentUser && (
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-medium shrink-0 overflow-hidden"
                  style={{ backgroundColor: currentUser.color || "#1A73E8" }}
                >
                  {currentUser.avatar ? (
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    currentUser.name.charAt(0)
                  )}
                </div>
                <span className="text-xs font-semibold text-gray-800 truncate">{currentUser.name}</span>
              </div>
            )}
            {selectedText && (
              <div className="mb-2 pl-2 border-l-2 border-blue-400 text-xs text-gray-600 italic bg-blue-50/50 py-1 pr-2 rounded-r flex items-start gap-1">
                <MessageSquareQuote className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                <span className="line-clamp-2">&ldquo;{selectedText}&rdquo;</span>
              </div>
            )}
            <form onSubmit={handleCreateComment} className="space-y-2.5">
              <textarea
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Type your comment or @mention someone..."
                rows={3}
                autoFocus
                className="w-full text-xs p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsDrafting(false);
                    setNewCommentText("");
                  }}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newCommentText.trim()}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-medium rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Comment</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Comment list */}
        {filteredComments.length === 0 ? (
          <div className="py-12 text-center text-gray-400 flex flex-col items-center justify-center space-y-2">
            <Inbox className="w-8 h-8 text-gray-300 stroke-1" />
            <p className="text-xs font-medium text-gray-500">
              {filter === "resolved" ? "No resolved comments" : "No open comments"}
            </p>
            <p className="text-[11px] text-gray-400 max-w-[200px]">
              {filter === "resolved"
                ? "Resolved comment threads will appear here for reference."
                : "Select text in the editor or click 'New' to start a discussion."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredComments.map((comment) => (
              <CommentBubble
                key={comment.id}
                comment={comment}
                currentUser={currentUser}
                isActive={activeCommentId === comment.id}
                onSelect={onSelectComment}
                onReply={handleReply}
                onResolve={handleResolve}
                onReopen={handleReopen}
                onDelete={handleDelete}
                onDeleteReply={handleDeleteReply}
                onScrollToAnchor={onScrollToAnchor}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
