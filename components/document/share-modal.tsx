"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  Link2,
  Check,
  Globe,
  Lock,
  UserPlus,
  User,
  Users,
  Settings,
  HelpCircle
} from "lucide-react";
import type * as Y from "yjs";

export type Role = "owner" | "editor" | "commenter" | "viewer";
export type GeneralAccessType = "restricted" | "anyone_with_link";

export interface Collaborator {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: Role;
  color?: string;
}

export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  docId: string;
  docTitle?: string;
  documentTitle?: string;
  currentRole?: Role;
  currentUser?: {
    id: string;
    name: string;
    email: string;
    role?: Role;
  };
  ydoc?: Y.Doc | null;
  onPermissionsChange?: (permissions: {
    generalAccess: GeneralAccessType;
    generalRole: Role;
    collaborators: Collaborator[];
  }) => void;
}

const DEFAULT_COLLABORATORS: Collaborator[] = [
  {
    id: "user-1",
    name: "You (Current User)",
    email: "user@example.com",
    role: "owner",
    color: "#1A73E8",
  },
];

export function ShareModal({
  isOpen,
  onClose,
  docId,
  docTitle = "Untitled document",
  documentTitle,
  currentUser,
  ydoc,
  onPermissionsChange,
}: ShareModalProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("editor");
  const [inviteMessage, setInviteMessage] = useState("");
  const [notifyPeople, setNotifyPeople] = useState(true);

  const [generalAccess, setGeneralAccess] = useState<GeneralAccessType>("restricted");
  const [generalRole, setGeneralRole] = useState<Role>("viewer");
  const [collaborators, setCollaborators] = useState<Collaborator[]>(DEFAULT_COLLABORATORS);
  const [copied, setCopied] = useState(false);

  // Sync state with Yjs permissions map if provided
  useEffect(() => {
    if (!ydoc) return undefined;

    try {
      const permMap = ydoc.getMap("permissions");

      const updateFromYjs = () => {
        const ga = permMap.get("generalAccess") as GeneralAccessType | undefined;
        const gr = permMap.get("generalRole") as Role | undefined;
        const collabJson = permMap.get("collaborators") as string | undefined;

        if (ga) setGeneralAccess(ga);
        if (gr) setGeneralRole(gr);
        if (collabJson) {
          try {
            setCollaborators(JSON.parse(collabJson));
          } catch {
            // keep existing
          }
        }
      };

      updateFromYjs();
      permMap.observe(updateFromYjs);
      return () => {
        permMap.unobserve(updateFromYjs);
      };
    } catch {
      return undefined;
    }
  }, [ydoc]);

  // Sync current user into collaborators list
  useEffect(() => {
    if (currentUser) {
      setCollaborators((prev) => {
        const cleanList = prev.filter((c) => c.id !== "user-1");
        const existingIndex = cleanList.findIndex(
          (c) =>
            (currentUser.email && c.email.toLowerCase() === currentUser.email.toLowerCase()) ||
            c.id === currentUser.id
        );

        const currentCollaborator: Collaborator = {
          id: currentUser.id,
          name: currentUser.name.endsWith("(You)") ? currentUser.name : `${currentUser.name} (You)`,
          email: currentUser.email,
          role: currentUser.role || "owner",
          color: (currentUser as any).color || "#1A73E8",
          avatar: (currentUser as any).avatar || (currentUser as any).avatar_url,
        };

        if (existingIndex >= 0) {
          const updated = [...cleanList];
          updated[existingIndex] = {
            ...updated[existingIndex],
            ...currentCollaborator,
          };
          return updated;
        }

        return [currentCollaborator, ...cleanList];
      });
    }
  }, [currentUser]);

  const broadcastPermissions = useCallback(
    (newGA: GeneralAccessType, newGR: Role, newCollabs: Collaborator[]) => {
      if (ydoc) {
        try {
          const permMap = ydoc.getMap("permissions");
          permMap.set("generalAccess", newGA);
          permMap.set("generalRole", newGR);
          permMap.set("collaborators", JSON.stringify(newCollabs));
        } catch (e) {
          console.error("Failed to update Yjs permissions map", e);
        }
      }

      if (onPermissionsChange) {
        onPermissionsChange({
          generalAccess: newGA,
          generalRole: newGR,
          collaborators: newCollabs,
        });
      }
    },
    [ydoc, onPermissionsChange]
  );

  const handleAddCollaborator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    const email = inviteEmail.trim().toLowerCase();
    const existingIndex = collaborators.findIndex((c) => c.email.toLowerCase() === email);

    let updated: Collaborator[];
    if (existingIndex >= 0) {
      updated = [...collaborators];
      updated[existingIndex] = {
        ...updated[existingIndex],
        role: inviteRole,
      };
    } else {
      const newCollab: Collaborator = {
        id: `user_${Date.now()}`,
        name: email.split("@")[0],
        email,
        role: inviteRole,
        color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0")}`,
      };
      updated = [...collaborators, newCollab];
    }

    setCollaborators(updated);
    broadcastPermissions(generalAccess, generalRole, updated);

    setInviteEmail("");
    setInviteMessage("");
  };

  const handleUpdateRole = (id: string, newRole: Role) => {
    const updated = collaborators.map((c) => (c.id === id ? { ...c, role: newRole } : c));
    setCollaborators(updated);
    broadcastPermissions(generalAccess, generalRole, updated);
  };

  const handleRemoveCollaborator = (id: string) => {
    const updated = collaborators.filter((c) => c.id !== id);
    setCollaborators(updated);
    broadcastPermissions(generalAccess, generalRole, updated);
  };

  const handleGeneralAccessChange = (type: GeneralAccessType) => {
    setGeneralAccess(type);
    broadcastPermissions(type, generalRole, collaborators);
  };

  const handleGeneralRoleChange = (role: Role) => {
    setGeneralRole(role);
    broadcastPermissions(generalAccess, role, collaborators);
  };

  const getShareableLink = () => {
    if (typeof window !== "undefined") {
      const origin = window.location.origin;
      const isGhPages =
        process.env.NEXT_PUBLIC_BASE_PATH === "/Docsie" ||
        process.env.GITHUB_PAGES === "true" ||
        window.location.pathname.startsWith("/Docsie");
      const basePath = isGhPages ? "/Docsie" : "";
      return `${origin}${basePath}/doc/${docId}`;
    }
    const isGhPages =
      process.env.NEXT_PUBLIC_BASE_PATH === "/Docsie" ||
      process.env.GITHUB_PAGES === "true";
    const basePath = isGhPages ? "/Docsie" : "";
    return `${basePath}/doc/${docId}`;
  };

  const handleCopyLink = async () => {
    try {
      const link = getShareableLink();
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh] transition-all transform scale-100"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 leading-snug">
                Share &ldquo;{documentTitle || docTitle}&rdquo;
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
              title="Help"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-4 space-y-6 overflow-y-auto">
          {/* Add People Form */}
          <form onSubmit={handleAddCollaborator} className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Add people by email..."
                  className="w-full pl-3 pr-24 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2">
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as Role)}
                    aria-label="Invite role"
                    className="text-xs bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium py-1 px-2 rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="editor">Editor</option>
                    <option value="commenter">Commenter</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={!inviteEmail.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Invite</span>
              </button>
            </div>

            {inviteEmail && (
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 space-y-2 animate-in fade-in duration-100">
                <textarea
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  placeholder="Include a message (optional)"
                  rows={2}
                  className="w-full p-2 text-xs bg-white border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyPeople}
                    onChange={(e) => setNotifyPeople(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Notify people</span>
                </label>
              </div>
            )}
          </form>

          {/* People with access list */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              People with access
            </h3>
            <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
              {collaborators.map((collaborator) => (
                <div
                  key={collaborator.id}
                  className="py-2.5 flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold uppercase shrink-0 shadow-xs overflow-hidden"
                      style={{
                        backgroundColor: collaborator.color || "#1A73E8",
                      }}
                    >
                      {collaborator.avatar ? (
                        <img
                          src={collaborator.avatar}
                          alt={collaborator.name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : collaborator.name ? (
                        collaborator.name.charAt(0)
                      ) : (
                        <User className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {collaborator.name}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {collaborator.email}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {collaborator.role === "owner" ? (
                      <span className="text-xs font-medium text-gray-500 px-2 py-1 bg-gray-100 rounded">
                        Owner
                      </span>
                    ) : (
                      <div className="relative flex items-center">
                        <select
                          value={collaborator.role}
                          onChange={(e) => {
                            if (e.target.value === "remove") {
                              handleRemoveCollaborator(collaborator.id);
                            } else {
                              handleUpdateRole(collaborator.id, e.target.value as Role);
                            }
                          }}
                          aria-label={`Role for ${collaborator.name}`}
                          className="text-xs bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium py-1 px-2.5 rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                        >
                          <option value="editor">Editor</option>
                          <option value="commenter">Commenter</option>
                          <option value="viewer">Viewer</option>
                          <option value="remove" className="text-red-600">
                            Remove access
                          </option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* General access section */}
          <div className="space-y-3 pt-2 border-t border-gray-100">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              General access
            </h3>
            <div className="flex items-start gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
              <div className="p-2 rounded-full bg-white shadow-xs text-gray-700 mt-0.5">
                {generalAccess === "anyone_with_link" ? (
                  <Globe className="w-4 h-4 text-green-600" />
                ) : (
                  <Lock className="w-4 h-4 text-gray-600" />
                )}
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={generalAccess}
                    onChange={(e) => handleGeneralAccessChange(e.target.value as GeneralAccessType)}
                    aria-label="General access scope"
                    className="text-xs font-semibold bg-white border border-gray-200 rounded px-2.5 py-1 text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs"
                  >
                    <option value="restricted">Restricted</option>
                    <option value="anyone_with_link">Anyone with the link</option>
                  </select>

                  {generalAccess === "anyone_with_link" && (
                    <select
                      value={generalRole}
                      onChange={(e) => handleGeneralRoleChange(e.target.value as Role)}
                      aria-label="General access role"
                      className="text-xs font-medium bg-white border border-gray-200 rounded px-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="commenter">Commenter</option>
                      <option value="editor">Editor</option>
                    </select>
                  )}
                </div>

                <p className="text-xs text-gray-500 leading-normal">
                  {generalAccess === "restricted"
                    ? "Only people with access can open with the link"
                    : `Anyone on the Internet with the link can ${generalRole === "viewer" ? "view" : generalRole === "commenter" ? "comment" : "edit"}`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-2 px-3.5 py-2 border border-gray-300 rounded-full text-xs font-medium text-blue-600 hover:text-blue-700 bg-white hover:bg-gray-50 transition-colors shadow-2xs cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-600 font-semibold">Link copied</span>
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4" />
                <span>Copy link</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-medium rounded-full shadow-sm transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
