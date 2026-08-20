"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Menu,
  Search,
  Grid,
  HelpCircle,
  Settings,
  LogOut,
  LogIn,
  X,
  FileText,
} from "lucide-react";

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
          className="absolute right-3.5 p-1 rounded-full text-[#5f6368] hover:bg-gray-200 transition-colors"
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
  const [user, setUser] = useState({
    name: "Alex Rivera",
    email: "alex.rivera@example.com",
    avatar: "AR",
    isSignedIn: true,
  });

  const toggleAuth = () => {
    setUser((prev) => ({
      ...prev,
      isSignedIn: !prev.isSignedIn,
      name: !prev.isSignedIn ? "Alex Rivera" : "Guest User",
      email: !prev.isSignedIn ? "alex.rivera@example.com" : "guest@example.com",
      avatar: !prev.isSignedIn ? "AR" : "G",
    }));
    setProfileOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f9fbfd]">
      {/* Google Docs Top App Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#dadce0] px-4 py-2 flex items-center justify-between shadow-xs">
        {/* Left: Brand & Menu */}
        <div className="flex items-center space-x-3 min-w-[220px]">
          <button
            type="button"
            className="p-2 rounded-full hover:bg-gray-100 text-[#5f6368] transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="p-2 rounded-full hover:bg-gray-100 text-[#5f6368] transition-colors"
            title="Docs Help & Feedback"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          <button
            type="button"
            className="p-2 rounded-full hover:bg-gray-100 text-[#5f6368] transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setAppsOpen(!appsOpen);
                setProfileOpen(false);
              }}
              className="p-2 rounded-full hover:bg-gray-100 text-[#5f6368] transition-colors"
              title="Google apps"
            >
              <Grid className="w-5 h-5" />
            </button>

            {appsOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-200 p-4 z-50 animate-in fade-in zoom-in-95">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2">
                  Google Workspace Apps
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <Link
                    href="/"
                    onClick={() => setAppsOpen(false)}
                    className="p-2 hover:bg-blue-50 rounded-xl flex flex-col items-center gap-1 transition-colors"
                  >
                    <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold">
                      <FileText className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-medium text-gray-700">Docs</span>
                  </Link>
                  <div className="p-2 hover:bg-emerald-50 rounded-xl flex flex-col items-center gap-1 cursor-not-allowed opacity-60">
                    <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">
                      Sheets
                    </div>
                    <span className="text-xs font-medium text-gray-700">Sheets</span>
                  </div>
                  <div className="p-2 hover:bg-amber-50 rounded-xl flex flex-col items-center gap-1 cursor-not-allowed opacity-60">
                    <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center text-white font-bold text-xs">
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
              onClick={() => {
                setProfileOpen(!profileOpen);
                setAppsOpen(false);
              }}
              className="flex items-center focus:outline-none ring-offset-2 focus:ring-2 focus:ring-blue-500 rounded-full"
              aria-expanded={profileOpen}
            >
              <div className="w-8 h-8 rounded-full bg-[#1a73e8] text-white flex items-center justify-center text-sm font-medium shadow-xs hover:shadow-md transition-shadow">
                {user.avatar}
              </div>
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-3xl shadow-2xl border border-[#dadce0] p-5 z-50 animate-in fade-in zoom-in-95 text-center">
                <div className="text-xs text-[#5f6368] mb-3">{user.email}</div>
                <div className="w-16 h-16 rounded-full bg-[#1a73e8] text-white text-2xl font-medium flex items-center justify-center mx-auto mb-3 shadow-inner">
                  {user.avatar}
                </div>
                <h3 className="text-lg font-medium text-[#202124]">
                  Hi, {user.name}!
                </h3>
                <p className="text-xs text-[#5f6368] mt-0.5">
                  {user.isSignedIn ? "Signed in with Google Account" : "Browsing as Guest"}
                </p>

                <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col gap-2">
                  <button
                    onClick={toggleAuth}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-full border border-[#dadce0] hover:bg-[#f8fafd] text-sm font-medium text-[#1a73e8] transition-colors"
                  >
                    {user.isSignedIn ? (
                      <>
                        <LogOut className="w-4 h-4" /> Sign out
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" /> Sign in with Google
                      </>
                    )}
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
