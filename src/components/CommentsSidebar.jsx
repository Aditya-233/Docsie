import React, { useState } from 'react';
import { X, Check, MessageSquare, Send } from 'lucide-react';

export function CommentsSidebar({
  isOpen,
  onClose,
  comments = [],
  onResolveComment,
  onAddReply,
  currentUser = { name: 'Aditya Padhi', color: '#1a73e8' }
}) {
  const [replyInputs, setReplyInputs] = useState({});

  if (!isOpen) return null;

  const handleSendReply = (commentId) => {
    const text = replyInputs[commentId]?.trim();
    if (!text) return;
    if (onAddReply) {
      onAddReply(commentId, text);
    }
    setReplyInputs(prev => ({ ...prev, [commentId]: '' }));
  };

  return (
    <aside className="w-72 bg-white dark:bg-[#1e1f20] border-l border-gray-200 dark:border-gray-700 flex flex-col shrink-0 select-none transition-colors">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-200">
          <MessageSquare className="w-4 h-4 text-blue-600" />
          <span>Comments</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {comments.length === 0 ? (
          <div className="text-xs text-gray-400 text-center mt-12 px-4 leading-relaxed">
            No comments yet. Highlight text and click 'Add Comment' to start a discussion.
          </div>
        ) : (
          comments.map(c => (
            <div
              key={c.id}
              className="bg-white dark:bg-[#282a2c] rounded-xl p-3 shadow-xs border border-gray-200 dark:border-gray-700 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                    style={{ backgroundColor: c.avatarColor || '#1a73e8' }}
                  >
                    {c.author ? c.author.charAt(0) : 'U'}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-900 dark:text-gray-100">{c.author}</div>
                    <div className="text-[10px] text-gray-400">{c.timestamp || 'Just now'}</div>
                  </div>
                </div>

                <button
                  onClick={() => onResolveComment && onResolveComment(c.id)}
                  className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-emerald-600 transition"
                  title="Resolve comment"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-xs text-gray-800 dark:text-gray-200 leading-normal">{c.text}</p>

              {/* Replies */}
              {c.replies && c.replies.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t border-gray-100 dark:border-gray-700/60">
                  {c.replies.map((r, i) => (
                    <div key={i} className="text-[11px] bg-gray-50 dark:bg-gray-800/60 p-2 rounded-md">
                      <strong className="text-gray-900 dark:text-gray-200">{r.author}:</strong>{' '}
                      <span className="text-gray-700 dark:text-gray-300">{r.text}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply Input */}
              <div className="flex items-center gap-1.5 pt-1">
                <input
                  type="text"
                  value={replyInputs[c.id] || ''}
                  onChange={(e) => setReplyInputs(prev => ({ ...prev, [c.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendReply(c.id)}
                  placeholder="Reply..."
                  className="flex-1 px-2.5 py-1 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => handleSendReply(c.id)}
                  className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-md"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
