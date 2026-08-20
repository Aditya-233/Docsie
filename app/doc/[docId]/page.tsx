"use client";

import { use, useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import * as Y from "yjs";
import {
  FileText,
  Star,
  Cloud,
  CloudOff,
  Share2,
  List,
  MessageSquare,
  History,
  Shield,
  ArrowLeft,
} from "lucide-react";
import { Editor } from "@/components/editor/editor";
import { ShareModal } from "@/components/document/share-modal";
import { OutlineSidebar } from "@/components/document/outline-sidebar";
import { CommentsSidebar } from "@/components/comments/comments-sidebar";
import { VersionHistoryDrawer } from "@/components/document/version-history-drawer";
import { SupabaseYjsProvider } from "@/lib/supabase/provider";
import { createClient } from "@/lib/supabase/client";
import { normalizeRole } from "@/lib/permissions";
import type { UserRole, UserProfile } from "@/types";

interface PageProps {
  params: Promise<{ docId: string }>;
}

export default function DocumentEditorPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const docId = resolvedParams.docId;
  const searchParams = useSearchParams();

  // Document metadata state
  const [title, setTitle] = useState<string>("Untitled Document");
  const [isStarred, setIsStarred] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<"saved" | "syncing" | "offline">("saved");
  const [role, setRole] = useState<UserRole>("owner");

  // Sidebar / Modal toggle states
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  // User identity
  const [currentUser, setCurrentUser] = useState<UserProfile>({
    id: "guest-user",
    name: "Collaborator",
    email: "guest@example.com",
    role: "owner",
    color: "#4285F4",
    avatar_url: undefined,
  });

  // Supabase & Yjs CRDT instance
  const ydoc = useMemo(() => new Y.Doc(), [docId]);
  const supabase = useMemo(() => createClient(), []);
  const provider = useMemo(() => {
    return new SupabaseYjsProvider(docId, ydoc, {
      supabase,
      user: {
        id: currentUser.id,
        name: currentUser.name,
        color: currentUser.color,
      },
    });
  }, [docId, ydoc, supabase, currentUser.id, currentUser.name, currentUser.color]);

  // Read URL params for role/user overrides
  useEffect(() => {
    const roleParam = searchParams.get("role");
    const userParam = searchParams.get("user");
    if (roleParam) {
      setRole(normalizeRole(roleParam));
    }
    if (userParam) {
      setCurrentUser((prev) => ({
        ...prev,
        name: decodeURIComponent(userParam),
      }));
    }
  }, [searchParams]);

  // Track provider sync status
  useEffect(() => {
    const handleStatus = (event: { status: string }[]) => {
      const s = event[0]?.status;
      if (s === "connected") setSyncStatus("saved");
      else if (s === "connecting") setSyncStatus("syncing");
      else setSyncStatus("offline");
    };

    provider.on("status", handleStatus);
    provider.on("sync", (isSynced: boolean[]) => {
      if (isSynced[0]) setSyncStatus("saved");
    });

    return () => {
      provider.off("status", handleStatus);
    };
  }, [provider]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#f8f9fa] overflow-hidden select-none">
      {/* 1. Google Docs Main App Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-white border-b border-neutral-200 z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-1.5 hover:bg-neutral-100 rounded-full transition-colors text-neutral-600"
            title="Back to Docs Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <FileText className="w-6 h-6" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={role === "viewer"}
                className="text-lg font-medium text-neutral-800 bg-transparent hover:bg-neutral-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-1.5 py-0.5 border-none outline-none max-w-sm truncate"
                placeholder="Untitled Document"
              />
              <button
                onClick={() => setIsStarred(!isStarred)}
                className="text-neutral-400 hover:text-amber-500 transition-colors p-1 rounded"
                title={isStarred ? "Starred" : "Star document"}
              >
                <Star className={`w-4 h-4 ${isStarred ? "fill-amber-400 text-amber-400" : ""}`} />
              </button>
            </div>

            {/* Menubar Subtitle */}
            <div className="flex items-center gap-3 text-xs text-neutral-500 pl-1.5">
              <span className="cursor-pointer hover:text-neutral-800">File</span>
              <span className="cursor-pointer hover:text-neutral-800">Edit</span>
              <span className="cursor-pointer hover:text-neutral-800">View</span>
              <span className="cursor-pointer hover:text-neutral-800">Insert</span>
              <span className="cursor-pointer hover:text-neutral-800">Format</span>
              <span className="cursor-pointer hover:text-neutral-800">Tools</span>
              <span className="cursor-pointer hover:text-neutral-800">Help</span>

              <div className="flex items-center gap-1 pl-2 text-neutral-400">
                {syncStatus === "saved" ? (
                  <>
                    <Cloud className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Saved to cloud</span>
                  </>
                ) : syncStatus === "syncing" ? (
                  <>
                    <Cloud className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                    <span>Syncing...</span>
                  </>
                ) : (
                  <>
                    <CloudOff className="w-3.5 h-3.5 text-amber-600" />
                    <span>Working offline</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls & Collaborator Presence */}
        <div className="flex items-center gap-2">
          {/* Viewer notice badge */}
          {role === "viewer" && (
            <div className="flex items-center gap-1.5 bg-neutral-100 text-neutral-600 px-2.5 py-1 rounded-full text-xs font-medium border border-neutral-200">
              <Shield className="w-3.5 h-3.5 text-neutral-500" />
              <span>Viewing Only</span>
            </div>
          )}

          {/* Outline Sidebar Toggle */}
          <button
            onClick={() => setOutlineOpen(!outlineOpen)}
            className={`p-2 rounded-lg transition-colors ${
              outlineOpen ? "bg-blue-50 text-blue-600" : "text-neutral-600 hover:bg-neutral-100"
            }`}
            title="Document Outline & Stats"
          >
            <List className="w-5 h-5" />
          </button>

          {/* Comments Sidebar Toggle */}
          <button
            onClick={() => setCommentsOpen(!commentsOpen)}
            className={`p-2 rounded-lg transition-colors ${
              commentsOpen ? "bg-blue-50 text-blue-600" : "text-neutral-600 hover:bg-neutral-100"
            }`}
            title="Comment History"
          >
            <MessageSquare className="w-5 h-5" />
          </button>

          {/* Version History Toggle */}
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className={`p-2 rounded-lg transition-colors ${
              historyOpen ? "bg-blue-50 text-blue-600" : "text-neutral-600 hover:bg-neutral-100"
            }`}
            title="Version History"
          >
            <History className="w-5 h-5" />
          </button>

          {/* Share Button (Google Docs Blue) */}
          <button
            onClick={() => setShareOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-full text-sm shadow-sm transition-colors ml-2"
          >
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>
        </div>
      </header>

      {/* 2. Main Collaborative Editor Workspace */}
      <div className="flex flex-1 overflow-hidden relative">
        <main className="flex-1 flex flex-col overflow-hidden">
          <Editor
            docId={docId}
            ydoc={ydoc}
            provider={provider}
            user={{
              name: currentUser.name || "Collaborator",
              color: currentUser.color || "#4285F4",
            }}
            role={role === "commenter" ? "viewer" : role}
            showToolbar={true}
            showRuler={true}
          />
        </main>

        {/* 3. Sliding Sidebars */}
        {outlineOpen && (
          <aside className="w-72 bg-white border-l border-neutral-200 overflow-y-auto z-10">
            <OutlineSidebar
              isOpen={outlineOpen}
              onClose={() => setOutlineOpen(false)}
            />
          </aside>
        )}

        {commentsOpen && (
          <aside className="w-80 bg-white border-l border-neutral-200 overflow-y-auto z-10">
            <CommentsSidebar
              docId={docId}
              ydoc={ydoc}
              isOpen={commentsOpen}
              onClose={() => setCommentsOpen(false)}
              currentUser={{
                id: currentUser.id,
                name: currentUser.name || "Collaborator",
                email: currentUser.email,
                color: currentUser.color,
              }}
            />
          </aside>
        )}

        {historyOpen && (
          <aside className="w-80 bg-white border-l border-neutral-200 overflow-y-auto z-10">
            <VersionHistoryDrawer
              docId={docId}
              ydoc={ydoc}
              isOpen={historyOpen}
              onClose={() => setHistoryOpen(false)}
              onRestoreVersion={() => {
                setSyncStatus("saved");
              }}
            />
          </aside>
        )}
      </div>

      {/* 4. Google Docs Share Modal */}
      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        docId={docId}
        documentTitle={title}
        currentRole={role}
      />
    </div>
  );
}
