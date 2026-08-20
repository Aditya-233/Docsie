"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const next = searchParams?.get("next") || "/";
    const code = searchParams?.get("code");
    let unsubscribe: (() => void) | undefined;

    async function handleAuth() {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setErrorMsg(error.message);
          setTimeout(() => router.push(`/login?error=auth-callback-failed`), 2000);
          return;
        }
      }

      // Check current session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push(next);
      } else {
        // Listen for OAuth hash state token exchange
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
          if (newSession) {
            router.push(next);
          }
        });
        unsubscribe = () => subscription.unsubscribe();
      }
    }

    handleAuth();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f9fbfd] p-4 text-center">
      {errorMsg ? (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl max-w-md border border-red-200">
          <p className="font-medium text-sm">Authentication failed</p>
          <p className="text-xs mt-1 text-red-600">{errorMsg}</p>
          <p className="text-xs mt-2 text-gray-500">Redirecting to login...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-sm font-medium text-gray-700">Completing sign in...</p>
        </div>
      )}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#f9fbfd]">Loading...</div>}>
      <CallbackContent />
    </Suspense>
  );
}
