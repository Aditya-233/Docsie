"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getBasePath, getAuthRedirectUrl } from "@/lib/utils";
import {
  FileText,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Lock,
} from "lucide-react";

function AuthForm() {
  const searchParams = useSearchParams();
  const nextUrl = searchParams?.get("next") || "/";
  const errorParam = searchParams?.get("error");

  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(
    errorParam === "auth-callback-failed"
      ? "Authentication verification failed. Please try again."
      : null
  );

  const supabase = createClient();

  // If already logged in, immediately forward to target destination
  useEffect(() => {
    let isMounted = true;
    supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        if (!isMounted) return;
        if (user) {
          const basePath = getBasePath();
          const target = nextUrl.startsWith("/") ? nextUrl : `/${nextUrl}`;
          window.location.replace(`${basePath}${target}`);
        } else {
          setCheckingSession(false);
        }
      })
      .catch(() => {
        if (isMounted) setCheckingSession(false);
      });

    return () => {
      isMounted = false;
    };
  }, [nextUrl, supabase]);

  const handleGoogleOAuth = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const redirectTo = getAuthRedirectUrl(nextUrl);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            prompt: "select_account",
          },
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to sign in with Google.");
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 p-10 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm font-medium text-gray-600">Verifying session...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 p-8 space-y-7 animate-in fade-in zoom-in-95 duration-200">
      {/* Brand Header */}
      <div className="text-center space-y-2.5">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 mb-1 shadow-inner">
          <FileText className="w-9 h-9" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Docsie</h1>
        <p className="text-sm text-gray-500">
          Sign in with your Google Account to create, edit, and collaborate in real time
        </p>
      </div>

      {/* Primary Compulsory Google Sign-In Action */}
      <div className="space-y-4 pt-1">
        <button
          type="button"
          onClick={handleGoogleOAuth}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3.5 px-6 py-4 bg-white hover:bg-gray-50 active:bg-gray-100 border-2 border-[#dadce0] hover:border-blue-500 rounded-2xl text-gray-800 font-semibold text-base shadow-sm hover:shadow-md transition-all focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-60 cursor-pointer group"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          ) : (
            <>
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.97 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span className="group-hover:text-blue-600 transition-colors">
                Sign in with Google
              </span>
            </>
          )}
        </button>

        <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500 font-normal">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Compulsory Google OAuth authentication via Supabase</span>
        </div>
      </div>

      {/* Feedback Alerts */}
      {errorMsg && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Security & Feature Badges */}
      <div className="pt-2 border-t border-gray-100 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-gray-400">
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3 text-gray-400" /> End-to-end CRDT Sync
          </span>
          <span>Google Cloud OAuth 2.0</span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="w-full max-w-md bg-white rounded-3xl p-10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        }
      >
        <AuthForm />
      </Suspense>
    </main>
  );
}
