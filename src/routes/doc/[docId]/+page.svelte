<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { page } from "$app/state";
    import * as Y from "yjs";
    import {
        FileText,
        Star,
        Cloud,
        CloudOff,
        Share2,
        Undo2,
        Redo2,
        Printer,
        Bold,
        Italic,
        Underline as UnderlineIcon,
        Strikethrough,
        Baseline,
        List,
        ListOrdered,
        ListTodo,
        Table as TableIcon,
        RemoveFormatting,
        ChevronDown,
        Plus,
        Minus,
        X,
        MessageSquare,
        History,
        Check,
        Trash2,
        Shield,
        Globe,
        Copy,
    } from "lucide-svelte";
    import {
        DocsieEditor,
        FONT_FAMILIES,
        HEADING_STYLES,
        GOOGLE_COLORS,
    } from "$lib/editor.svelte";
    import {
        downloadMarkdown,
        downloadHtml,
        downloadDocx,
        downloadTxt,
    } from "$lib/export";
    import {
        extractHeadings,
        calculateStats,
        type HeadingItem,
        type DocumentStatsDetailed,
    } from "$lib/outline";
    import { generateShareUrl } from "$lib/permissions";
    import {
        getLocalDocument,
        saveLocalDocument,
        toggleStarLocalDocument,
    } from "$lib/storage";
    import { SupabaseYjsProvider, createClient } from "$lib/supabase.svelte";
    import { authState } from "$lib/auth.svelte";
    import type { CommentThread, DocumentVersion, UserRole } from "$lib/types";
    import { formatDate } from "$lib/utils";

    const { data } = $props<{ data: { user?: any } }>();
    const docId = $derived(page.params.docId || "doc-new");

    let title = $state("Untitled document");
    let isStarred = $state(false);
    let syncStatus = $state<"saved" | "syncing" | "offline">("saved");
    let activeSidebar = $state<"outline" | "comments" | "history" | null>(null);
    let isShareOpen = $state(false);
    let activeMenu = $state<string | null>(null);
    let activeDrop = $state<string | null>(null);
    let shareRole = $state<UserRole>("editor");
    let linkCopied = $state(false);
    let newComment = $state("");
    let comments = $state<CommentThread[]>([]);
    let versions = $state<DocumentVersion[]>([]);
    let headings = $state<HeadingItem[]>([]);
    let stats = $state<DocumentStatsDetailed | null>(null);
    let collaborators = $state<any[]>([]);

    let editorElement = $state<HTMLDivElement | null>(null);
    let toolbarRef = $state<HTMLDivElement | null>(null);

    const ydoc = new Y.Doc();
    let provider = $state<SupabaseYjsProvider | null>(null);
    const docsie = new DocsieEditor();
    const editor = $derived(docsie.instance);

    const userName = $derived(
        authState.user?.user_metadata?.full_name ||
            authState.user?.user_metadata?.name ||
            data.user?.user_metadata?.full_name ||
            authState.user?.email?.split("@")[0] ||
            data.user?.email?.split("@")[0] ||
            "Collaborator",
    );
    const userAvatar = $derived(
        authState.user?.user_metadata?.avatar_url ||
            authState.user?.user_metadata?.picture ||
            null,
    );
    const currentUser = $derived({
        id: authState.user?.id || data.user?.id || "usr-me",
        name: userName,
        email: authState.user?.email || data.user?.email || "you@example.com",
        role: "owner" as const,
        color: "#1a73e8",
        avatar: userAvatar,
    });

    const shareUrl = $derived(
        generateShareUrl({
            baseUrl:
                typeof window !== "undefined"
                    ? window.location.origin
                    : "https://docsie.app",
            docId,
            role: shareRole,
            format: "hash",
        }),
    );

    function toggleDropdown(name: string) {
        activeDrop = activeDrop === name ? null : name;
    }
    function isB() {
        return editor?.isActive?.("bold") ?? false;
    }
    function isI() {
        return editor?.isActive?.("italic") ?? false;
    }
    function isU() {
        return editor?.isActive?.("underline") ?? false;
    }
    function isS() {
        return editor?.isActive?.("strike") ?? false;
    }
    function getFont() {
        return editor?.getAttributes?.("textStyle")?.fontFamily || "Arial";
    }
    function getHeading() {
        for (let i = 1; i <= 6; i++)
            if (editor?.isActive?.("heading", { level: i })) return `H${i}`;
        return "Normal";
    }
    function setHeading(h: { level?: number }) {
        if (!editor) return;
        if (!h.level) editor.chain().focus().setParagraph().run();
        else
            editor
                .chain()
                .focus()
                .setHeading({ level: h.level as any })
                .run();
        activeDrop = null;
    }
    function changeSize(d: number) {
        const n = Math.max(
            1,
            (parseInt(
                editor?.getAttributes?.("textStyle")?.fontSize || "11",
                10,
            ) || 11) + d,
        );
        (editor?.chain().focus() as any)?.setFontSize(`${n}pt`).run();
    }

    function updateOutlineAndStats() {
        if (!editor) return;
        const html = editor.getHTML();
        headings = extractHeadings(html);
        stats = calculateStats(html);
    }

    function exportDoc(type: "docx" | "md" | "html" | "txt" | "pdf") {
        const json = editor?.getJSON() || { type: "doc", content: [] };
        const fn = (title || "document").replace(/[^a-zA-Z0-9_-]/g, "_");
        if (type === "md") downloadMarkdown(json, `${fn}.md`);
        else if (type === "docx") downloadDocx(json, `${fn}.docx`);
        else if (type === "html")
            downloadHtml(editor?.getHTML() || "", `${fn}.html`, title);
        else if (type === "txt") downloadTxt(json, `${fn}.txt`);
        else if (type === "pdf") window.print();
        activeMenu = null;
    }

    function copyShareLink() {
        if (typeof navigator !== "undefined") {
            navigator.clipboard.writeText(shareUrl);
            linkCopied = true;
            setTimeout(() => (linkCopied = false), 2000);
        }
    }

    function addComment() {
        if (!newComment.trim()) return;
        comments = [
            ...comments,
            {
                id: `c_${Date.now()}`,
                author: currentUser,
                content: newComment.trim(),
                resolved: false,
                replies: [],
                created_at: Date.now(),
            },
        ];
        newComment = "";
    }

    onMount(() => {
        const local = getLocalDocument(docId);
        if (local?.title) title = local.title;
        if (local?.isStarred !== undefined) isStarred = local.isStarred;

        try {
            const p = new SupabaseYjsProvider(docId, ydoc, {
                supabase: createClient(),
                user: currentUser,
            });
            p.on("status", (s: any) => {
                syncStatus = s.status === "connected" ? "saved" : "offline";
            });
            p.on("awareness", ({ states }: any) => {
                collaborators = Array.from(states.values())
                    .map((st: any) => st.user)
                    .filter(Boolean);
            });
            provider = p;
        } catch {
            syncStatus = "offline";
        }

        if (editorElement) {
            docsie.mount(editorElement, {
                ydoc,
                provider,
                user: currentUser,
                editable: true,
                content: local?.content || "<p></p>",
                onUpdate: () => {
                    updateOutlineAndStats();
                    saveLocalDocument({
                        id: docId,
                        title,
                        content: editor?.getHTML(),
                    });
                },
                onSelectionUpdate: () => updateOutlineAndStats(),
            });
            updateOutlineAndStats();
        }
    });

    onDestroy(() => {
        provider?.destroy();
        docsie.destroy();
        ydoc.destroy();
    });
</script>

<svelte:head><title>{title} - Docsie</title></svelte:head>
<svelte:window
    onclick={(e) => {
        const target = e.target as HTMLElement;
        if (!target.closest("[data-menu]")) activeMenu = null;
        if (toolbarRef && !toolbarRef.contains(target)) activeDrop = null;
    }}
/>

<div class="flex flex-col h-screen overflow-hidden bg-[#f9fbfd]">
    <!-- Menu Bar -->
    <header
        class="bg-white border-b border-gray-200 select-none px-4 py-2 flex items-center justify-between"
    >
        <div class="flex items-center gap-3 min-w-0">
            <a href="/" class="text-blue-600 hover:opacity-80"
                ><FileText size={32} /></a
            >
            <div class="flex flex-col min-w-0">
                <div class="flex items-center gap-2">
                    <input
                        type="text"
                        bind:value={title}
                        onblur={() => saveLocalDocument({ id: docId, title })}
                        onkeydown={(e) =>
                            e.key === "Enter" &&
                            (e.target as HTMLInputElement).blur()}
                        class="text-base font-medium text-gray-900 border border-transparent hover:border-gray-300 focus:border-blue-500 rounded px-1 -ml-1 outline-none truncate max-w-xs sm:max-w-md"
                    />
                    <button
                        type="button"
                        aria-label="Star document"
                        onclick={() =>
                            (isStarred = toggleStarLocalDocument(docId))}
                        class="text-gray-400 hover:text-amber-500"
                    >
                        <Star
                            size={16}
                            class={isStarred
                                ? "fill-amber-400 text-amber-500"
                                : ""}
                        />
                    </button>
                    {#if syncStatus === "saved"}
                        <span title="Saved to cloud"
                            ><Cloud size={14} class="text-gray-400" /></span
                        >
                    {:else if syncStatus === "syncing"}
                        <span title="Saving..."
                            ><Cloud
                                size={14}
                                class="text-blue-500 animate-pulse"
                            /></span
                        >
                    {:else}
                        <span title="Offline"
                            ><CloudOff size={14} class="text-red-400" /></span
                        >
                    {/if}
                </div>
                <nav
                    class="flex items-center gap-1 text-xs text-gray-600 -ml-1 mt-0.5"
                    data-menu
                >
                    <div class="relative">
                        <button
                            type="button"
                            class="px-1.5 py-0.5 rounded hover:bg-gray-100"
                            onclick={() =>
                                (activeMenu =
                                    activeMenu === "file" ? null : "file")}
                            >File</button
                        >
                        {#if activeMenu === "file"}
                            <div
                                class="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 w-44 z-50 text-xs"
                            >
                                <button
                                    type="button"
                                    class="w-full text-left px-3 py-1.5 hover:bg-gray-100"
                                    onclick={() => exportDoc("docx")}
                                    >Download as DOCX</button
                                >
                                <button
                                    type="button"
                                    class="w-full text-left px-3 py-1.5 hover:bg-gray-100"
                                    onclick={() => exportDoc("md")}
                                    >Download as Markdown</button
                                >
                                <button
                                    type="button"
                                    class="w-full text-left px-3 py-1.5 hover:bg-gray-100"
                                    onclick={() => exportDoc("html")}
                                    >Download as HTML</button
                                >
                                <button
                                    type="button"
                                    class="w-full text-left px-3 py-1.5 hover:bg-gray-100"
                                    onclick={() => exportDoc("txt")}
                                    >Download as Plain Text</button
                                >
                                <button
                                    type="button"
                                    class="w-full text-left px-3 py-1.5 hover:bg-gray-100"
                                    onclick={() => exportDoc("pdf")}
                                    >Print / PDF</button
                                >
                            </div>
                        {/if}
                    </div>
                    <button
                        type="button"
                        class="px-1.5 py-0.5 rounded hover:bg-gray-100"
                        onclick={() =>
                            (activeSidebar =
                                activeSidebar === "outline" ? null : "outline")}
                        >Outline</button
                    >
                    <button
                        type="button"
                        class="px-1.5 py-0.5 rounded hover:bg-gray-100"
                        onclick={() =>
                            (activeSidebar =
                                activeSidebar === "comments"
                                    ? null
                                    : "comments")}>Comments</button
                    >
                    <button
                        type="button"
                        class="px-1.5 py-0.5 rounded hover:bg-gray-100"
                        onclick={() =>
                            (activeSidebar =
                                activeSidebar === "history" ? null : "history")}
                        >History</button
                    >
                </nav>
            </div>
        </div>

        <div class="flex items-center gap-3">
            <div class="flex -space-x-1.5 overflow-hidden">
                {#each collaborators.slice(0, 4) as c}
                    <div
                        class="w-7 h-7 rounded-full text-white flex items-center justify-center font-bold text-[10px] ring-2 ring-white shadow-xs"
                        style="background-color: {c.color || '#1a73e8'};"
                        title={c.name || "Collaborator"}
                    >
                        {(c.name || "U")[0].toUpperCase()}
                    </div>
                {/each}
            </div>
            <button
                type="button"
                onclick={() => (isShareOpen = true)}
                class="flex items-center gap-1.5 px-4 py-1.5 bg-[#c2e7ff] hover:bg-[#b3def5] text-[#001d35] rounded-full text-xs font-semibold shadow-xs transition-colors"
                ><Share2 size={15} /> Share</button
            >
        </div>
    </header>

    <!-- Editor Container -->
    <div class="flex flex-1 overflow-hidden relative">
        <div class="flex-1 flex flex-col overflow-hidden bg-[#edf2fa]">
            <!-- Toolbar -->
            <div
                bind:this={toolbarRef}
                class="sticky top-0 z-30 flex flex-wrap items-center gap-0.5 bg-[#edf2fa] px-3 py-1 border-b border-[#dadce0] select-none text-[#444746] text-xs"
            >
                <button
                    type="button"
                    aria-label="Undo"
                    class="p-1.5 rounded hover:bg-black/5"
                    onclick={() => editor?.chain().focus().undo().run()}
                    ><Undo2 size={15} /></button
                >
                <button
                    type="button"
                    aria-label="Redo"
                    class="p-1.5 rounded hover:bg-black/5"
                    onclick={() => editor?.chain().focus().redo().run()}
                    ><Redo2 size={15} /></button
                >
                <button
                    type="button"
                    aria-label="Print"
                    class="p-1.5 rounded hover:bg-black/5"
                    onclick={() => window.print()}><Printer size={15} /></button
                >
                <div class="h-4 w-px bg-[#c4c7c5] mx-1"></div>

                <div class="relative">
                    <button
                        type="button"
                        class="flex items-center gap-1 px-2 py-1 rounded hover:bg-black/5"
                        onclick={() => toggleDropdown("h")}
                        ><span>{getHeading()}</span><ChevronDown
                            size={11}
                        /></button
                    >
                    {#if activeDrop === "h"}
                        <div
                            class="absolute left-0 top-full mt-1 bg-white rounded shadow-lg border border-gray-200 z-50 py-1 w-32"
                        >
                            {#each HEADING_STYLES as h}
                                <button
                                    type="button"
                                    class="w-full text-left px-3 py-1 hover:bg-gray-100"
                                    onclick={() =>
                                        setHeading({ level: h.level })}
                                    >{h.label}</button
                                >
                            {/each}
                        </div>
                    {/if}
                </div>

                <div class="relative">
                    <button
                        type="button"
                        class="flex items-center gap-1 px-2 py-1 rounded hover:bg-black/5 truncate max-w-24"
                        onclick={() => toggleDropdown("f")}
                        ><span class="truncate">{getFont()}</span><ChevronDown
                            size={11}
                        /></button
                    >
                    {#if activeDrop === "f"}
                        <div
                            class="absolute left-0 top-full mt-1 bg-white rounded shadow-lg border border-gray-200 z-50 py-1 w-36 max-h-48 overflow-y-auto"
                        >
                            {#each FONT_FAMILIES as f}
                                <button
                                    type="button"
                                    class="w-full text-left px-3 py-1 hover:bg-gray-100 truncate"
                                    onclick={() => {
                                        editor
                                            ?.chain()
                                            .focus()
                                            .setFontFamily(f.value)
                                            .run();
                                        activeDrop = null;
                                    }}>{f.label}</button
                                >
                            {/each}
                        </div>
                    {/if}
                </div>
                <div class="h-4 w-px bg-[#c4c7c5] mx-1"></div>

                <div class="flex items-center">
                    <button
                        type="button"
                        aria-label="Decrease font size"
                        class="p-1 rounded hover:bg-black/5"
                        onclick={() => changeSize(-1)}
                        ><Minus size={11} /></button
                    >
                    <button
                        type="button"
                        aria-label="Increase font size"
                        class="p-1 rounded hover:bg-black/5"
                        onclick={() => changeSize(1)}><Plus size={11} /></button
                    >
                </div>
                <div class="h-4 w-px bg-[#c4c7c5] mx-1"></div>

                <button
                    type="button"
                    aria-label="Bold"
                    class="p-1.5 rounded hover:bg-black/5"
                    class:bg-blue-100={isB()}
                    onclick={() => editor?.chain().focus().toggleBold().run()}
                    ><Bold size={15} /></button
                >
                <button
                    type="button"
                    aria-label="Italic"
                    class="p-1.5 rounded hover:bg-black/5"
                    class:bg-blue-100={isI()}
                    onclick={() => editor?.chain().focus().toggleItalic().run()}
                    ><Italic size={15} /></button
                >
                <button
                    type="button"
                    aria-label="Underline"
                    class="p-1.5 rounded hover:bg-black/5"
                    class:bg-blue-100={isU()}
                    onclick={() =>
                        editor?.chain().focus().toggleUnderline().run()}
                    ><UnderlineIcon size={15} /></button
                >
                <button
                    type="button"
                    aria-label="Strikethrough"
                    class="p-1.5 rounded hover:bg-black/5"
                    class:bg-blue-100={isS()}
                    onclick={() => editor?.chain().focus().toggleStrike().run()}
                    ><Strikethrough size={15} /></button
                >

                <div class="relative">
                    <button
                        type="button"
                        aria-label="Text color"
                        class="p-1.5 rounded hover:bg-black/5"
                        onclick={() => toggleDropdown("c")}
                        ><Baseline size={15} /></button
                    >
                    {#if activeDrop === "c"}
                        <div
                            class="absolute left-0 top-full mt-1 bg-white rounded p-2 grid grid-cols-6 gap-1 w-36 shadow-lg border border-gray-200 z-50"
                        >
                            {#each GOOGLE_COLORS.slice(0, 18) as c}
                                <button
                                    type="button"
                                    aria-label={`Color ${c}`}
                                    class="w-4 h-4 rounded-full border border-gray-200"
                                    style="background-color: {c};"
                                    onclick={() => {
                                        editor
                                            ?.chain()
                                            .focus()
                                            .setColor(c)
                                            .run();
                                        activeDrop = null;
                                    }}
                                ></button>
                            {/each}
                        </div>
                    {/if}
                </div>

                <button
                    type="button"
                    aria-label="Bullet list"
                    class="p-1.5 rounded hover:bg-black/5"
                    onclick={() =>
                        editor?.chain().focus().toggleBulletList().run()}
                    ><List size={15} /></button
                >
                <button
                    type="button"
                    aria-label="Numbered list"
                    class="p-1.5 rounded hover:bg-black/5"
                    onclick={() =>
                        editor?.chain().focus().toggleOrderedList().run()}
                    ><ListOrdered size={15} /></button
                >
                <button
                    type="button"
                    aria-label="Task list"
                    class="p-1.5 rounded hover:bg-black/5"
                    onclick={() =>
                        editor?.chain().focus().toggleTaskList().run()}
                    ><ListTodo size={15} /></button
                >
                <button
                    type="button"
                    aria-label="Insert table"
                    class="p-1.5 rounded hover:bg-black/5"
                    onclick={() =>
                        editor
                            ?.chain()
                            .focus()
                            .insertTable({
                                rows: 3,
                                cols: 3,
                                withHeaderRow: true,
                            })
                            .run()}><TableIcon size={15} /></button
                >
                <button
                    type="button"
                    aria-label="Clear formatting"
                    class="p-1.5 rounded hover:bg-black/5"
                    onclick={() =>
                        editor
                            ?.chain()
                            .focus()
                            .unsetAllMarks()
                            .clearNodes()
                            .run()}><RemoveFormatting size={15} /></button
                >
            </div>

            <!-- Canvas -->
            <div
                class="flex-1 overflow-y-auto px-4 py-8 flex justify-center bg-[#f9fbfd]"
            >
                <div
                    class="relative bg-white text-[#202124] shadow-md border border-[#dadce0]/60 rounded-xs w-204 min-h-264 py-16 px-24"
                >
                    <div
                        bind:this={editorElement}
                        class="min-h-225 outline-none text-gray-900 leading-relaxed font-sans"
                    ></div>
                </div>
            </div>
        </div>

        <!-- Sidebar Drawer -->
        {#if activeSidebar}
            <aside
                class="w-80 bg-white border-l border-gray-200 h-full flex flex-col shadow-lg z-30 select-none"
            >
                <div
                    class="flex items-center justify-between px-4 py-3 border-b border-gray-100"
                >
                    <div
                        class="flex items-center gap-2 text-sm font-semibold text-gray-800"
                    >
                        {#if activeSidebar === "outline"}
                            <List size={16} class="text-blue-600" /><span
                                >Document outline</span
                            >
                        {:else if activeSidebar === "comments"}
                            <MessageSquare
                                size={16}
                                class="text-blue-600"
                            /><span>Comments ({comments.length})</span>
                        {:else}
                            <History size={16} class="text-blue-600" /><span
                                >Version history</span
                            >
                        {/if}
                    </div>
                    <button
                        type="button"
                        aria-label="Close sidebar"
                        class="p-1 rounded text-gray-400 hover:text-gray-600"
                        onclick={() => (activeSidebar = null)}
                        ><X size={16} /></button
                    >
                </div>

                {#if activeSidebar === "outline"}
                    <div class="flex-1 overflow-y-auto p-3 space-y-1">
                        {#if !headings.length}
                            <div
                                class="text-center py-12 text-gray-400 text-xs"
                            >
                                Headings appear here.
                            </div>
                        {:else}
                            {#each headings as h}
                                <button
                                    type="button"
                                    class="w-full text-left py-1 px-2 rounded text-xs truncate hover:bg-gray-100"
                                    style="padding-left: {(h.level - 1) * 12 +
                                        8}px;">{h.text}</button
                                >
                            {/each}
                        {/if}
                    </div>
                    {#if stats}
                        <div
                            class="p-3 border-t border-gray-100 bg-gray-50 text-[11px] text-gray-500 space-y-1"
                        >
                            <div class="flex justify-between">
                                <span>Words:</span><span
                                    class="font-medium text-gray-800"
                                    >{stats.words}</span
                                >
                            </div>
                            <div class="flex justify-between">
                                <span>Characters:</span><span
                                    class="font-medium text-gray-800"
                                    >{stats.characters}</span
                                >
                            </div>
                        </div>
                    {/if}
                {:else if activeSidebar === "comments"}
                    <div
                        class="p-3 border-b border-gray-100 bg-gray-50 flex gap-2"
                    >
                        <input
                            type="text"
                            placeholder="Add comment..."
                            bind:value={newComment}
                            onkeydown={(e) => e.key === "Enter" && addComment()}
                            class="flex-1 px-2.5 py-1.5 border border-gray-300 rounded text-xs bg-white outline-none"
                        />
                        <button
                            type="button"
                            class="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium"
                            onclick={addComment}>Post</button
                        >
                    </div>
                    <div class="flex-1 overflow-y-auto p-3 space-y-3">
                        {#each comments as c}
                            <div
                                class="border border-gray-200 rounded-lg p-2.5 text-xs space-y-1 bg-white"
                            >
                                <div class="flex items-center justify-between">
                                    <span class="font-medium text-gray-800"
                                        >{c.author?.name || "User"}</span
                                    >
                                    <div class="flex items-center gap-1">
                                        <button
                                            type="button"
                                            aria-label="Resolve comment"
                                            onclick={() =>
                                                (comments = comments.filter(
                                                    (x) => x.id !== c.id,
                                                ))}
                                            class="text-gray-400 hover:text-green-600"
                                            ><Check size={13} /></button
                                        >
                                        <button
                                            type="button"
                                            aria-label="Delete comment"
                                            onclick={() =>
                                                (comments = comments.filter(
                                                    (x) => x.id !== c.id,
                                                ))}
                                            class="text-gray-400 hover:text-red-600"
                                            ><Trash2 size={13} /></button
                                        >
                                    </div>
                                </div>
                                <p class="text-gray-700">{c.content}</p>
                            </div>
                        {/each}
                    </div>
                {:else if activeSidebar === "history"}
                    <div class="flex-1 overflow-y-auto p-3 space-y-2">
                        {#if !versions.length}
                            <div
                                class="text-center py-12 text-gray-400 text-xs"
                            >
                                No saved versions yet.
                            </div>
                        {/if}
                        {#each versions as v}
                            <div
                                class="border border-gray-200 rounded-lg p-2.5 text-xs space-y-1 bg-white"
                            >
                                <div class="flex items-center justify-between">
                                    <span class="font-medium text-gray-800"
                                        >{v.name ||
                                            formatDate(v.created_at)}</span
                                    >
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </aside>
        {/if}
    </div>

    <!-- Share Modal -->
    {#if isShareOpen}
        <div
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 select-none"
        >
            <div
                class="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 text-gray-800"
            >
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <div
                            class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"
                        >
                            <Shield size={18} />
                        </div>
                        <h2
                            class="text-base font-semibold text-gray-900 truncate"
                        >
                            Share "{title}"
                        </h2>
                    </div>
                    <button
                        type="button"
                        aria-label="Close share dialog"
                        class="p-1 text-gray-400 hover:text-gray-600 rounded-full"
                        onclick={() => (isShareOpen = false)}
                        ><X size={18} /></button
                    >
                </div>

                <div
                    class="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl"
                >
                    <div class="flex items-center gap-3">
                        <Globe size={18} class="text-gray-500" />
                        <div class="text-xs">
                            <p class="font-medium text-gray-800">
                                Anyone with the link
                            </p>
                            <p class="text-gray-400">
                                Can access as {shareRole}
                            </p>
                        </div>
                    </div>
                    <select
                        bind:value={shareRole}
                        class="text-xs font-medium border border-gray-300 rounded-lg px-2.5 py-1 bg-white outline-none"
                    >
                        <option value="viewer">Viewer</option>
                        <option value="commenter">Commenter</option>
                        <option value="editor">Editor</option>
                    </select>
                </div>

                <div class="flex items-center justify-between pt-2">
                    <button
                        type="button"
                        onclick={copyShareLink}
                        class="flex items-center gap-1.5 px-4 py-2 border border-blue-600 text-blue-600 hover:bg-blue-50 rounded-full text-xs font-medium transition-colors"
                    >
                        {#if linkCopied}<Check size={14} /> Link Copied{:else}<Copy
                                size={14}
                            /> Copy link{/if}
                    </button>
                    <button
                        type="button"
                        onclick={() => (isShareOpen = false)}
                        class="px-5 py-2 bg-blue-600 text-white rounded-full text-xs font-medium hover:bg-blue-700"
                        >Done</button
                    >
                </div>
            </div>
        </div>
    {/if}
</div>
