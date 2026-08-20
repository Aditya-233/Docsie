"use client";

import { useEffect, useRef, useState } from "react";
import {
  Save, Printer, Download, FileText, Undo2, Redo2, Search,
  Copy, Scissors, Clipboard, Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  ZoomIn, ZoomOut, List, ListOrdered, Link2, Table,
  Minus, Keyboard, HelpCircle, MessageSquare, History, 
} from "lucide-react";

type MenuId = "File" | "Edit" | "View" | "Insert" | "Format" | "Tools" | "Help";

interface MenuItem {
  label: string;
  shortcut?: string;
  icon?: React.ReactNode;
  action?: () => void;
  disabled?: boolean;
}

interface DocMenuBarProps {
  onSave: () => void;
  onToggleSidebar: (which: "outline" | "comments" | "history") => void;
  editorInstance?: any;
}

function Divider() {
  return <div className="my-1 border-t border-gray-100" />;
}

function MenuRow({ item, closeMenu }: { item: MenuItem; closeMenu: () => void }) {
  return (
    <button
      type="button"
      disabled={item.disabled}
      onClick={() => { item.action?.(); closeMenu(); }}
      className="w-full flex items-center gap-3 px-3 py-1.5 text-[13px] text-gray-800 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-40 rounded transition-colors cursor-pointer text-left"
    >
      {item.icon && <span className="w-4 h-4 text-gray-500 flex items-center justify-center shrink-0">{item.icon}</span>}
      <span className="flex-1">{item.label}</span>
      {item.shortcut && <span className="text-[11px] text-gray-400 ml-4 shrink-0">{item.shortcut}</span>}
    </button>
  );
}

export function DocMenuBar({ onSave, onToggleSidebar, editorInstance }: DocMenuBarProps) {
  const [open, setOpen] = useState<MenuId | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const close = () => setOpen(null);
  const ed = editorInstance;

  const menus: { id: MenuId; items: (MenuItem | "sep")[] }[] = [
    {
      id: "File",
      items: [
        { label: "Save", shortcut: "Ctrl+S", icon: <Save className="w-3.5 h-3.5" />, action: onSave },
        "sep",
        { label: "Print", shortcut: "Ctrl+P", icon: <Printer className="w-3.5 h-3.5" />, action: () => window.print() },
        "sep",
        {
          label: "Download as .txt", icon: <Download className="w-3.5 h-3.5" />, action: () => {
            if (!ed) return;
            const blob = new Blob([ed.getText()], { type: "text/plain" });
            const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "document.txt" });
            a.click(); URL.revokeObjectURL(a.href);
          },
        },
        {
          label: "Download as .html", icon: <FileText className="w-3.5 h-3.5" />, action: () => {
            if (!ed) return;
            const blob = new Blob([ed.getHTML()], { type: "text/html" });
            const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "document.html" });
            a.click(); URL.revokeObjectURL(a.href);
          },
        },
      ],
    },
    {
      id: "Edit",
      items: [
        { label: "Undo", shortcut: "Ctrl+Z", icon: <Undo2 className="w-3.5 h-3.5" />, action: () => ed?.commands.undo() },
        { label: "Redo", shortcut: "Ctrl+Y", icon: <Redo2 className="w-3.5 h-3.5" />, action: () => ed?.commands.redo() },
        "sep",
        { label: "Cut", shortcut: "Ctrl+X", icon: <Scissors className="w-3.5 h-3.5" />, action: () => document.execCommand("cut") },
        { label: "Copy", shortcut: "Ctrl+C", icon: <Copy className="w-3.5 h-3.5" />, action: () => document.execCommand("copy") },
        { label: "Paste", shortcut: "Ctrl+V", icon: <Clipboard className="w-3.5 h-3.5" />, action: () => document.execCommand("paste") },
        "sep",
        { label: "Find & replace", shortcut: "Ctrl+H", icon: <Search className="w-3.5 h-3.5" />, action: () => ed?.commands.focus() },
      ],
    },
    {
      id: "View",
      items: [
        { label: "Zoom in", shortcut: "Ctrl++", icon: <ZoomIn className="w-3.5 h-3.5" /> },
        { label: "Zoom out", shortcut: "Ctrl+-", icon: <ZoomOut className="w-3.5 h-3.5" /> },
        "sep",
        { label: "Document outline", icon: <List className="w-3.5 h-3.5" />, action: () => onToggleSidebar("outline") },
        { label: "Comments", icon: <MessageSquare className="w-3.5 h-3.5" />, action: () => onToggleSidebar("comments") },
        { label: "Version history", icon: <History className="w-3.5 h-3.5" />, action: () => onToggleSidebar("history") },
      ],
    },
    {
      id: "Insert",
      items: [
        {
          label: "Link", shortcut: "Ctrl+K", icon: <Link2 className="w-3.5 h-3.5" />, action: () => {
            const url = window.prompt("Enter URL");
            if (url) ed?.chain().focus().setLink({ href: url }).run();
          },
        },
        {
          label: "Table", icon: <Table className="w-3.5 h-3.5" />,
          action: () => ed?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
        },
        { label: "Horizontal rule", icon: <Minus className="w-3.5 h-3.5" />, action: () => ed?.chain().focus().setHorizontalRule().run() },
        { label: "Ordered list", icon: <ListOrdered className="w-3.5 h-3.5" />, action: () => ed?.chain().focus().toggleOrderedList().run() },
        { label: "Bullet list", icon: <List className="w-3.5 h-3.5" />, action: () => ed?.chain().focus().toggleBulletList().run() },
      ],
    },
    {
      id: "Format",
      items: [
        { label: "Bold", shortcut: "Ctrl+B", icon: <Bold className="w-3.5 h-3.5" />, action: () => ed?.chain().focus().toggleBold().run() },
        { label: "Italic", shortcut: "Ctrl+I", icon: <Italic className="w-3.5 h-3.5" />, action: () => ed?.chain().focus().toggleItalic().run() },
        { label: "Underline", shortcut: "Ctrl+U", icon: <Underline className="w-3.5 h-3.5" />, action: () => ed?.chain().focus().toggleUnderline().run() },
        "sep",
        { label: "Align left", icon: <AlignLeft className="w-3.5 h-3.5" />, action: () => ed?.chain().focus().setTextAlign("left").run() },
        { label: "Align center", icon: <AlignCenter className="w-3.5 h-3.5" />, action: () => ed?.chain().focus().setTextAlign("center").run() },
        { label: "Align right", icon: <AlignRight className="w-3.5 h-3.5" />, action: () => ed?.chain().focus().setTextAlign("right").run() },
        { label: "Justify", icon: <AlignJustify className="w-3.5 h-3.5" />, action: () => ed?.chain().focus().setTextAlign("justify").run() },
      ],
    },
    {
      id: "Tools",
      items: [
        {
          label: "Word count", icon: <FileText className="w-3.5 h-3.5" />, action: () => {
            if (ed) alert(`Word count: ${ed.getText().trim().split(/\s+/).filter(Boolean).length}`);
          },
        },
        { label: "Keyboard shortcuts", icon: <Keyboard className="w-3.5 h-3.5" /> },
      ],
    },
    {
      id: "Help",
      items: [
        { label: "Keyboard shortcuts", shortcut: "Ctrl+/", icon: <HelpCircle className="w-3.5 h-3.5" /> },
      ],
    },
  ];

  return (
    <div ref={barRef} className="flex items-center gap-0.5">
      {menus.map((menu) => (
        <div key={menu.id} className="relative">
          <button
            type="button"
            onClick={() => setOpen((p) => (p === menu.id ? null : menu.id))}
            className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
              open === menu.id
                ? "bg-blue-100 text-blue-700 font-medium"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800"
            }`}
          >
            {menu.id}
          </button>
          {open === menu.id && (
            <div className="absolute top-full left-0 mt-0.5 z-50 bg-white border border-gray-200 rounded-lg shadow-xl py-1.5 min-w-[210px]">
              {menu.items.map((item, i) =>
                item === "sep" ? <Divider key={i} /> : <MenuRow key={i} item={item} closeMenu={close} />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
