<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { page } from "$app/state";
    import * as Y from "yjs";
    import {
        FileText,
        Star,
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
        Sparkles
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
        color: "#18181b",
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
        return editor?.getAttributes?.("textStyle")?.fontFamily || "Inter";
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

<div class="flex flex-col h-screen overflow-hidden bg-[#fafafa] font-sans text-zinc-900">
    <!-- Sleek Shadcn / Vercel Header -->
    <header class="bg-white border-b border-zinc-200/80 select-none px-4 py-2 flex items-center justify-between shadow-2xs z-40">
        <div class="flex items-center gap-3 min-w-0">
            <a href="/" class="w-8 h-8 rounded-lg bg-zinc-950 text-white flex items-center justify-center shadow-xs hover:bg-zinc-800 transition-colors shrink-0">
                <FileText size={17} class="stroke-[2.2]" />
            </a>
            <div class="flex flex-col min-w-0">
                <div class="flex items-center gap-2">
                    <input
                        type="text"
                        bind:value={title}
                        onblur={() => saveLocalDocument({ id: docId, title })}
                        onkeydown={(e) =>
                            e.key === "Enter" &&
                            (e.target as HTMLInputElement).blur()}
                        class="text-sm font-semibold text-zinc-950 border border-transparent hover:border-zinc-200 focus:border-zinc-950 rounded-md px-1.5 py-0.5 -ml-1.5 outline-none truncate max-w-xs sm:max-w-md transition-colors"
                    />
                    <button
                        type="button"
                        aria-label="Star document"
                        onclick={() =>
                            (isStarred = toggleStarLocalDocument(docId))}
                        class="text-zinc-400 hover:text-amber-500 transition-colors"
                    >
                        <Star
                            size={14}
                            class={isStarred
                                ? "fill-amber-400 text-amber-500"
                                : ""}
                        />
                    </button>

                    <!-- Minimalist Sync Status Badge -->
                    {#if syncStatus === "saved"}
                        <span class="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 bg-zinc-100 border border-zinc-200/70 px-2 py-0.5 rounded-full" title="Changes saved">
                            <span class="w-1.5 h-1.5 rounded-full bg-zinc-950"></span>
                            Saved
                        </span>
                    {:else if syncStatus === "syncing"}
                        <span class="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-800 bg-zinc-100 border border-zinc-300 px-2 py-0.5 rounded-full animate-pulse" title="Saving changes...">
                            <span class="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-ping"></span>
                            Syncing...
                        </span>
                    {:else}
                        <span class="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full" title="Offline mode">
                            <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            Offline
                        </span>
                    {/if}
                </div>

                <!-- Sleek Menu Bar -->
                <nav class="flex items-center gap-0.5 text-xs text-zinc-600 -ml-1 mt-0.5 font-medium" data-menu>
                    <div class="relative">
                        <button
                            type="button"
                            class="px-2 py-0.5 rounded-md hover:bg-zinc-100 hover:text-zinc-950 transition-colors cursor-pointer"
                            onclick={() => (activeMenu = activeMenu === "file" ? null : "file")}
                        >
                            File
                        </button>
                        {#if activeMenu === "file"}
                            <div class="absolute left-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-zinc-200 py-1.5 w-48 z-50 text-xs animate-fadeIn">
                                <button
                                    type="button"
                                    class="w-full text-left px-3.5 py-1.5 hover:bg-zinc-50 text-zinc-700 hover:text-zinc-950 transition-colors cursor-pointer"
                                    onclick={() => exportDoc("docx")}
                                >
                                    Download as DOCX
                                </button>
                                <button
                                    type="button"
                                    class="w-full text-left px-3.5 py-1.5 hover:bg-zinc-50 text-zinc-700 hover:text-zinc-950 transition-colors cursor-pointer"
                                    onclick={() => exportDoc("md")}
                                >
                                    Download as Markdown
                                </button>
                                <button
                                    type="button"
                                    class="w-full text-left px-3.5 py-1.5 hover:bg-zinc-50 text-zinc-700 hover:text-zinc-950 transition-colors cursor-pointer"
                                    onclick={() => exportDoc("html")}
                                >
                                    Download as HTML
                                </button>
                                <button
                                    type="button"
                                    class="w-full text-left px-3.5 py-1.5 hover:bg-zinc-50 text-zinc-700 hover:text-zinc-950 transition-colors cursor-pointer"
                                    onclick={() => exportDoc("txt")}
                                >
                                    Download as Plain Text
                                </button>
                                <div class="my-1 border-t border-zinc-100"></div>
                                <button
                                    type="button"
                                    class="w-full text-left px-3.5 py-1.5 hover:bg-zinc-50 text-zinc-700 hover:text-zinc-950 transition-colors cursor-pointer"
                                    onclick={() => exportDoc("pdf")}
                                >
                                    Print / PDF
                                </button>
                            </div>
                        {/if}
                    </div>

                    <button
                        type="button"
                        class="px-2 py-0.5 rounded-md hover:bg-zinc-100 hover:text-zinc-950 transition-colors cursor-pointer {activeSidebar === 'outline' ? 'bg-zinc-100 text-zinc-950' : ''}"
                        onclick={() => (activeSidebar = activeSidebar === "outline" ? null : "outline")}
                    >
                        Outline
                    </button>
                    <button
                        type="button"
                        class="px-2 py-0.5 rounded-md hover:bg-zinc-100 hover:text-zinc-950 transition-colors cursor-pointer {activeSidebar === 'comments' ? 'bg-zinc-100 text-zinc-950' : ''}"
                        onclick={() => (activeSidebar = activeSidebar === "comments" ? null : "comments")}
                    >
                        Comments {#if comments.length}<span class="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-200 text-zinc-800">{comments.length}</span>{/if}
                    </button>
                    <button
                        type="button"
                        class="px-2 py-0.5 rounded-md hover:bg-zinc-100 hover:text-zinc-950 transition-colors cursor-pointer {activeSidebar === 'history' ? 'bg-zinc-100 text-zinc-950' : ''}"
                        onclick={() => (activeSidebar = activeSidebar === "history" ? null : "history")}
                    >
                        History
                    </button>
                </nav>
            </div>
        </div>

        <!-- Right Side: Collaborators & Share Button -->
        <div class="flex items-center gap-3">
            <div class="flex -space-x-1.5 overflow-hidden">
                {#each collaborators.slice(0, 4) as c}
                    <div
                        class="w-7 h-7 rounded-full text-white flex items-center justify-center font-bold text-[10px] ring-2 ring-white shadow-2xs bg-zinc-900 overflow-hidden"
                        title={c.name || "Collaborator"}
                    >
                        {#if c.avatar}
                            <img src={c.avatar} alt={c.name} class="w-full h-full object-cover" />
                        {:else}
                            {(c.name || "U")[0].toUpperCase()}
                        {/if}
                    </div>
                {/each}
            </div>

            <button
                type="button"
                onclick={() => (isShareOpen = true)}
                class="flex items-center gap-1.5 px-3.5 py-1.5 bg-zinc-950 hover:bg-zinc-800 active:scale-[0.98] text-white rounded-lg text-xs font-medium shadow-xs hover:shadow-sm transition-all cursor-pointer"
            >
                <Share2 size={14} />
                <span>Share</span>
            </button>
        </div>
    </header>

    <!-- Editor & Toolbar Container -->
    <div class="flex flex-1 overflow-hidden relative">
        <div class="flex-1 flex flex-col overflow-hidden bg-[#fafafa]">
            <!-- Sleek Shadcn Ribbon Toolbar -->
            <div
                bind:this={toolbarRef}
                class="sticky top-0 z-30 flex flex-wrap items-center gap-1 bg-white/95 backdrop-blur-md px-4 py-1.5 border-b border-zinc-200 select-none text-zinc-700 text-xs shadow-2xs"
            >
                <!-- Undo / Redo -->
                <div class="flex items-center gap-0.5">
                    <button
                        type="button"
                        aria-label="Undo"
                        class="p-1.5 rounded-md hover:bg-zinc-100 active:bg-zinc-200 text-zinc-700 hover:text-zinc-950 transition-colors cursor-pointer"
                        onclick={() => editor?.chain().focus().undo().run()}
                    >
                        <Undo2 size={14} />
                    </button>
                    <button
                        type="button"
                        aria-label="Redo"
                        class="p-1.5 rounded-md hover:bg-zinc-100 active:bg-zinc-200 text-zinc-700 hover:text-zinc-950 transition-colors cursor-pointer"
                        onclick={() => editor?.chain().focus().redo().run()}
                    >
                        <Redo2 size={14} />
                    </button>
                    <button
                        type="button"
                        aria-label="Print"
                        class="p-1.5 rounded-md hover:bg-zinc-100 active:bg-zinc-200 text-zinc-700 hover:text-zinc-950 transition-colors cursor-pointer"
                        onclick={() => window.print()}
                    >
                        <Printer size={14} />
                    </button>
                </div>

                <div class="h-4 w-px bg-zinc-200 mx-1"></div>

                <!-- Heading Style Selector -->
                <div class="relative">
                    <button
                        type="button"
                        class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-800 font-medium text-xs transition-colors cursor-pointer"
                        onclick={() => toggleDropdown("h")}
                    >
                        <span>{getHeading()}</span>
                        <ChevronDown size={12} class="text-zinc-400" />
                    </button>
                    {#if activeDrop === "h"}
                        <div class="absolute left-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-zinc-200 z-50 py-1.5 w-36 animate-fadeIn">
                            {#each HEADING_STYLES as h}
                                <button
                                    type="button"
                                    class="w-full text-left px-3.5 py-1.5 hover:bg-zinc-50 text-zinc-700 hover:text-zinc-950 text-xs transition-colors cursor-pointer"
                                    onclick={() => setHeading({ level: h.level })}
                                >
                                    {h.label}
                                </button>
                            {/each}
                        </div>
                    {/if}
                </div>

                <!-- Font Family Selector -->
                <div class="relative">
                    <button
                        type="button"
                        class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-800 font-medium text-xs truncate max-w-28 transition-colors cursor-pointer"
                        onclick={() => toggleDropdown("f")}
                    >
                        <span class="truncate">{getFont()}</span>
                        <ChevronDown size={12} class="text-zinc-400 shrink-0" />
                    </button>
                    {#if activeDrop === "f"}
                        <div class="absolute left-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-zinc-200 z-50 py-1.5 w-40 max-h-48 overflow-y-auto animate-fadeIn">
                            {#each FONT_FAMILIES as f}
                                <button
                                    type="button"
                                    class="w-full text-left px-3.5 py-1.5 hover:bg-zinc-50 text-zinc-700 hover:text-zinc-950 text-xs truncate transition-colors cursor-pointer"
                                    onclick={() => {
                                        editor?.chain().focus().setFontFamily(f.value).run();
                                        activeDrop = null;
                                    }}
                                >
                                    {f.label}
                                </button>
                            {/each}
                        </div>
                    {/if}
                </div>

                <!-- Font Size Controls -->
                <div class="flex items-center bg-zinc-50 border border-zinc-200 rounded-md p-0.5">
                    <button
                        type="button"
                        aria-label="Decrease font size"
                        class="p-1 rounded text-zinc-600 hover:bg-zinc-200 transition-colors cursor-pointer"
                        onclick={() => changeSize(-1)}
                    >
                        <Minus size={11} />
                    </button>
                    <button
                        type="button"
                        aria-label="Increase font size"
                        class="p-1 rounded text-zinc-600 hover:bg-zinc-200 transition-colors cursor-pointer"
                        onclick={() => changeSize(1)}
                    >
                        <Plus size={11} />
                    </button>
                </div>

                <div class="h-4 w-px bg-zinc-200 mx-1"></div>

                <!-- Formatting Controls (Bold, Italic, Underline, Strike) -->
                <div class="flex items-center gap-0.5">
                    <button
                        type="button"
                        aria-label="Bold"
                        class="p-1.5 rounded-md transition-colors cursor-pointer {isB() ? 'bg-zinc-950 text-white' : 'hover:bg-zinc-100 text-zinc-700'}"
                        onclick={() => editor?.chain().focus().toggleBold().run()}
                    >
                        <Bold size={14} />
                    </button>
                    <button
                        type="button"
                        aria-label="Italic"
                        class="p-1.5 rounded-md transition-colors cursor-pointer {isI() ? 'bg-zinc-950 text-white' : 'hover:bg-zinc-100 text-zinc-700'}"
                        onclick={() => editor?.chain().focus().toggleItalic().run()}
                    >
                        <Italic size={14} />
                    </button>
                    <button
                        type="button"
                        aria-label="Underline"
                        class="p-1.5 rounded-md transition-colors cursor-pointer {isU() ? 'bg-zinc-950 text-white' : 'hover:bg-zinc-100 text-zinc-700'}"
                        onclick={() => editor?.chain().focus().toggleUnderline().run()}
                    >
                        <UnderlineIcon size={14} />
                    </button>
                    <button
                        type="button"
                        aria-label="Strikethrough"
                        class="p-1.5 rounded-md transition-colors cursor-pointer {isS() ? 'bg-zinc-950 text-white' : 'hover:bg-zinc-100 text-zinc-700'}"
                        onclick={() => editor?.chain().focus().toggleStrike().run()}
                    >
                        <Strikethrough size={14} />
                    </button>
                </div>

                <!-- Color Palette -->
                <div class="relative">
                    <button
                        type="button"
                        aria-label="Text color"
                        class="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-700 transition-colors cursor-pointer"
                        onclick={() => toggleDropdown("c")}
                    >
                        <Baseline size={14} />
                    </button>
                    {#if activeDrop === "c"}
                        <div class="absolute left-0 top-full mt-1 bg-white rounded-xl p-2.5 grid grid-cols-6 gap-1.5 w-40 shadow-xl border border-zinc-200 z-50 animate-fadeIn">
                            {#each GOOGLE_COLORS.slice(0, 18) as c}
                                <button
                                    type="button"
                                    aria-label={`Color ${c}`}
                                    class="w-4.5 h-4.5 rounded-md border border-zinc-200/80 shadow-2xs hover:scale-110 transition-transform cursor-pointer"
                                    style="background-color: {c};"
                                    onclick={() => {
                                        editor?.chain().focus().setColor(c).run();
                                        activeDrop = null;
                                    }}
                                ></button>
                            {/each}
                        </div>
                    {/if}
                </div>

                <div class="h-4 w-px bg-zinc-200 mx-1"></div>

                <!-- List & Structure Controls -->
                <div class="flex items-center gap-0.5">
                    <button
                        type="button"
                        aria-label="Bullet list"
                        class="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-700 transition-colors cursor-pointer"
                        onclick={() => editor?.chain().focus().toggleBulletList().run()}
                    >
                        <List size={14} />
                    </button>
                    <button
                        type="button"
                        aria-label="Numbered list"
                        class="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-700 transition-colors cursor-pointer"
                        onclick={() => editor?.chain().focus().toggleOrderedList().run()}
                    >
                        <ListOrdered size={14} />
                    </button>
                    <button
                        type="button"
                        aria-label="Task list"
                        class="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-700 transition-colors cursor-pointer"
                        onclick={() => editor?.chain().focus().toggleTaskList().run()}
                    >
                        <ListTodo size={14} />
                    </button>
                    <button
                        type="button"
                        aria-label="Insert table"
                        class="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-700 transition-colors cursor-pointer"
                        onclick={() =>
                            editor?.chain().focus().insertTable({
                                rows: 3,
                                cols: 3,
                                withHeaderRow: true,
                            }).run()}
                    >
                        <TableIcon size={14} />
                    </button>
                    <button
                        type="button"
                        aria-label="Clear formatting"
                        class="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-700 transition-colors cursor-pointer"
                        onclick={() =>
                            editor?.chain().focus().unsetAllMarks().clearNodes().run()}
                    >
                        <RemoveFormatting size={14} />
                    </button>
                </div>
            </div>

            <!-- Canvas Viewport -->
            <div class="flex-1 overflow-y-auto px-4 py-8 flex justify-center bg-[#fafafa]">
                <div class="relative bg-white text-zinc-900 shadow-sm border border-zinc-200/90 rounded-xl w-full max-w-[850px] min-h-[1050px] py-16 px-12 sm:px-20 transition-all">
                    <div
                        bind:this={editorElement}
                        class="min-h-[900px] outline-none text-zinc-900 leading-relaxed font-sans"
                    ></div>
                </div>
            </div>
        </div>

        <!-- Sleek Shadcn Sidebar Drawer -->
        {#if activeSidebar}
            <aside class="w-80 bg-white border-l border-zinc-200 h-full flex flex-col shadow-lg z-30 select-none animate-fadeIn">
                <div class="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
                    <div class="flex items-center gap-2 text-xs font-semibold text-zinc-900">
                        {#if activeSidebar === "outline"}
                            <List size={15} class="text-zinc-900" />
                            <span>Document Outline</span>
                        {:else if activeSidebar === "comments"}
                            <MessageSquare size={15} class="text-zinc-900" />
                            <span>Comments ({comments.length})</span>
                        {:else}
                            <History size={15} class="text-zinc-900" />
                            <span>Version History</span>
                        {/if}
                    </div>
                    <button
                        type="button"
                        aria-label="Close sidebar"
                        class="p-1 rounded-md text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
                        onclick={() => (activeSidebar = null)}
                    >
                        <X size={15} />
                    </button>
                </div>

                {#if activeSidebar === "outline"}
                    <div class="flex-1 overflow-y-auto p-4 space-y-1">
                        {#if !headings.length}
                            <div class="text-center py-12 text-zinc-400 text-xs">
                                Headings in your document will appear here.
                            </div>
                        {:else}
                            {#each headings as h}
                                <button
                                    type="button"
                                    class="w-full text-left py-1.5 px-2.5 rounded-lg text-xs truncate hover:bg-zinc-50 text-zinc-700 hover:text-zinc-950 transition-colors cursor-pointer font-medium"
                                    style="padding-left: {(h.level - 1) * 12 + 10}px;"
                                >
                                    {h.text}
                                </button>
                            {/each}
                        {/if}
                    </div>
                    {#if stats}
                        <div class="p-4 border-t border-zinc-100 bg-zinc-50/50 text-xs text-zinc-600 space-y-1.5 font-medium">
                            <div class="flex justify-between">
                                <span class="text-zinc-500">Words:</span>
                                <span class="font-semibold text-zinc-900">{stats.words}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-zinc-500">Characters:</span>
                                <span class="font-semibold text-zinc-900">{stats.characters}</span>
                            </div>
                        </div>
                    {/if}
                {:else if activeSidebar === "comments"}
                    <div class="p-3 border-b border-zinc-100 bg-zinc-50/50 flex gap-2">
                        <input
                            type="text"
                            placeholder="Add a comment..."
                            bind:value={newComment}
                            onkeydown={(e) => e.key === "Enter" && addComment()}
                            class="flex-1 px-3 py-1.5 border border-zinc-200 rounded-lg text-xs bg-white text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-950 transition-colors"
                        />
                        <button
                            type="button"
                            class="px-3.5 py-1.5 bg-zinc-950 hover:bg-zinc-800 text-white rounded-lg text-xs font-medium shadow-xs transition-colors cursor-pointer"
                            onclick={addComment}
                        >
                            Post
                        </button>
                    </div>
                    <div class="flex-1 overflow-y-auto p-4 space-y-3">
                        {#if !comments.length}
                            <div class="text-center py-12 text-zinc-400 text-xs">
                                No comments yet on this document.
                            </div>
                        {/if}
                        {#each comments as c}
                            <div class="border border-zinc-200 rounded-xl p-3 text-xs space-y-1.5 bg-white shadow-2xs">
                                <div class="flex items-center justify-between">
                                    <span class="font-semibold text-zinc-900">{c.author?.name || "User"}</span>
                                    <div class="flex items-center gap-1">
                                        <button
                                            type="button"
                                            aria-label="Resolve comment"
                                            onclick={() => (comments = comments.filter((x) => x.id !== c.id))}
                                            class="p-1 text-zinc-400 hover:text-green-600 transition-colors cursor-pointer"
                                        >
                                            <Check size={13} />
                                        </button>
                                        <button
                                            type="button"
                                            aria-label="Delete comment"
                                            onclick={() => (comments = comments.filter((x) => x.id !== c.id))}
                                            class="p-1 text-zinc-400 hover:text-red-600 transition-colors cursor-pointer"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                                <p class="text-zinc-600 leading-relaxed">{c.content}</p>
                            </div>
                        {/each}
                    </div>
                {:else if activeSidebar === "history"}
                    <div class="flex-1 overflow-y-auto p-4 space-y-2">
                        {#if !versions.length}
                            <div class="text-center py-12 text-zinc-400 text-xs">
                                No saved version snapshots yet.
                            </div>
                        {/if}
                        {#each versions as v}
                            <div class="border border-zinc-200 rounded-xl p-3 text-xs space-y-1 bg-white shadow-2xs">
                                <div class="flex items-center justify-between">
                                    <span class="font-semibold text-zinc-900">{v.name || formatDate(v.created_at)}</span>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </aside>
        {/if}
    </div>

    <!-- Sleek Shadcn Share Dialog -->
    {#if isShareOpen}
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 select-none animate-fadeIn">
            <div class="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-zinc-200 space-y-5 text-zinc-900">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-lg bg-zinc-950 text-white flex items-center justify-center shadow-xs">
                            <Shield size={16} />
                        </div>
                        <h2 class="text-base font-semibold text-zinc-950 truncate max-w-[280px]">
                            Share "{title}"
                        </h2>
                    </div>
                    <button
                        type="button"
                        aria-label="Close share dialog"
                        class="p-1 text-zinc-400 hover:text-zinc-900 rounded-lg transition-colors cursor-pointer"
                        onclick={() => (isShareOpen = false)}
                    >
                        <X size={17} />
                    </button>
                </div>

                <div class="flex items-center justify-between p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl">
                    <div class="flex items-center gap-3">
                        <Globe size={18} class="text-zinc-500 shrink-0" />
                        <div class="text-xs">
                            <p class="font-semibold text-zinc-900">
                                Anyone with the link
                            </p>
                            <p class="text-zinc-500">
                                Can access as {shareRole}
                            </p>
                        </div>
                    </div>
                    <select
                        bind:value={shareRole}
                        class="text-xs font-semibold border border-zinc-200 rounded-lg px-2.5 py-1.5 bg-white text-zinc-900 shadow-2xs hover:border-zinc-300 focus:ring-1 focus:ring-zinc-950 outline-none cursor-pointer"
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
                        class="flex items-center gap-1.5 px-4 py-2 border border-zinc-200 bg-white hover:bg-zinc-50 active:bg-zinc-100 text-zinc-900 rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer"
                    >
                        {#if linkCopied}
                            <Check size={14} class="text-zinc-950" />
                            <span>Link Copied!</span>
                        {:else}
                            <Copy size={14} />
                            <span>Copy Link</span>
                        {/if}
                    </button>
                    <button
                        type="button"
                        onclick={() => (isShareOpen = false)}
                        class="px-5 py-2 bg-zinc-950 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    {/if}
</div>
