<script lang="ts">
    import { goto } from "$app/navigation";
    import { FileText } from "lucide-svelte";
    import { createClient } from "$lib/supabase.svelte";

    let isSignUp = $state(false);
    let email = $state("");
    let password = $state("");
    let errorMsg = $state("");
    let loading = $state(false);

    async function handleSubmit(e: Event) {
        e.preventDefault();
        loading = true;
        errorMsg = "";
        try {
            const supabase = createClient();
            const res = isSignUp
                ? await supabase.auth.signUp({ email, password })
                : await supabase.auth.signInWithPassword({ email, password });
            if (res.error) {
                errorMsg = res.error.message;
            } else {
                goto("/");
            }
        } catch (err: any) {
            errorMsg = err?.message || "Authentication error";
        } finally {
            loading = false;
        }
    }
</script>

<div class="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4">
    <div
        class="bg-white border border-gray-200 rounded-2xl p-8 max-w-sm w-full shadow-lg space-y-6"
    >
        <div class="flex flex-col items-center gap-2">
            <div
                class="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"
            >
                <FileText size={28} />
            </div>
            <h1 class="text-xl font-bold text-gray-900">
                {isSignUp ? "Create account" : "Sign in to Docsie"}
            </h1>
        </div>

        {#if errorMsg}
            <div
                class="p-2.5 bg-red-50 text-red-600 text-xs rounded border border-red-200"
            >
                {errorMsg}
            </div>
        {/if}

        <form onsubmit={handleSubmit} class="space-y-4 text-xs">
            <div>
                <label for="email" class="block font-medium text-gray-700 mb-1"
                    >Email</label
                >
                <input
                    id="email"
                    type="email"
                    name="email"
                    bind:value={email}
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded outline-none focus:border-blue-500"
                />
            </div>
            <div>
                <label
                    for="password"
                    class="block font-medium text-gray-700 mb-1">Password</label
                >
                <input
                    id="password"
                    type="password"
                    name="password"
                    bind:value={password}
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded outline-none focus:border-blue-500"
                />
            </div>
            <button
                type="submit"
                disabled={loading}
                class="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded font-medium"
                >{loading
                    ? "Processing..."
                    : isSignUp
                      ? "Sign Up"
                      : "Sign In"}</button
            >
        </form>

        <div class="text-center text-xs text-gray-500">
            <button
                type="button"
                onclick={() => {
                    isSignUp = !isSignUp;
                    errorMsg = "";
                }}
                class="text-blue-600 hover:underline"
                >{isSignUp
                    ? "Have an account? Sign In"
                    : "New to Docsie? Create account"}</button
            >
        </div>
    </div>
</div>
