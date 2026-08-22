<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import type { PageData } from "./$types";
    import {
        Plus,
        Star,
        LayoutGrid,
        List,
        FileText,
        Search,
        Menu,
        LogOut,
    } from "lucide-svelte";
    import {
        INITIAL_TEMPLATES,
        getLocalDocuments,
        saveLocalDocument,
        toggleStarLocalDocument,
    } from "$lib/storage";
    import { formatDate } from "$lib/utils";

    const { data }: { data: PageData } = $props();
    let documents = $state(getLocalDocuments());
    let viewMode = $state<"grid" | "list">("grid");
    let ownerFilter = $state<"all" | "me" | "others">("all");
    let profileOpen = $state(false);
    let searchQuery = $state(page.url.searchParams.get("q") ?? "");

    const userEmail = $derived(data.user?.email || "user@example.com");
    const userName = $derived(
        data.user?.user_metadata?.full_name || userEmail.split("@")[0] || "You",
    );

    const filteredDocs = $derived(
        documents.filter((d) => {
            const q = searchQuery.toLowerCase().trim();
            if (
                q &&
                !d.title.toLowerCase().includes(q) &&
                !d.owner.toLowerCase().includes(q)
            )
                return false;
            if (
                ownerFilter === "me" &&
                d.owner !== "You" &&
                d.owner !== userName
            )
                return false;
            if (
                ownerFilter === "others" &&
                (d.owner === "You" || d.owner === userName)
            )
                return false;
            return true;
        }),
    );

    function createFromTemplate(t: (typeof INITIAL_TEMPLATES)[0]) {
        const id = `doc_${Date.now().toString(36)}`;
        saveLocalDocument({
            id,
            title: t.id === "blank" ? "Untitled document" : t.title,
            content: t.content,
            category: t.category,
            owner: "You",
        });
        goto(`/doc/${id}`);
    }
</script>

<svelte:window
    onclick={(e) => {
        if (!(e.target as HTMLElement).closest("[data-profile]"))
            profileOpen = false;
    }}
/>

<div class="min-h-screen bg-white flex flex-col font-sans select-none">
    <header
        class="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200"
    >
        <div class="flex items-center gap-3">
            <button
                type="button"
                class="p-2 rounded-full hover:bg-gray-100 text-gray-600"
                ><Menu size={20} /></button
            >
            <a href="/" class="flex items-center gap-2"
                ><FileText size={28} class="text-blue-600" /><span
                    class="text-lg font-medium text-gray-700">Docsie</span
                ></a
            >
        </div>
        <form
            onsubmit={(e) => {
                e.preventDefault();
                goto(
                    searchQuery.trim()
                        ? `/?q=${encodeURIComponent(searchQuery.trim())}`
                        : "/",
                );
            }}
            class="flex-1 max-w-2xl mx-4"
        >
            <div
                class="relative flex items-center bg-[#f1f3f4] focus-within:bg-white border border-transparent focus-within:border-gray-200 rounded-full px-3.5 py-1.5 shadow-xs"
            >
                <Search size={16} class="text-gray-500 mr-2" />
                <input
                    type="text"
                    placeholder="Search documents"
                    bind:value={searchQuery}
                    class="w-full bg-transparent text-xs outline-none"
                />
            </div>
        </form>
        <div class="relative" data-profile>
            <button
                type="button"
                onclick={() => (profileOpen = !profileOpen)}
                class="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-medium text-xs"
                >{userName[0].toUpperCase()}</button
            >
            {#if profileOpen}
                <div
                    class="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 p-3 z-50 text-xs space-y-2"
                >
                    <p class="font-medium text-gray-800 truncate">{userName}</p>
                    <a
                        href="/login"
                        class="flex items-center gap-2 text-gray-700 hover:bg-gray-50 p-1.5 rounded"
                        ><LogOut size={14} /> Switch Account</a
                    >
                </div>
            {/if}
        </div>
    </header>

    <div class="bg-[#f1f3f4] border-b border-[#dadce0] px-4 md:px-12 py-4">
        <div class="max-w-5xl mx-auto">
            <p class="text-sm font-medium text-gray-700 mb-3">
                Start a new document
            </p>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {#each INITIAL_TEMPLATES as t}
                    <button
                        type="button"
                        class="text-left group cursor-pointer"
                        onclick={() => createFromTemplate(t)}
                    >
                        <div
                            class="bg-white border border-gray-200 group-hover:border-blue-500 rounded h-28 flex items-center justify-center shadow-xs transition-all"
                        >
                            {#if t.id === "blank"}<Plus
                                    size={24}
                                    class="text-red-500"
                                />{:else}<FileText
                                    size={24}
                                    class="text-blue-500/40"
                                />{/if}
                        </div>
                        <p
                            class="text-xs font-medium text-gray-800 mt-1.5 truncate group-hover:text-blue-600"
                        >
                            {t.title}
                        </p>
                    </button>
                {/each}
            </div>
        </div>
    </div>

    <div class="max-w-5xl mx-auto px-4 md:px-12 py-6 flex-1 w-full">
        <div
            class="flex items-center justify-between pb-4 border-b border-gray-200 text-sm"
        >
            <span class="font-medium text-gray-800">Recent documents</span>
            <div class="flex items-center gap-2">
                <select
                    bind:value={ownerFilter}
                    class="text-xs border border-gray-300 rounded px-2 py-1 bg-white outline-none"
                >
                    <option value="all">Owned by anyone</option><option
                        value="me">Owned by me</option
                    >
                </select>
                <button
                    type="button"
                    aria-label="Toggle layout view"
                    class="p-1 rounded hover:bg-gray-100"
                    onclick={() =>
                        (viewMode = viewMode === "grid" ? "list" : "grid")}
                >
                    {#if viewMode === "grid"}<List
                            size={16}
                        />{:else}<LayoutGrid size={16} />{/if}
                </button>
            </div>
        </div>

        {#if !filteredDocs.length}
            <div class="text-center py-16 text-gray-400 text-xs">
                No documents found
            </div>
        {:else}
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                {#each filteredDocs as doc}
                    <div
                        role="button"
                        tabindex="0"
                        class="border border-gray-200 hover:border-blue-500 rounded bg-white p-3 shadow-xs transition-all cursor-pointer relative"
                        onclick={() => goto(`/doc/${doc.id}`)}
                        onkeydown={(e) =>
                            e.key === "Enter" && goto(`/doc/${doc.id}`)}
                    >
                        <p class="text-xs font-medium text-gray-800 truncate">
                            {doc.title}
                        </p>
                        <div
                            class="flex items-center justify-between text-[11px] text-gray-400 mt-3"
                        >
                            <span>{formatDate(doc.updatedAt)}</span>
                            <button
                                type="button"
                                aria-label="Star document"
                                onclick={(e) => {
                                    e.stopPropagation();
                                    toggleStarLocalDocument(doc.id);
                                    documents = getLocalDocuments();
                                }}
                                class="hover:text-amber-500"
                                ><Star
                                    size={13}
                                    class={doc.isStarred
                                        ? "fill-amber-400 text-amber-500"
                                        : ""}
                                /></button
                            >
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>
