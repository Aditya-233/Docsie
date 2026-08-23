<script lang="ts">
    import { authState } from "$lib/auth.svelte";
    import { FileText, Loader2, AlertCircle } from "lucide-svelte";

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

<div class="w-full max-w-[420px] bg-white rounded-2xl border border-gray-200/80 shadow-xl shadow-gray-200/50 p-8 sm:p-10 transition-all">
    <!-- Header with Docsie Icon -->
    <div class="flex flex-col items-center text-center mb-8">
        <div class="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4 shadow-xs">
            <FileText size={32} class="stroke-[2.2]" />
        </div>
        <h1 class="text-2xl font-bold text-gray-900 tracking-tight">Docsie</h1>
        <p class="text-sm text-gray-500 mt-1.5">Sign in to continue to your documents</p>
    </div>

    <!-- Error Alert -->
    {#if errorMessage}
        <div class="mb-6 p-3 bg-red-50 border border-red-200/80 rounded-xl text-red-700 text-xs flex items-start gap-2.5 animate-fadeIn">
            <AlertCircle size={16} class="shrink-0 mt-0.5 text-red-500" />
            <span class="leading-relaxed">{errorMessage}</span>
        </div>
    {/if}

    <!-- Single Action: Log in with Google -->
    <div class="space-y-4">
        <button
            type="button"
            onclick={handleGoogleLogin}
            disabled={loading}
            class="w-full relative flex items-center justify-center gap-3.5 py-3.5 px-5 bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700 font-medium text-sm rounded-xl border border-gray-300 hover:border-gray-400 shadow-xs hover:shadow-md active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            aria-label="Log in with Google"
        >
            {#if loading}
                <Loader2 size={20} class="animate-spin text-blue-600" />
                <span>Connecting to Google...</span>
            {:else}
                <!-- Official Multi-colored Google G Icon -->
                <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
                <span class="font-medium text-gray-800">Log in with Google</span>
            {/if}
        </button>
    </div>

    <!-- Security / Platform Note -->
    <div class="mt-8 pt-6 border-t border-gray-100 text-center">
        <p class="text-[11px] text-gray-400 leading-relaxed">
            Realtime collaborative document platform.<br />
            Protected by Google OAuth & Supabase Security.
        </p>
    </div>
</div>
