"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getBasePath } from "@/lib/utils";
import {
  Menu,
  Search,
  Grid,
  HelpCircle,
  Settings,
  LogOut,
  X,
  FileText,
  Loader2,
  ShieldCheck,
} from "lucide-react";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  initials: string;
}

function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const q = searchParams?.get("q") || "";
    setSearchQuery(q);
  }, [searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push(`/`);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    router.push(`/`);
  };

  return (
    <form onSubmit={handleSearch} className="relative flex items-center w-full">
      <div className="absolute left-3.5 text-[#5f6368] pointer-events-none">
        <Search className="w-5 h-5" />
      </div>
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          if (e.target.value === "") {
            router.push("/");
          }
        }}
        placeholder="Search documents"
        className="w-full bg-[#f1f3f4] focus:bg-white text-[#202124] placeholder-[#5f6368] text-base pl-11 pr-10 py-2.5 rounded-full border border-transparent focus:border-transparent focus:shadow-[0_1px_3px_0_rgba(60,64,67,0.3),0_4px_8px_3px_rgba(60,64,67,0.15)] transition-all outline-none"
      />
      {searchQuery && (
        <button
          type="button"
          onClick={handleClearSearch}
          className="absolute right-3.5 p-1 rounded-full text-[#5f6368] hover:bg-gray-200 transition-colors cursor-pointer"
          title="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </form>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [appsOpen, setAppsOpen] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-profile-menu]") && !target.closest("[data-profile-btn]")) {
        setProfileOpen(false);
      }
      if (!target.closest("[data-apps-menu]") && !target.closest("[data-apps-btn]")) {
        setAppsOpen(false);
      }
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  // Compulsory authentication guard & session sync
  useEffect(() => {
    const supabase = createClient();
    let isMounted = true;

    const extractProfile = (authUser: any): UserProfile => {
      const email = authUser.email || "user@example.com";
      const name =
        authUser.user_metadata?.full_name ||
        authUser.user_metadata?.name ||
        authUser.user_metadata?.user_name ||
        email.split("@")[0] ||
        "User";
      const avatarUrl =
        authUser.user_metadata?.avatar_url ||
        authUser.user_metadata?.picture ||
        "";

      const initials = name
        .trim()
        .split(/\s+/)
        .map((n: string) => n[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase() || "U";

      return {
        id: authUser.id,
        name,
        email,
        avatarUrl,
        initials,
      };
    };

    const redirectToLogin = () => {
      const basePath = getBasePath();
      const currentPath = typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/";
      const cleanNext = basePath && currentPath.startsWith(basePath)
        ? currentPath.slice(basePath.length) || "/"
        : currentPath;

      window.location.replace(`${basePath}/login?next=${encodeURIComponent(cleanNext)}`);
    };

    const checkAuth = async () => {
      try {
        const { data: { user: authUser }, error } = await supabase.auth.getUser();
        if (!isMounted) return;

        if (error || !authUser) {
          redirectToLogin();
          return;
        }

        setUser(extractProfile(authUser));
        setLoading(false);
      } catch {
        if (!isMounted) return;
        redirectToLogin();
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        redirectToLogin();
      } else if (session.user) {
        setUser(extractProfile(session.user));
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("docs_user");
        document.cookie = "docs_user=; path=/; max-age=0";
        const basePath = getBasePath();
        window.location.replace(`${basePath}/login`);
      }
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f9fbfd]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-9 h-9 text-blue-600 animate-spin" />
          <p className="text-sm font-medium text-gray-600">Loading Google Docs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f9fbfd]">
      {/* Google Docs Top App Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#dadce0] px-4 py-2 flex items-center justify-between shadow-xs">
        {/* Left: Brand & Menu */}
        <div className="flex items-center space-x-3 min-w-[220px]">
          <button
            type="button"
            className="p-2 rounded-full hover:bg-gray-100 text-[#5f6368] transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            aria-label="Main menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link href="/" className="flex items-center space-x-2 focus:outline-none">
            {/* Google Docs Icon Logo */}
            <div className="w-9 h-10 bg-[#2684fc] rounded-[3px] flex flex-col justify-center items-center shadow-sm relative overflow-hidden group">
              <div className="w-5 h-[2px] bg-white rounded-xs mb-[3px]" />
              <div className="w-5 h-[2px] bg-white rounded-xs mb-[3px]" />
              <div className="w-3.5 h-[2px] bg-white rounded-xs self-start ml-2 mb-[3px]" />
              <div className="w-4 h-[2px] bg-white rounded-xs self-start ml-2" />
              {/* Corner fold simulation */}
              <div className="absolute top-0 right-0 w-3 h-3 bg-white/30" />
            </div>
            <span className="text-[22px] font-normal text-[#5f6368] tracking-tight hover:text-[#202124] transition-colors">
              Docs
            </span>
          </Link>
        </div>

        {/* Center: Search Bar with Suspense */}
        <div className="flex-1 max-w-[720px] mx-4">
          <Suspense fallback={<div className="w-full h-11 bg-[#f1f3f4] rounded-full animate-pulse" />}>
            <SearchBar />
          </Suspense>
        </div>

        {/* Right: Apps, Support, Profile */}
        <div className="flex items-center space-x-1.5 min-w-[200px] justify-end">
          <button
            type="button"
            className="p-2 rounded-full hover:bg-gray-100 text-[#5f6368] transition-colors cursor-pointer"
            title="Docs Help & Feedback"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          <button
            type="button"
            className="p-2 rounded-full hover:bg-gray-100 text-[#5f6368] transition-colors cursor-pointer"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>

          <div className="relative">
            <button
              type="button"
              data-apps-btn
              onClick={() => {
                setAppsOpen(!appsOpen);
                setProfileOpen(false);
              }}
              className="p-2 rounded-full hover:bg-gray-100 text-[#5f6368] transition-colors cursor-pointer"
              title="Google apps"
            >
              <Grid className="w-5 h-5" />
            </button>

            {appsOpen && (
              <div
                data-apps-menu
                className="absolute right-0 mt-2 w-72 bg-white rounded-3xl shadow-2xl border border-gray-200 p-4 z-50 animate-in fade-in zoom-in-95"
              >
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2">
                  Google Workspace Apps
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <Link
                    href="/"
                    onClick={() => setAppsOpen(false)}
                    className="p-2 hover:bg-blue-50 rounded-2xl flex flex-col items-center gap-1 transition-colors"
                  >
                    <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white font-bold shadow-xs">
                      <FileText className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-medium text-gray-700">Docs</span>
                  </Link>
                  <div className="p-2 hover:bg-emerald-50 rounded-2xl flex flex-col items-center gap-1 cursor-not-allowed opacity-60">
                    <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-xs">
                      Sheets
                    </div>
                    <span className="text-xs font-medium text-gray-700">Sheets</span>
                  </div>
                  <div className="p-2 hover:bg-amber-50 rounded-2xl flex flex-col items-center gap-1 cursor-not-allowed opacity-60">
                    <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-xs">
                      Slides
                    </div>
                    <span className="text-xs font-medium text-gray-700">Slides</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Menu */}
          <div className="relative ml-2">
            <button
              type="button"
              data-profile-btn
              onClick={() => {
                setProfileOpen(!profileOpen);
                setAppsOpen(false);
              }}
              className="flex items-center focus:outline-none ring-offset-2 focus:ring-2 focus:ring-blue-500 rounded-full cursor-pointer"
              aria-expanded={profileOpen}
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-8 h-8 rounded-full object-cover shadow-xs border border-gray-200"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#1a73e8] text-white flex items-center justify-center text-xs font-semibold shadow-xs hover:shadow-md transition-shadow">
                  {user.initials}
                </div>
              )}
            </button>

            {profileOpen && (
              <div
                data-profile-menu
                className="absolute right-0 mt-2 w-80 bg-white rounded-3xl shadow-2xl border border-[#dadce0] p-5 z-50 animate-in fade-in zoom-in-95 text-center"
              >
                <div className="text-xs text-[#5f6368] mb-3 font-normal truncate">{user.email}</div>
                
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-16 h-16 rounded-full object-cover mx-auto mb-3 shadow-inner ring-2 ring-blue-100"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-[#1a73e8] text-white text-2xl font-semibold flex items-center justify-center mx-auto mb-3 shadow-inner">
                    {user.initials}
                  </div>
                )}

                <h3 className="text-base font-semibold text-[#202124] truncate">
                  {user.name}
                </h3>
                
                <div className="flex items-center justify-center gap-1.5 mt-1 text-xs text-gray-500">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Google Account</span>
                </div>

                <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-full border border-gray-200 hover:bg-red-50 text-sm font-medium text-red-600 hover:text-red-700 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" /> Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
