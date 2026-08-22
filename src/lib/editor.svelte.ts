import { Editor, Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import FontFamily from "@tiptap/extension-font-family";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import type * as Y from "yjs";
import type { UserRole, UserProfile } from "./types";


export const FONT_FAMILIES = [
    { label: "Arial", value: "Arial, sans-serif" }, { label: "Calibri", value: "Calibri, sans-serif" },
    { label: "Comic Sans", value: "'Comic Sans MS', cursive" }, { label: "Courier New", value: "'Courier New', monospace" },
    { label: "Georgia", value: "Georgia, serif" }, { label: "Inter", value: "'Inter', sans-serif" },
    { label: "Roboto", value: "'Roboto', sans-serif" }, { label: "Times New Roman", value: "'Times New Roman', serif" },
];
export const FONT_SIZES = ["8pt", "9pt", "10pt", "11pt", "12pt", "14pt", "18pt", "24pt", "30pt", "36pt", "48pt", "72pt"];
export const HEADING_STYLES = [
    { label: "Normal text", tag: "p", fontSize: "11pt", fontWeight: "normal" },
    { label: "Title", tag: "h1", level: 1 as const, fontSize: "26pt", fontWeight: "bold" },
    { label: "Subtitle", tag: "h2", level: 2 as const, fontSize: "15pt", fontWeight: "500" },
    { label: "Heading 1", tag: "h1", level: 1 as const, fontSize: "20pt", fontWeight: "400" },
    { label: "Heading 2", tag: "h2", level: 2 as const, fontSize: "16pt", fontWeight: "400" },
    { label: "Heading 3", tag: "h3", level: 3 as const, fontSize: "14pt", fontWeight: "500" },
];
export const LINE_HEIGHTS = [{ label: "Single", value: "1" }, { label: "1.15", value: "1.15" }, { label: "1.5", value: "1.5" }, { label: "Double", value: "2" }];
export const GOOGLE_COLORS = ["#000000", "#434343", "#666666", "#999999", "#b7b7b7", "#cccccc", "#ffffff", "#980000", "#ff0000", "#ff9900", "#ffff00", "#00ff00", "#00ffff", "#4a86e8", "#0000ff", "#9900ff", "#ff00ff", "#e6b8af", "#f4cccc", "#fce5cd", "#fff2cc", "#d9ead3", "#d0e0e3", "#c9daf8", "#cfe2f3", "#d9d2e9", "#ead1dc"];
export const HIGHLIGHT_COLORS = [{ label: "None", value: "" }, { label: "Yellow", value: "#fff59d" }, { label: "Green", value: "#c8e6c9" }, { label: "Cyan", value: "#b2ebf2" }, { label: "Magenta", value: "#f8bbd0" }, { label: "Orange", value: "#ffe0b2" }, { label: "Purple", value: "#e1bee7" }, { label: "Blue", value: "#bbdefb" }];

export const FontSize = Extension.create({
    name: "fontSize",
    addGlobalAttributes() { return [{ types: ["textStyle"], attributes: { fontSize: { default: null, parseHTML: (el) => el.style.fontSize?.replace(/['"]+/g, "") || null, renderHTML: (a) => a.fontSize ? { style: `font-size: ${a.fontSize}` } : {} } } }]; },
    addCommands(): any { return { setFontSize: (fontSize: string) => ({ chain }: any) => chain().setMark("textStyle", { fontSize }).run() }; }
});

export const Indent = Extension.create({
    name: "indent",
    addGlobalAttributes() { return [{ types: ["paragraph", "heading", "blockquote"], attributes: { indent: { default: 0, parseHTML: (el) => Math.round((parseInt(el.style.marginLeft, 10) || 0) / 36), renderHTML: (a) => a.indent ? { style: `margin-left: ${a.indent * 36}px` } : {} } } }]; },
    addCommands(): any {
        const s = (d: number) => () => ({ tr, state, dispatch }: any) => {
            let ok = false;
            state.doc.nodesBetween(state.selection.from, state.selection.to, (node: any, pos: number) => {
                if (["paragraph", "heading", "blockquote"].includes(node.type.name)) { ok = true; tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: Math.max(0, Math.min(8, (node.attrs.indent || 0) + d)) }); }
            });
            if (ok && dispatch) dispatch(tr);
            return ok;
        };
        return { indent: s(1), outdent: s(-1) };
    }
});

export const LineHeight = Extension.create({
    name: "lineHeight",
    addGlobalAttributes() { return [{ types: ["paragraph", "heading", "listItem"], attributes: { lineHeight: { default: null, parseHTML: (el) => el.style.lineHeight || null, renderHTML: (a) => a.lineHeight ? { style: `line-height: ${a.lineHeight}` } : {} } } }]; },
    addCommands(): any { return { setLineHeight: (lh: string | number) => ({ commands }: any) => ["paragraph", "heading", "listItem"].some((t) => commands.updateAttributes(t, { lineHeight: lh })) }; }
});

export interface DocsieEditorOptions {
    element?: HTMLElement; content?: string | Record<string, any>; ydoc?: Y.Doc; provider?: any; user?: UserProfile; role?: UserRole; editable?: boolean;
    onUpdate?: (p: any) => void; onSelectionUpdate?: (p: any) => void;
}

export class DocsieEditor {
    instance: Editor | null = $state(null);
    isReady = $state(false);
    isEditable = $state(true);
    wordCount = $state(0);
    charCount = $state(0);
    constructor(private opts: DocsieEditorOptions = {}) { this.isEditable = opts.editable ?? (opts.role ? ["owner", "editor"].includes(opts.role) : true); }

    mount(element: HTMLElement, options?: DocsieEditorOptions): Editor {
        if (options) this.opts = { ...this.opts, ...options };
        if (this.instance) this.destroy();
        const ext = [
            StarterKit.configure({ history: this.opts.ydoc ? false : undefined }), Underline, TextStyle, Color, Highlight.configure({ multicolor: true }),
            FontFamily, TextAlign.configure({ types: ["heading", "paragraph"] }), Link.configure({ openOnClick: false }), Image.configure({ inline: true, allowBase64: true }),
            Table.configure({ resizable: true }), TableRow, TableHeader, TableCell, TaskList, TaskItem.configure({ nested: true }), FontSize, Indent, LineHeight
        ];
        if (this.opts.ydoc) {
            ext.push(Collaboration.configure({ document: this.opts.ydoc }));
            if (this.opts.provider?.awareness) ext.push(CollaborationCursor.configure({ provider: this.opts.provider, user: { name: this.opts.user?.name || "Collaborator", color: this.opts.user?.color || "#1a73e8" } }));
        }
        this.instance = new Editor({
            element, extensions: ext, content: this.opts.ydoc ? undefined : (this.opts.content || "<p></p>"), editable: this.isEditable,
            editorProps: { attributes: { class: "focus:outline-none min-h-[900px] w-full", spellcheck: "true" } },
            onUpdate: (p) => { this.stats(); this.opts.onUpdate?.(p); },
            onSelectionUpdate: (p: any) => { this.opts.onSelectionUpdate?.(p); },
            onCreate: () => { this.isReady = true; this.stats(); }
        });
        return this.instance;
    }
    setRole(r: UserRole) { this.isEditable = ["owner", "editor"].includes(r); this.instance?.setEditable(this.isEditable); }
    private stats() { const t = this.instance?.getText() || ""; this.wordCount = t.trim() ? t.trim().split(/\s+/).filter(Boolean).length : 0; this.charCount = t.length; }
    destroy() { if (this.instance) { this.instance.destroy(); this.instance = null; this.isReady = false; } }
}
