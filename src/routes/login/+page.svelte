<script lang="ts">
    import { authState } from "$lib/auth.svelte";
    import GoogleAuthCard from "$lib/components/GoogleAuthCard.svelte";
    import { goto } from "$app/navigation";

    $effect(() => {
        if (!authState.loading && authState.user) {
            goto("/");
        }
    });
</script>

<div class="min-h-screen bg-[#fafafa] flex items-center justify-center p-4">
    <GoogleAuthCard />
</div>
