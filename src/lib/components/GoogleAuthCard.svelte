<script lang="ts">
    import { authState } from "$lib/auth.svelte";
    import { FileText, Loader2, AlertCircle, Sparkles } from "lucide-svelte";

    let loading = $state(false);
    let errorMessage = $state<string | null>(null);

    async function handleGoogleLogin() {
        loading = true;
        errorMessage = null;
        try {
            await authState.signInWithGoogle();
        } catch (err: any) {
            errorMessage = err?.message || "Could not start Google Sign-In. Please try again.";
            loading = false;
        }
    }
</script>

<div class="w-full max-w-[400px] bg-white rounded-xl border border-zinc-200 shadow-xl shadow-zinc-950/5 p-8 transition-all">
    <!-- Header with Docsie Monogram Icon -->
    <div class="flex flex-col items-center text-center mb-7">
        <div class="w-12 h-12 rounded-xl bg-zinc-950 text-white flex items-center justify-center mb-4 shadow-md shadow-zinc-950/10">
            <FileText size={24} class="stroke-[2.2]" />
        </div>
        <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-100 border border-zinc-200/80 text-[11px] font-medium text-zinc-800 mb-2">
            <Sparkles size={11} class="text-zinc-600" />
            <span>Next-Gen Collaborative Docs</span>
        </div>
        <h1 class="text-2xl font-bold text-zinc-950 tracking-tight">Docsie</h1>
        <p class="text-sm text-zinc-500 mt-1">Sign in with your Google account to continue</p>
    </div>

    <!-- Error Alert -->
    {#if errorMessage}
        <div class="mb-6 p-3 bg-red-50/80 border border-red-200 rounded-lg text-red-700 text-xs flex items-start gap-2.5">
            <AlertCircle size={16} class="shrink-0 mt-0.5 text-red-600" />
            <span class="leading-relaxed font-medium">{errorMessage}</span>
        </div>
    {/if}

    <!-- Single Action: Log in with Google -->
    <div class="space-y-3">
        <button
            type="button"
            onclick={handleGoogleLogin}
            disabled={loading}
            class="w-full relative flex items-center justify-center gap-3 py-2.5 px-4 bg-white hover:bg-zinc-50 active:bg-zinc-100 text-zinc-900 font-medium text-sm rounded-lg border border-zinc-200 hover:border-zinc-300 shadow-xs hover:shadow-sm active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950"
            aria-label="Log in with Google"
        >
            {#if loading}
                <Loader2 size={18} class="animate-spin text-zinc-900" />
                <span class="text-zinc-800">Connecting to Google...</span>
            {:else}
                <!-- Official Multi-colored Google G Icon -->
                <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                </svg>
                <span class="font-medium text-zinc-900">Continue with Google</span>
            {/if}
        </button>
    </div>

    <!-- Minimalist Footer -->
    <div class="mt-7 pt-5 border-t border-zinc-100 text-center">
        <p class="text-[11px] text-zinc-400">
            By signing in, you agree to our Terms and Privacy Policy.
        </p>
    </div>
</div>
