<script lang="ts">
    import "../app.css";
    import type { Snippet } from "svelte";
    import { authState } from "$lib/auth.svelte";
    import GoogleAuthCard from "$lib/components/GoogleAuthCard.svelte";
    import { page } from "$app/state";

    const { children }: { children: Snippet } = $props();

    const isAuthCallback = $derived(page.url.pathname.includes("/auth/callback"));
</script>

{#if isAuthCallback}
    {@render children()}
{:else if authState.loading}
    <div class="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-4">
        <div class="w-8 h-8 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
        <p class="mt-4 text-xs font-medium text-zinc-500 tracking-tight">Loading Docsie...</p>
    </div>
{:else if !authState.user}
    <div class="min-h-screen bg-[#fafafa] flex items-center justify-center p-4">
        <GoogleAuthCard />
    </div>
{:else}
    {@render children()}
{/if}
