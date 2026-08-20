"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
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
import { getBasePath } from "@/lib/utils";
import type { UserRole, UserProfile } from "@/types";

interface DocumentEditorClientProps {
  docId: string;
}

// Google Docs collaborator color palette
const GOOGLE_DOCS_COLORS = [
  "#EA4335", // Red
  "#4285F4", // Blue
  "#34A853", // Green
  "#FBBC04", // Yellow
  "#FA7B17", // Orange
  "#46BDC6", // Teal
  "#AF5CF7", // Purple
  "#FF63B8", // Pink
  "#129EAF", // Cyan
  "#188038", // Forest
  "#B31412", // Dark Red
  "#1A73E8", // Royal Blue
];

function getCollaboratorColor(identifier: string): string {
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = (hash << 5) - hash + identifier.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % GOOGLE_DOCS_COLORS.length;
  return GOOGLE_DOCS_COLORS[index];
}

function EditorContent({ docId }: { docId: string }) {
  const searchParams = useSearchParams();

  // Document metadata state
  const [title, setTitle] = useState<string>("Untitled Document");
  const [isStarred, setIsStarred] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<"saved" | "syncing" | "offline">("saved");
  const [role, setRole] = useState<UserRole>("owner");
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Sidebar / Modal toggle states
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [editorInstance, setEditorInstance] = useState<any>(null);

  // User identity
  const [currentUser, setCurrentUser] = useState<UserProfile>({
    id: "loading-user",
    name: "Collaborator",
    email: "",
    role: "owner",
    color: "#4285F4",
    avatar_url: undefined,
  });

  // Supabase client instance
  const supabase = useMemo(() => createClient(), []);

  // Supabase & Yjs CRDT instance — keyed on docId only, never recreated when user metadata updates
  const ydoc = useMemo(() => new Y.Doc(), [docId]);
  const providerRef = useRef<InstanceType<typeof SupabaseYjsProvider> | null>(null);
  const [provider, setProvider] = useState<InstanceType<typeof SupabaseYjsProvider> | null>(null);

  // Create / destroy provider only when docId or ydoc changes
  useEffect(() => {
    const p = new SupabaseYjsProvider(docId, ydoc, {
      supabase,
      user: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        color: currentUser.color,
        avatar_url: currentUser.avatar_url,
      },
    });
    providerRef.current = p;
    setProvider(p);

    return () => {
      p.destroy();
      providerRef.current = null;
    };
  }, [docId, ydoc, supabase]);

  // When user identity resolves, push updated user into the existing awareness without recreating
  useEffect(() => {
    if (!providerRef.current || currentUser.id === "loading-user") return;
    providerRef.current.awareness?.setLocalStateField("user", {
      id: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
      color: currentUser.color,
      avatar_url: currentUser.avatar_url,
    });
  }, [currentUser.id, currentUser.name, currentUser.email, currentUser.color, currentUser.avatar_url]);

  // Active collaborator presence list from Yjs Awareness
  const [collaboratorPresence, setCollaboratorPresence] = useState<
    Array<{ id?: string; name?: string; color?: string; avatar_url?: string; email?: string }>
  >([]);

  // Authenticate user & load real Google OAuth profile
  useEffect(() => {
    let isMounted = true;

    async function loadAuthUser() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        let user = session?.user;
        if (!user) {
          const {
            data: { user: fetchedUser },
            error,
          } = await supabase.auth.getUser();
          if (!error && fetchedUser) {
            user = fetchedUser;
          }
        }

        if (!user) {
          const basePath = getBasePath();
          // Preserve full URL including query params (role, token) and hash
          const fullPath = typeof window !== "undefined"
            ? window.location.pathname + window.location.search + window.location.hash
            : `/doc/${docId}`;
          // Strip basePath prefix before encoding to avoid double-prefix
          const cleanNext = basePath && fullPath.startsWith(basePath)
            ? fullPath.slice(basePath.length) || "/"
            : fullPath;
          window.location.replace(`${basePath}/login?next=${encodeURIComponent(cleanNext)}`);
          return;
        }

        if (isMounted && user) {
          const userMeta = user.user_metadata || {};
          const name =
            userMeta.full_name ||
            userMeta.name ||
            user.email?.split("@")[0] ||
            "Collaborator";
          const email = user.email || "";
          const avatarUrl = userMeta.avatar_url || userMeta.picture || undefined;
          const color = getCollaboratorColor(user.id || email);

          setCurrentUser((prev) => ({
            ...prev,
            id: user.id,
            name,
            email,
            avatar_url: avatarUrl,
            color,
          }));
          setAuthLoading(false);
        }
      } catch (err) {
        console.error("Auth verification failed:", err);
        const basePath = getBasePath();
        window.location.replace(`${basePath}/login?next=${encodeURIComponent(`/doc/${docId}`)}`);
      }
    }

    loadAuthUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        const basePath = getBasePath();
        window.location.replace(`${basePath}/login?next=${encodeURIComponent(`/doc/${docId}`)}`);
      } else if (session?.user && isMounted) {
        const u = session.user;
        const userMeta = u.user_metadata || {};
        const name =
          userMeta.full_name ||
          userMeta.name ||
          u.email?.split("@")[0] ||
          "Collaborator";
        const email = u.email || "";
        const avatarUrl = userMeta.avatar_url || userMeta.picture || undefined;
        const color = getCollaboratorColor(u.id || email);

        setCurrentUser((prev) => ({
          ...prev,
          id: u.id,
          name,
          email,
          avatar_url: avatarUrl,
          color,
        }));
        setAuthLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [docId, supabase]);

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
    if (!provider) return;

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

  // Track awareness changes for live collaborator roster in header
  useEffect(() => {
    if (!provider || !provider.awareness) return;

    const handleAwarenessChange = () => {
      const states = provider.awareness.getStates();
      const peers: Array<{
        id?: string;
        name?: string;
        color?: string;
        avatar_url?: string;
        email?: string;
      }> = [];

      states.forEach((state: any, clientID: number) => {
        if (state.user && state.user.name) {
          peers.push({
            id: state.user.id || String(clientID),
            name: state.user.name,
            color: state.user.color || "#4285F4",
            avatar_url: state.user.avatar_url,
            email: state.user.email,
          });
        }
      });

      const uniquePeers = Array.from(
        new Map(peers.map((p) => [p.id || p.name, p])).values()
      );
      setCollaboratorPresence(uniquePeers);
    };

    handleAwarenessChange();
    provider.awareness.on("change", handleAwarenessChange);
    return () => {
      provider.awareness.off("change", handleAwarenessChange);
    };
  }, [provider]);

  if (authLoading) {
    return (
      <div className="h-screen w-screen bg-[#f8f9fa] flex flex-col items-center justify-center gap-3 text-neutral-600">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium">Verifying Google authentication...</p>
      </div>
    );
  }

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
          {/* Active Collaborator Presence Avatars */}
          {collaboratorPresence.length > 0 && (
            <div className="flex items-center -space-x-1.5 mr-2">
              {collaboratorPresence.map((collab, i) => (
                <div
                  key={collab.id || i}
                  className="relative group cursor-pointer"
                  title={collab.name}
                >
                  <div
                    className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-white text-[11px] font-semibold uppercase shadow-xs overflow-hidden"
                    style={{ backgroundColor: collab.color || "#4285F4" }}
                  >
                    {collab.avatar_url ? (
                      <img
                        src={collab.avatar_url}
                        alt={collab.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      (collab.name || "C").charAt(0)
                    )}
                  </div>
                  {/* Tooltip */}
                  <div className="absolute top-full right-1/2 translate-x-1/2 mt-1 hidden group-hover:block bg-gray-900 text-white text-[10px] px-2 py-0.5 rounded shadow whitespace-nowrap z-30 pointer-events-none">
                    {collab.name}
                  </div>
                </div>
              ))}
            </div>
          )}

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
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-full text-sm shadow-sm transition-colors ml-2 cursor-pointer"
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
            onEditorReady={setEditorInstance}
            user={{
              name: currentUser.name || "Collaborator",
              color: currentUser.color || "#4285F4",
              avatar: currentUser.avatar_url,
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
              editor={editorInstance}
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
                avatar: currentUser.avatar_url,
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
              onRestoreVersion={async (snapshot) => {
                if (snapshot?.content && editorInstance) {
                  editorInstance.commands.setContent(snapshot.content);
                }
                setSyncStatus("saved");
                await provider?.saveSnapshot().catch(() => {});
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
        currentUser={{
          id: currentUser.id,
          name: currentUser.name || "Collaborator",
          email: currentUser.email || "",
          role: role,
        }}
        ydoc={ydoc}
      />
    </div>
  );
}

export function DocumentEditorClient({ docId }: DocumentEditorClientProps) {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-[#f8f9fa] flex items-center justify-center text-gray-500">Loading document...</div>}>
      <EditorContent docId={docId} />
    </Suspense>
  );
}
