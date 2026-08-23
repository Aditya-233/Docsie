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
    <div class="min-h-screen bg-[#f8f9fa] flex flex-col items-center justify-center p-4">
        <div class="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p class="mt-4 text-xs font-medium text-gray-500 tracking-wide">Loading Docsie...</p>
    </div>
{:else if !authState.user}
    <div class="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4">
        <GoogleAuthCard />
    </div>
{:else}
    {@render children()}
{/if}
