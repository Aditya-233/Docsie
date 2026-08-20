"use client";

import { useState } from "react";
import { 
  Check, 
  RotateCcw, 
  Trash2, 
  CornerDownRight, 
  MoreVertical, 
  Send,
  MessageSquareQuote,
  Clock
} from "lucide-react";

export interface CommentReply {
  id: string;
  author: {
    id: string;
    name: string;
    email?: string;
    avatar?: string;
    color?: string;
  };
  text: string;
  createdAt: string;
}

export interface CommentItem {
  id: string;
  author: {
    id: string;
    name: string;
    email?: string;
    avatar?: string;
    color?: string;
  };
  text: string;
  anchorText?: string;
  anchorRange?: { from: number; to: number };
  createdAt: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: {
    name: string;
  };
  replies: CommentReply[];
}

export interface CommentBubbleProps {
  comment: CommentItem;
  currentUser?: {
    id: string;
    name: string;
    email?: string;
    avatar?: string;
    color?: string;
  };
  isActive?: boolean;
  onSelect?: (commentId: string) => void;
  onReply?: (commentId: string, text: string) => void;
  onResolve?: (commentId: string) => void;
  onReopen?: (commentId: string) => void;
  onDelete?: (commentId: string) => void;
  onDeleteReply?: (commentId: string, replyId: string) => void;
  onScrollToAnchor?: (anchorRange?: { from: number; to: number }) => void;
}

export function CommentBubble({
  comment,
  currentUser,
  isActive = false,
  onSelect,
  onReply,
  onResolve,
  onReopen,
  onDelete,
  onDeleteReply,
  onScrollToAnchor,
}: CommentBubbleProps) {
  const [replyText, setReplyText] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const formatTimestamp = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return "Recently";
    }
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !onReply) return;
    onReply(comment.id, replyText.trim());
    setReplyText("");
    setIsReplying(false);
  };

  const isOwner = currentUser?.id === comment.author.id;

  return (
    <div
      onClick={() => {
        if (onSelect) onSelect(comment.id);
        if (onScrollToAnchor && comment.anchorRange) {
          onScrollToAnchor(comment.anchorRange);
        }
      }}
      className={`relative rounded-xl border p-4 transition-all duration-150 ${
        isActive
          ? "bg-blue-50/40 border-blue-400 shadow-md ring-1 ring-blue-300"
          : comment.resolved
          ? "bg-gray-50/80 border-gray-200 opacity-80 hover:opacity-100"
          : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-xs"
      }`}
    >
      {/* Anchor quote snippet */}
      {comment.anchorText && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (onScrollToAnchor && comment.anchorRange) {
              onScrollToAnchor(comment.anchorRange);
            }
          }}
          className="mb-3 pl-2.5 border-l-2 border-amber-400 text-xs text-gray-600 italic bg-amber-50/60 py-1 pr-2 rounded-r flex items-start gap-1.5 cursor-pointer hover:bg-amber-100/60 transition-colors"
          title="Click to jump to highlighted text"
        >
          <MessageSquareQuote className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <span className="line-clamp-2">&ldquo;{comment.anchorText}&rdquo;</span>
        </div>
      )}

      {/* Main Comment Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold uppercase shadow-2xs shrink-0"
            style={{ backgroundColor: comment.author.color || "#1A73E8" }}
          >
            {comment.author.avatar ? (
              <img
                src={comment.author.avatar}
                alt={comment.author.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              comment.author.name.charAt(0)
            )}
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-900 leading-tight">
              {comment.author.name}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-gray-400">
              <Clock className="w-3 h-3" />
              <span>{formatTimestamp(comment.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 relative" onClick={(e) => e.stopPropagation()}>
          {!comment.resolved ? (
            <button
              type="button"
              onClick={() => onResolve?.(comment.id)}
              className="p-1 text-gray-400 hover:text-emerald-600 rounded-md hover:bg-emerald-50 transition-colors"
              title="Mark as resolved"
            >
              <Check className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onReopen?.(comment.id)}
              className="p-1 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
              title="Re-open discussion"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 text-xs">
                {onDelete && (isOwner || !comment.author.id) && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onDelete(comment.id);
                    }}
                    className="w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                )}
                {comment.resolved ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onReopen?.(comment.id);
                    }}
                    className="w-full px-3 py-1.5 text-left text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Re-open</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onResolve?.(comment.id);
                    }}
                    className="w-full px-3 py-1.5 text-left text-emerald-700 hover:bg-emerald-50 flex items-center gap-2"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Resolve</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Comment Text */}
      <div className="mt-2.5 text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">
        {comment.text}
      </div>

      {/* Resolved banner */}
      {comment.resolved && (
        <div className="mt-3 py-1 px-2 bg-emerald-50 border border-emerald-100 rounded text-[11px] text-emerald-700 flex items-center gap-1.5 font-medium">
          <Check className="w-3 h-3 text-emerald-600" />
          <span>Resolved {comment.resolvedBy ? `by ${comment.resolvedBy.name}` : ""}</span>
        </div>
      )}

      {/* Threaded Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2.5">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="flex items-start gap-2 text-xs group/reply">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-medium shrink-0 mt-0.5"
                style={{ backgroundColor: reply.author.color || "#4285F4" }}
              >
                {reply.author.name.charAt(0)}
              </div>
              <div className="flex-1 bg-gray-50/70 p-2 rounded-lg border border-gray-100">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold text-gray-900 text-[11px]">
                    {reply.author.name}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-400">
                      {formatTimestamp(reply.createdAt)}
                    </span>
                    {onDeleteReply && (currentUser?.id === reply.author.id || isOwner) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteReply(comment.id, reply.id);
                        }}
                        className="opacity-0 group-hover/reply:opacity-100 text-gray-400 hover:text-red-600 p-0.5 transition-opacity"
                        title="Delete reply"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-gray-700 mt-1 whitespace-pre-wrap leading-relaxed">
                  {reply.text}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply input trigger / box */}
      {!comment.resolved && (
        <div className="mt-3 pt-2" onClick={(e) => e.stopPropagation()}>
          {isReplying ? (
            <form onSubmit={handleSendReply} className="space-y-2">
              <div className="relative">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Reply to this thread..."
                  rows={2}
                  autoFocus
                  className="w-full text-xs p-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsReplying(false)}
                  className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!replyText.trim()}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-medium rounded-md shadow-2xs flex items-center gap-1"
                >
                  <Send className="w-3 h-3" />
                  <span>Reply</span>
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setIsReplying(true)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 hover:underline cursor-pointer"
            >
              <CornerDownRight className="w-3 h-3" />
              <span>Reply</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
