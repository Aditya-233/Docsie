import React from 'react';
import { Check, X } from 'lucide-react';

export interface AccessRequestItem {
  id: string;
  user?: {
    name?: string;
    email?: string;
    color?: string;
    avatar?: string | null;
  };
  [key: string]: any;
}

export interface AccessRequestToastProps {
  requests?: AccessRequestItem[];
  onApprove?: (id: string, req: AccessRequestItem) => void;
  onDeny?: (id: string, req: AccessRequestItem) => void;
  onDismiss?: (id: string) => void;
}

export default function AccessRequestToast({
  requests = [],
  onApprove,
  onDeny,
  onDismiss
}: AccessRequestToastProps) {
  if (!requests || requests.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-4 sm:right-6 z-50 flex flex-col gap-3 max-w-[calc(100vw-2rem)] sm:max-w-md w-full pointer-events-none select-none">
      {requests.map((req) => {
        const user = req.user || { name: 'Collaborator', email: '' };
        const initial = (user.name || 'C').charAt(0).toUpperCase();

        return (
          <div
            key={req.id}
            className="pointer-events-auto bg-white dark:bg-[#282a2c] rounded-2xl shadow-2xl border border-[#c7c7c7] dark:border-[#444746] p-4 flex flex-col gap-3 animate-in slide-in-from-bottom-5 fade-in duration-200"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full text-white flex items-center justify-center font-semibold text-sm shadow-sm flex-shrink-0"
                  style={{ backgroundColor: user.color || '#e91e63' }}
                >
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    initial
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="text-sm font-semibold text-[#1f1f1f] dark:text-[#e3e3e3] truncate">
                    {user.name}
                  </div>
                  <div className="text-xs text-[#444746] dark:text-[#c4c7c5]">
                    requested <span className="font-semibold text-[#1a73e8]">Edit Access</span>
                  </div>
                  {user.email && (
                    <div className="text-[11px] text-[#727775] dark:text-[#8e918f] truncate">
                      {user.email}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => onDismiss && onDismiss(req.id)}
                className="p-1 text-[#727775] hover:text-[#1f1f1f] dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#e0e2e0] dark:border-[#444746]">
              <button
                onClick={() => onDeny && onDeny(req.id, req)}
                className="px-3.5 py-1.5 rounded-full text-xs font-medium text-[#444746] dark:text-[#c4c7c5] hover:bg-[#f1f3f4] dark:hover:bg-[#333538] transition-colors"
              >
                Deny
              </button>
              <button
                onClick={() => onApprove && onApprove(req.id, req)}
                className="px-4 py-1.5 rounded-full text-xs font-medium bg-[#1a73e8] hover:bg-[#1557b0] text-white shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                Approve
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
