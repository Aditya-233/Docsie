"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getBasePath } from "@/lib/utils";
import { Loader2, AlertCircle } from "lucide-react";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const nextParam = searchParams?.get("next") || "/";
    const code = searchParams?.get("code");
    const basePath = getBasePath();

    // Clean and normalize target destination
    let targetPath = nextParam;
    if (basePath && targetPath.startsWith(basePath)) {
      targetPath = targetPath.slice(basePath.length) || "/";
    }
    if (!targetPath.startsWith("/")) {
      targetPath = `/${targetPath}`;
    }
    const destination = `${basePath}${targetPath}`;

    let isHandled = false;
    let unsubscribe: (() => void) | undefined;

    const navigateToDestination = () => {
      if (isHandled) return;
      isHandled = true;
      window.location.replace(destination);
    };

    async function handleAuth() {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setErrorMsg(error.message);
          setTimeout(() => {
            window.location.replace(`${basePath}/login?error=auth-callback-failed`);
          }, 2000);
          return;
        }
      }

      // Check current session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigateToDestination();
        return;
      }

      // Listen for OAuth hash state or token exchange
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
        if (newSession && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION")) {
          navigateToDestination();
        }
      });
      unsubscribe = () => subscription.unsubscribe();

      // Fallback timeout verification
      setTimeout(async () => {
        if (isHandled) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          navigateToDestination();
        } else {
          setErrorMsg("Authentication session could not be established. Redirecting to sign in...");
          setTimeout(() => {
            window.location.replace(`${basePath}/login`);
          }, 1500);
        }
      }, 3000);
    }

    handleAuth();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f9fbfd] p-4 text-center">
      {errorMsg ? (
        <div className="bg-red-50 text-red-700 p-6 rounded-2xl max-w-md border border-red-200 shadow-sm space-y-2">
          <div className="flex items-center justify-center gap-2 text-red-700 font-semibold">
            <AlertCircle className="w-5 h-5" />
            <span>Authentication Failed</span>
          </div>
          <p className="text-xs text-red-600">{errorMsg}</p>
          <p className="text-xs text-gray-500 pt-2">Redirecting to sign in...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 bg-white p-8 rounded-3xl border border-gray-100 shadow-md">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <div className="space-y-1 text-center">
            <p className="text-base font-semibold text-gray-900">Signing you in...</p>
            <p className="text-xs text-gray-500">Completing Google authentication verification</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#f9fbfd]">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
