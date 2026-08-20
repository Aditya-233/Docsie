"use client";

import { useEffect, useState, useMemo } from "react";
import {
  List,
  X,
  FileText,
  Clock,
  ChevronRight,
  Hash
} from "lucide-react";
import type { Editor } from "@tiptap/react";

export interface HeadingItem {
  id: string;
  level: number;
  text: string;
  pos: number;
}

export interface OutlineSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  editor?: Editor | null;
  headings?: HeadingItem[];
}

export function OutlineSidebar({
  isOpen,
  onClose,
  editor,
  headings: propHeadings,
}: OutlineSidebarProps) {
  const [extractedHeadings, setExtractedHeadings] = useState<HeadingItem[]>([]);
  const [activePos, setActivePos] = useState<number | null>(null);
  const [stats, setStats] = useState({
    words: 0,
    characters: 0,
    charactersExcludingSpaces: 0,
    paragraphs: 0,
    readingTimeMinutes: 1,
  });

  // Extract headings and stats from Tiptap editor
  useEffect(() => {
    if (!editor) return;

    const extractData = () => {
      const { doc } = editor.state;
      const headingsList: HeadingItem[] = [];
      let paragraphCount = 0;

      doc.descendants((node, pos) => {
        if (node.type.name === "heading") {
          const text = node.textContent.trim();
          if (text) {
            headingsList.push({
              id: `heading-${pos}`,
              level: node.attrs.level || 1,
              text,
              pos,
            });
          }
        } else if (node.type.name === "paragraph" && node.textContent.trim()) {
          paragraphCount++;
        }
      });

      setExtractedHeadings(headingsList);

      const fullText = doc.textContent || "";
      const trimmedText = fullText.trim();
      const words = trimmedText ? trimmedText.split(/\s+/).filter(Boolean).length : 0;
      const characters = fullText.length;
      const charactersExcludingSpaces = fullText.replace(/\s/g, "").length;
      const readingTimeMinutes = Math.max(1, Math.ceil(words / 200));

      setStats({
        words,
        characters,
        charactersExcludingSpaces,
        paragraphs: paragraphCount,
        readingTimeMinutes,
      });

      const currentCursor = editor.state.selection.from;
      setActivePos(currentCursor);
    };

    extractData();

    editor.on("update", extractData);
    editor.on("selectionUpdate", extractData);

    return () => {
      editor.off("update", extractData);
      editor.off("selectionUpdate", extractData);
    };
  }, [editor]);

  const headings = useMemo(() => {
    return propHeadings && propHeadings.length > 0 ? propHeadings : extractedHeadings;
  }, [propHeadings, extractedHeadings]);

  const handleHeadingClick = (heading: HeadingItem) => {
    if (!editor) return;

    try {
      editor.chain().focus().setTextSelection(heading.pos + 1).scrollIntoView().run();

      // Also attempt DOM smooth scroll if available
      const editorDom = editor.view.dom;
      const headingElements = editorDom.querySelectorAll("h1, h2, h3, h4, h5, h6");
      for (let i = 0; i < headingElements.length; i++) {
        const el = headingElements[i] as HTMLElement;
        if (el.textContent?.trim() === heading.text) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          break;
        }
      }
    } catch (e) {
      console.error("Failed to scroll to heading:", e);
    }
  };

  if (!isOpen) return null;

  return (
    <aside
      className="w-72 md:w-80 bg-white border-l border-gray-200 h-full flex flex-col shadow-lg z-30 transition-all duration-200 animate-in slide-in-from-right"
      aria-label="Document Outline and Statistics"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <List className="w-5 h-5 text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-900">Document Outline</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          title="Close outline"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Headings Navigation Tree */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2 px-1">
          Headings ({headings.length})
        </div>

        {headings.length === 0 ? (
          <div className="py-8 text-center text-gray-400 flex flex-col items-center justify-center space-y-2">
            <Hash className="w-7 h-7 text-gray-300 stroke-1" />
            <p className="text-xs font-medium text-gray-500">No headings in document</p>
            <p className="text-[11px] text-gray-400 max-w-[180px]">
              Apply Heading 1, 2, or 3 styles to create an automatic outline table of contents.
            </p>
          </div>
        ) : (
          headings.map((h) => {
            const isSelected = activePos !== null && Math.abs(activePos - h.pos) < 50;

            const paddingLeft =
              h.level === 1 ? "pl-2" : h.level === 2 ? "pl-6" : h.level === 3 ? "pl-10" : "pl-12";

            const fontSize =
              h.level === 1
                ? "text-xs font-semibold text-gray-900"
                : h.level === 2
                ? "text-xs font-medium text-gray-700"
                : "text-[11px] font-normal text-gray-600";

            return (
              <button
                key={h.id}
                type="button"
                onClick={() => handleHeadingClick(h)}
                className={`w-full text-left py-1.5 pr-2 rounded-md transition-colors flex items-center gap-1.5 group cursor-pointer ${paddingLeft} ${
                  isSelected
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <ChevronRight className={`w-3 h-3 text-gray-400 group-hover:text-blue-600 shrink-0 transition-transform ${isSelected ? "rotate-90 text-blue-600" : ""}`} />
                <span className={`truncate ${fontSize}`}>{h.text}</span>
              </button>
            );
          })
        )}
      </div>

      {/* Live Statistics Section */}
      <div className="p-4 border-t border-gray-100 bg-gray-50/70 space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
          <FileText className="w-4 h-4 text-gray-500" />
          <span>Live Document Stats</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-white p-2.5 rounded-lg border border-gray-200/80 shadow-2xs">
            <div className="text-gray-400 text-[11px]">Words</div>
            <div className="text-sm font-bold text-gray-900">{stats.words.toLocaleString()}</div>
          </div>
          <div className="bg-white p-2.5 rounded-lg border border-gray-200/80 shadow-2xs">
            <div className="text-gray-400 text-[11px]">Characters</div>
            <div className="text-sm font-bold text-gray-900">
              {stats.characters.toLocaleString()}
            </div>
          </div>
          <div className="bg-white p-2.5 rounded-lg border border-gray-200/80 shadow-2xs">
            <div className="text-gray-400 text-[11px]">Paragraphs</div>
            <div className="text-sm font-bold text-gray-900">{stats.paragraphs}</div>
          </div>
          <div className="bg-white p-2.5 rounded-lg border border-gray-200/80 shadow-2xs">
            <div className="flex items-center gap-1 text-gray-400 text-[11px]">
              <Clock className="w-3 h-3" />
              <span>Read Time</span>
            </div>
            <div className="text-sm font-bold text-gray-900">{stats.readingTimeMinutes} min</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
