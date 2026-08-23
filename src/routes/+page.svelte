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
        LogOut,
        SlidersHorizontal,
        Sparkles,
        Clock,
        User,
        ArrowUpRight,
        FileCode2,
        ChevronDown
    } from "lucide-svelte";
    import {
        INITIAL_TEMPLATES,
        getLocalDocuments,
        saveLocalDocument,
        toggleStarLocalDocument,
    } from "$lib/storage";
    import { formatDate } from "$lib/utils";
    import { authState } from "$lib/auth.svelte";

    const { data }: { data: PageData } = $props();
    let documents = $state(getLocalDocuments());
    let viewMode = $state<"grid" | "list">("grid");
    let ownerFilter = $state<"all" | "me" | "others">("all");
    let profileOpen = $state(false);
    let searchQuery = $state(page.url.searchParams.get("q") ?? "");

    const userEmail = $derived(
        authState.user?.email || data.user?.email || "user@example.com",
    );
    const userName = $derived(
        authState.user?.user_metadata?.full_name ||
            authState.user?.user_metadata?.name ||
            data.user?.user_metadata?.full_name ||
            userEmail.split("@")[0] ||
            "You",
    );
    const userAvatar = $derived(
        authState.user?.user_metadata?.avatar_url ||
            authState.user?.user_metadata?.picture ||
            null,
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

    function createBlankDoc() {
        const id = `doc_${Date.now().toString(36)}`;
        saveLocalDocument({
            id,
            title: "Untitled document",
            content: "",
            category: "General",
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

<div class="min-h-screen bg-[#fafafa] flex flex-col font-sans text-zinc-900 select-none">
    <!-- Sleek Shadcn Navbar -->
    <header class="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-zinc-200/80 px-6 py-2.5 flex items-center justify-between">
        <div class="flex items-center gap-6">
            <a href="/" class="flex items-center gap-2.5 group">
                <div class="w-8 h-8 rounded-lg bg-zinc-950 text-white flex items-center justify-center shadow-xs group-hover:bg-zinc-800 transition-colors">
                    <FileText size={18} class="stroke-[2.2]" />
                </div>
                <div class="flex flex-col">
                    <span class="text-sm font-bold tracking-tight text-zinc-950 leading-none">Docsie</span>
                    <span class="text-[10px] text-zinc-400 font-mono font-medium">v3.0</span>
                </div>
            </a>
        </div>

        <!-- Command-like Search Input -->
        <form
            onsubmit={(e) => {
                e.preventDefault();
                goto(
                    searchQuery.trim()
                        ? `/?q=${encodeURIComponent(searchQuery.trim())}`
                        : "/",
                );
            }}
            class="flex-1 max-w-xl mx-6"
        >
            <div class="relative flex items-center bg-zinc-50 hover:bg-zinc-100/80 focus-within:bg-white border border-zinc-200 focus-within:border-zinc-950 rounded-lg px-3 py-1.5 shadow-xs transition-all">
                <Search size={15} class="text-zinc-400 mr-2.5 shrink-0" />
                <input
                    type="text"
                    placeholder="Search documents or filter by title..."
                    bind:value={searchQuery}
                    class="w-full bg-transparent text-xs text-zinc-900 placeholder:text-zinc-400 outline-none"
                />
                {#if searchQuery}
                    <button
                        type="button"
                        onclick={() => { searchQuery = ""; goto("/"); }}
                        class="text-[11px] text-zinc-400 hover:text-zinc-700 px-1.5 py-0.5 rounded"
                    >
                        Clear
                    </button>
                {:else}
                    <kbd class="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 bg-white border border-zinc-200 rounded shadow-2xs">
                        ⌘K
                    </kbd>
                {/if}
            </div>
        </form>

        <!-- Right User Actions -->
        <div class="flex items-center gap-3">
            <button
                type="button"
                onclick={createBlankDoc}
                class="hidden sm:inline-flex items-center gap-1.5 h-8 px-3.5 bg-zinc-950 hover:bg-zinc-800 text-white rounded-lg text-xs font-medium shadow-xs hover:shadow-sm active:scale-[0.98] transition-all cursor-pointer"
            >
                <Plus size={15} />
                <span>New Document</span>
            </button>

            <!-- Profile Dropdown -->
            <div class="relative" data-profile>
                <button
                    type="button"
                    onclick={() => (profileOpen = !profileOpen)}
                    class="w-8 h-8 rounded-full overflow-hidden bg-zinc-950 text-white flex items-center justify-center font-medium text-xs border border-zinc-200 hover:ring-2 hover:ring-zinc-950/20 transition-all cursor-pointer"
                    aria-label="User profile"
                >
                    {#if userAvatar}
                        <img src={userAvatar} alt={userName} class="w-full h-full object-cover" />
                    {:else}
                        {userName[0].toUpperCase()}
                    {/if}
                </button>
                {#if profileOpen}
                    <div class="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-zinc-200 p-3 z-50 text-xs space-y-2 animate-fadeIn">
                        <div class="flex items-center gap-3 p-2 border-b border-zinc-100">
                            <div class="w-9 h-9 rounded-full overflow-hidden bg-zinc-950 text-white flex items-center justify-center font-semibold text-xs shrink-0">
                                {#if userAvatar}
                                    <img src={userAvatar} alt={userName} class="w-full h-full object-cover" />
                                {:else}
                                    {userName[0].toUpperCase()}
                                {/if}
                            </div>
                            <div class="overflow-hidden">
                                <p class="font-semibold text-zinc-950 truncate">{userName}</p>
                                <p class="text-[11px] text-zinc-500 truncate">{userEmail}</p>
                            </div>
                        </div>
                        <div class="p-1 space-y-1">
                            <button
                                type="button"
                                onclick={() => {
                                    profileOpen = false;
                                    authState.signOut();
                                }}
                                class="w-full flex items-center gap-2 px-2.5 py-1.5 text-zinc-700 hover:text-red-600 hover:bg-red-50/80 rounded-md font-medium transition-colors cursor-pointer"
                            >
                                <LogOut size={14} />
                                <span>Sign Out</span>
                            </button>
                        </div>
                    </div>
                {/if}
            </div>
        </div>
    </header>

    <!-- Templates Section -->
    <section class="border-b border-zinc-200/80 bg-white px-6 md:px-12 py-8">
        <div class="max-w-6xl mx-auto">
            <div class="flex items-center justify-between mb-4">
                <div>
                    <h2 class="text-sm font-semibold text-zinc-950 tracking-tight">Start a new document</h2>
                    <p class="text-xs text-zinc-500 mt-0.5">Choose from a standard template or start with a clean slate</p>
                </div>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {#each INITIAL_TEMPLATES as t}
                    <button
                        type="button"
                        class="group text-left cursor-pointer focus:outline-none"
                        onclick={() => createFromTemplate(t)}
                    >
                        <div class="h-32 bg-zinc-50 group-hover:bg-white border border-zinc-200 group-hover:border-zinc-950/80 rounded-xl p-4 flex flex-col justify-between shadow-2xs group-hover:shadow-md transition-all">
                            <div class="flex items-center justify-between">
                                <div class="w-8 h-8 rounded-lg {t.id === 'blank' ? 'bg-zinc-950 text-white' : 'bg-zinc-200/70 text-zinc-700'} flex items-center justify-center transition-colors">
                                    {#if t.id === "blank"}
                                        <Plus size={18} />
                                    {:else}
                                        <FileText size={16} />
                                    {/if}
                                </div>
                                <span class="text-[10px] font-mono text-zinc-400 group-hover:text-zinc-700 transition-colors uppercase tracking-wider">
                                    {t.category}
                                </span>
                            </div>

                            <div>
                                <p class="text-xs font-semibold text-zinc-900 group-hover:text-zinc-950 transition-colors truncate">
                                    {t.title}
                                </p>
                                <p class="text-[11px] text-zinc-400 mt-0.5">Click to instantiate</p>
                            </div>
                        </div>
                    </button>
                {/each}
            </div>
        </div>
    </section>

    <!-- Recent Documents Section -->
    <main class="max-w-6xl mx-auto px-6 md:px-12 py-8 flex-1 w-full">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200/80">
            <div class="flex items-center gap-3">
                <h2 class="text-base font-semibold text-zinc-950 tracking-tight">Recent documents</h2>
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 border border-zinc-200/60">
                    {filteredDocs.length}
                </span>
            </div>

            <!-- Controls: Filter + View Switcher -->
            <div class="flex items-center gap-3">
                <div class="relative">
                    <select
                        bind:value={ownerFilter}
                        class="text-xs font-medium border border-zinc-200 rounded-lg pl-3 pr-8 py-1.5 bg-white text-zinc-800 shadow-2xs hover:border-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-950 cursor-pointer appearance-none"
                    >
                        <option value="all">Owned by anyone</option>
                        <option value="me">Owned by me</option>
                        <option value="others">Shared with me</option>
                    </select>
                    <ChevronDown size={14} class="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                </div>

                <!-- Segmented View Mode Switcher -->
                <div class="flex items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200/60 shadow-2xs">
                    <button
                        type="button"
                        aria-label="Grid view"
                        onclick={() => (viewMode = "grid")}
                        class="p-1.5 rounded-md text-xs font-medium transition-all {viewMode === 'grid' ? 'bg-white text-zinc-950 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'} cursor-pointer"
                    >
                        <LayoutGrid size={15} />
                    </button>
                    <button
                        type="button"
                        aria-label="List view"
                        onclick={() => (viewMode = "list")}
                        class="p-1.5 rounded-md text-xs font-medium transition-all {viewMode === 'list' ? 'bg-white text-zinc-950 shadow-xs' : 'text-zinc-500 hover:text-zinc-900'} cursor-pointer"
                    >
                        <List size={15} />
                    </button>
                </div>
            </div>
        </div>

        {#if !filteredDocs.length}
            <div class="flex flex-col items-center justify-center py-20 text-center">
                <div class="w-12 h-12 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-400 mb-3">
                    <FileText size={22} />
                </div>
                <h3 class="text-sm font-semibold text-zinc-900">No documents found</h3>
                <p class="text-xs text-zinc-500 mt-1 max-w-sm">
                    {searchQuery ? `No document matching "${searchQuery}" was found.` : "Get started by creating your first document."}
                </p>
                {#if searchQuery}
                    <button
                        type="button"
                        onclick={() => { searchQuery = ""; goto("/"); }}
                        class="mt-4 px-3.5 py-1.5 text-xs font-medium bg-zinc-950 hover:bg-zinc-800 text-white rounded-lg transition-colors cursor-pointer"
                    >
                        Clear search
                    </button>
                {:else}
                    <button
                        type="button"
                        onclick={createBlankDoc}
                        class="mt-4 px-3.5 py-1.5 text-xs font-medium bg-zinc-950 hover:bg-zinc-800 text-white rounded-lg transition-colors cursor-pointer"
                    >
                        Create Blank Document
                    </button>
                {/if}
            </div>
        {:else if viewMode === "grid"}
            <!-- Grid Mode -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                {#each filteredDocs as doc}
                    <div
                        role="button"
                        tabindex="0"
                        class="border border-zinc-200/90 hover:border-zinc-400 bg-white p-4.5 rounded-xl shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group focus:outline-none focus:ring-2 focus:ring-zinc-950"
                        onclick={() => goto(`/doc/${doc.id}`)}
                        onkeydown={(e) => e.key === "Enter" && goto(`/doc/${doc.id}`)}
                    >
                        <div>
                            <div class="flex items-start justify-between gap-2 mb-3">
                                <div class="w-8 h-8 rounded-lg bg-zinc-100 group-hover:bg-zinc-950 group-hover:text-white text-zinc-700 flex items-center justify-center transition-colors">
                                    <FileText size={16} />
                                </div>
                                <button
                                    type="button"
                                    aria-label="Star document"
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        toggleStarLocalDocument(doc.id);
                                        documents = getLocalDocuments();
                                    }}
                                    class="p-1 rounded-md hover:bg-zinc-100 text-zinc-400 hover:text-amber-500 transition-colors"
                                >
                                    <Star
                                        size={14}
                                        class={doc.isStarred ? "fill-amber-400 text-amber-500" : ""}
                                    />
                                </button>
                            </div>
                            <h4 class="text-sm font-semibold text-zinc-900 group-hover:text-zinc-950 transition-colors truncate">
                                {doc.title}
                            </h4>
                            <p class="text-[11px] text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                                {doc.content?.replace(/<[^>]*>?/gm, "") || "Empty document..."}
                            </p>
                        </div>

                        <div class="flex items-center justify-between text-[11px] text-zinc-400 pt-4 mt-4 border-t border-zinc-100">
                            <span class="inline-flex items-center gap-1">
                                <Clock size={12} />
                                {formatDate(doc.updatedAt)}
                            </span>
                            <span class="px-1.5 py-0.5 rounded bg-zinc-100 font-mono text-[10px] text-zinc-600 font-medium">
                                {doc.owner}
                            </span>
                        </div>
                    </div>
                {/each}
            </div>
        {:else}
            <!-- List Mode -->
            <div class="mt-6 bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-2xs">
                <div class="grid grid-cols-12 px-4 py-2.5 bg-zinc-50 border-b border-zinc-200 text-xs font-semibold text-zinc-600">
                    <div class="col-span-6">Title</div>
                    <div class="col-span-3">Owner</div>
                    <div class="col-span-2">Last Modified</div>
                    <div class="col-span-1 text-right">Starred</div>
                </div>
                <div class="divide-y divide-zinc-100">
                    {#each filteredDocs as doc}
                        <div
                            role="button"
                            tabindex="0"
                            class="grid grid-cols-12 items-center px-4 py-3 text-xs hover:bg-zinc-50/80 transition-colors cursor-pointer group"
                            onclick={() => goto(`/doc/${doc.id}`)}
                            onkeydown={(e) => e.key === "Enter" && goto(`/doc/${doc.id}`)}
                        >
                            <div class="col-span-6 flex items-center gap-3 overflow-hidden">
                                <FileText size={16} class="text-zinc-400 group-hover:text-zinc-950 shrink-0 transition-colors" />
                                <span class="font-medium text-zinc-900 group-hover:text-zinc-950 truncate">
                                    {doc.title}
                                </span>
                            </div>
                            <div class="col-span-3 text-zinc-500 font-mono text-[11px]">
                                {doc.owner}
                            </div>
                            <div class="col-span-2 text-zinc-400 text-[11px]">
                                {formatDate(doc.updatedAt)}
                            </div>
                            <div class="col-span-1 text-right">
                                <button
                                    type="button"
                                    aria-label="Star document"
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        toggleStarLocalDocument(doc.id);
                                        documents = getLocalDocuments();
                                    }}
                                    class="p-1 text-zinc-400 hover:text-amber-500 transition-colors"
                                >
                                    <Star
                                        size={14}
                                        class={doc.isStarred ? "fill-amber-400 text-amber-500" : ""}
                                    />
                                </button>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}
    </main>
</div>
