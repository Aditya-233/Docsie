import { createClient, getAuthRedirectUrl } from "./supabase.svelte";
import type { User, Session } from "@supabase/supabase-js";

class AuthState {
    user = $state<User | null>(null);
    session = $state<Session | null>(null);
    loading = $state(true);
    error = $state<string | null>(null);

    private initialized = false;

    constructor() {
        if (typeof window !== "undefined") {
            this.init();
        } else {
            this.loading = false;
        }
    }

    async init() {
        if (this.initialized) return;
        this.initialized = true;

        try {
            const supabase = createClient();
            const { data, error } = await supabase.auth.getSession();
            if (error) {
                console.warn("Auth initialization warning:", error.message);
            }
            this.session = data.session;
            this.user = data.session?.user ?? null;

            supabase.auth.onAuthStateChange((_event, session) => {
                this.session = session;
                this.user = session?.user ?? null;
                this.loading = false;
            });
        } catch (err: any) {
            console.error("Auth initialization error:", err);
        } finally {
            this.loading = false;
        }
    }

    async signInWithGoogle() {
        this.error = null;
        try {
            const supabase = createClient();
            const currentPath = typeof window !== "undefined" ? window.location.pathname.replace(/^\/Docsie/, "") || "/" : "/";
            const redirectTo = getAuthRedirectUrl(currentPath);
            const { error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo,
                    queryParams: {
                        access_type: "offline",
                        prompt: "consent"
                    }
                }
            });
            if (error) {
                this.error = error.message;
                throw error;
            }
        } catch (err: any) {
            this.error = err?.message || "Failed to sign in with Google";
            throw err;
        }
    }

    async signOut() {
        this.error = null;
        try {
            const supabase = createClient();
            await supabase.auth.signOut();
            this.user = null;
            this.session = null;
        } catch (err: any) {
            this.error = err?.message || "Failed to sign out";
        }
    }
}

export const authState = new AuthState();
