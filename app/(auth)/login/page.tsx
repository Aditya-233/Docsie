"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getBasePath, getAuthRedirectUrl } from "@/lib/utils";
import { 
  FileText, 
  Mail, 
  Lock, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  KeyRound,
  ShieldCheck
} from "lucide-react";

function AuthForm() {
  const searchParams = useSearchParams();
  const nextUrl = searchParams?.get("next") || "/";
  const errorParam = searchParams?.get("error");

  const [mode, setMode] = useState<"password" | "magic-link">("password");
  const [showSecondaryAuth, setShowSecondaryAuth] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(
    errorParam === "auth-callback-failed" ? "Authentication verification failed. Please try again." : null
  );
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const supabase = createClient();

  // If already logged in, immediately forward to target destination
  useEffect(() => {
    let isMounted = true;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!isMounted) return;
      if (user) {
        const basePath = getBasePath();
        const target = nextUrl.startsWith("/") ? nextUrl : `/${nextUrl}`;
        window.location.replace(`${basePath}${target}`);
      } else {
        setCheckingSession(false);
      }
    }).catch(() => {
      if (isMounted) setCheckingSession(false);
    });

    return () => {
      isMounted = false;
    };
  }, [nextUrl, supabase]);

  const handleOAuth = async (provider: "google" | "github") => {
    setErrorMsg(null);
    setLoading(true);
    try {
      // 1. Proactively check if provider is enabled on Supabase to prevent raw 400 Bad Request error
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseAnonKey) {
        try {
          const settingsRes = await fetch(`${supabaseUrl}/auth/v1/settings`, {
            headers: { apikey: supabaseAnonKey },
          });
          if (settingsRes.ok) {
            const settings = await settingsRes.json();
            if (settings?.external && settings.external[provider] === false) {
              setLoading(false);
              const providerName = provider === "google" ? "Google" : "GitHub";
              setErrorMsg(
                `${providerName} OAuth provider is not enabled in your Supabase dashboard yet. Go to Authentication -> Providers -> ${providerName} to add your Client ID & Secret, or use Instant Demo / Email login below.`
              );
              return;
            }
          }
        } catch {
          // If probe fails, continue to signInWithOAuth
        }
      }

      const redirectTo = getAuthRedirectUrl(nextUrl);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          queryParams: provider === "google" ? {
            prompt: "select_account",
          } : undefined,
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      setErrorMsg(err?.message || `Failed to sign in with ${provider}.`);
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const demoEmail = "aditya.collab@gmail.com";
      const demoPassword = "DemoPassword123!";

      const { error } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword,
      });

      if (error) {
        // Attempt sign-up if first time
        await supabase.auth.signUp({
          email: demoEmail,
          password: demoPassword,
          options: {
            data: {
              full_name: "Aditya (Google User)",
              avatar_url: "https://lh3.googleusercontent.com/a/default-user",
            },
          },
        });
        // Sign in immediately
        await supabase.auth.signInWithPassword({
          email: demoEmail,
          password: demoPassword,
        });
      }

      const basePath = getBasePath();
      const target = nextUrl.startsWith("/") ? nextUrl : `/${nextUrl}`;
      window.location.replace(`${basePath}${target}`);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to start demo session.");
      setLoading(false);
    }
  };

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const redirectTo = getAuthRedirectUrl(nextUrl);
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name || email.split("@")[0],
            },
            emailRedirectTo: redirectTo,
          },
        });
        if (error) throw error;
        if (data.session) {
          const basePath = getBasePath();
          const target = nextUrl.startsWith("/") ? nextUrl : `/${nextUrl}`;
          window.location.replace(`${basePath}${target}`);
        } else {
          setSuccessMsg("Check your email for a confirmation link to complete registration.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        const basePath = getBasePath();
        const target = nextUrl.startsWith("/") ? nextUrl : `/${nextUrl}`;
        window.location.replace(`${basePath}${target}`);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Authentication failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg("Please enter an email address.");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const redirectTo = getAuthRedirectUrl(nextUrl);
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
        },
      });
      if (error) throw error;
      setSuccessMsg(`Magic link sent! Check ${email} for your instant login link.`);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to send magic link. Please try again.");
    } finally {
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
    <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 p-8 space-y-6">
      {/* Brand Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 mb-1 shadow-inner">
          <FileText className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Google Docs</h1>
        <p className="text-sm text-gray-500">Sign in to create, edit, and collaborate on documents</p>
      </div>

      {/* Primary Compulsory Google OAuth Button */}
      <div className="space-y-3 pt-2">
        <button
          type="button"
          onClick={() => handleOAuth("google")}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-white hover:bg-gray-50 active:bg-gray-100 border-2 border-[#dadce0] hover:border-blue-500 rounded-2xl text-gray-800 font-medium text-base shadow-sm hover:shadow-md transition-all focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-60 cursor-pointer group"
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
              <span className="group-hover:text-blue-600 transition-colors">Continue with Google</span>
            </>
          )}
        </button>

        <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500 font-normal">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Secure authentication powered by Supabase & Google OAuth</span>
        </div>
      </div>

      {/* Divider */}
      <div className="relative flex items-center justify-center pt-2">
        <div className="border-t border-gray-200 w-full" />
        <span className="bg-white px-3 text-xs text-gray-400 uppercase tracking-wider font-medium">
          Or other methods
        </span>
      </div>

      {/* Secondary Options */}
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={handleDemoLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:opacity-90 text-white rounded-2xl text-sm font-semibold shadow-md transition-all cursor-pointer disabled:opacity-60"
        >
          <span>🚀 Instant Test Access (Aditya Google Session)</span>
        </button>

        {!showSecondaryAuth ? (
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={() => handleOAuth("github")}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4 fill-current text-gray-900" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>Sign in with GitHub</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSecondaryAuth(true)}
              className="w-full py-2 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors cursor-pointer text-center"
            >
              Use Email / Password or Magic Link instead
            </button>
          </div>
        ) : (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              type="button"
              onClick={() => {
                setMode("password");
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 pb-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                mode === "password"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Email & Password
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("magic-link");
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 pb-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                mode === "magic-link"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Magic Link
            </button>
          </div>

          {/* Form Content */}
          {mode === "password" ? (
            <form onSubmit={handlePasswordAuth} className="space-y-3">
              {isSignUp && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required={isSignUp}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-medium rounded-lg shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isSignUp ? (
                  "Create Account"
                ) : (
                  "Sign In"
                )}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 hover:underline font-medium cursor-pointer"
                >
                  {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-medium rounded-lg shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>Send Magic Link</span>
                  </>
                )}
              </button>
            </form>
          )}

          <div className="text-center">
            <button
              type="button"
              onClick={() => setShowSecondaryAuth(false)}
              className="text-xs text-gray-500 hover:text-gray-700 hover:underline cursor-pointer"
            >
              Hide alternative sign-in options
            </button>
          </div>
        </div>
      )}
      </div>

      {/* Feedback Alerts */}
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-xs text-emerald-700">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Footer info */}
      <div className="text-center border-t border-gray-100 pt-4">
        <p className="text-xs text-gray-400">
          Google Docs &copy; 2026. Realtime collaboration & Yjs CRDT.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Suspense fallback={
        <div className="w-full max-w-md bg-white rounded-3xl p-10 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }>
        <AuthForm />
      </Suspense>
    </main>
  );
}
