"use client";

import "@/lib/editor/types";
import { useState, useRef, useEffect } from "react";
import type { Editor } from "@tiptap/react";
import {
  Undo2,
  Redo2,
  Printer,
  Paintbrush,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Baseline,
  Highlighter,
  Link2,
  Unlink,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  ListTodo,
  Indent as IndentIcon,
  Outdent as OutdentIcon,
  Table as TableIcon,
  RemoveFormatting,
  ChevronDown,
  Plus,
  Minus,
  Check,
  Upload,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FONT_FAMILIES,
  FONT_SIZES,
  HEADING_STYLES,
  LINE_HEIGHTS,
  GOOGLE_COLORS,
  HIGHLIGHT_COLORS,
} from "@/lib/editor/constants";

export interface ToolbarProps {
  editor: Editor | null;
  readOnly?: boolean;
  className?: string;
}

interface StoredFormat {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  fontFamily?: string;
  fontSize?: string;
  color?: string;
  highlight?: string;
  textAlign?: string;
}

export function Toolbar({ editor, readOnly = false, className }: ToolbarProps) {
  // Dropdown states
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Format Painter state machine
  const [painterActive, setPainterActive] = useState(false);
  const [painterSticky, setPainterSticky] = useState(false);
  const [storedFormat, setStoredFormat] = useState<StoredFormat | null>(null);

  // Modals / Dialogs
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");

  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [customColor, setCustomColor] = useState("#000000");

  // Table grid hover matrix
  const [tableGridHover, setTableGridHover] = useState({ rows: 0, cols: 0 });

  // References for outside click dismissal
  const toolbarRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    };
    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Format Painter: Capture or Apply formatting
  const handleFormatPainterClick = (isDoubleClick = false) => {
    if (!editor || readOnly) return;

    if (painterActive && !isDoubleClick) {
      // Deactivate
      setPainterActive(false);
      setPainterSticky(false);
      setStoredFormat(null);
      return;
    }

    // Capture formatting from current selection
    const marks = editor.getAttributes("textStyle");
    const format: StoredFormat = {
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      underline: editor.isActive("underline"),
      strike: editor.isActive("strike"),
      fontFamily: marks.fontFamily,
      fontSize: marks.fontSize,
      color: marks.color,
      highlight: editor.getAttributes("highlight").color,
      textAlign: editor.isActive({ textAlign: "center" })
        ? "center"
        : editor.isActive({ textAlign: "right" })
        ? "right"
        : editor.isActive({ textAlign: "justify" })
        ? "justify"
        : "left",
    };

    setStoredFormat(format);
    setPainterActive(true);
    setPainterSticky(isDoubleClick);
  };

  // Apply format painter when selection changes in editor
  useEffect(() => {
    if (!editor || !painterActive || !storedFormat) return;

    const handleSelectionUpdate = () => {
      const { from, to } = editor.state.selection;
      if (from === to) return; // Only apply if text is selected

      let chain = editor.chain().focus();

      // Apply bold
      if (storedFormat.bold) chain = chain.setBold();
      else chain = chain.unsetBold();

      // Apply italic
      if (storedFormat.italic) chain = chain.setItalic();
      else chain = chain.unsetItalic();

      // Apply underline
      if (storedFormat.underline) chain = chain.setUnderline();
      else chain = chain.unsetUnderline();

      // Apply strike
      if (storedFormat.strike) chain = chain.setStrike();
      else chain = chain.unsetStrike();

      // Apply font family
      if (storedFormat.fontFamily) chain = chain.setFontFamily(storedFormat.fontFamily);
      else chain = chain.unsetFontFamily();

      // Apply font size
      if (storedFormat.fontSize) chain = chain.setFontSize(storedFormat.fontSize);
      else chain = chain.unsetFontSize();

      // Apply text color
      if (storedFormat.color) chain = chain.setColor(storedFormat.color);
      else chain = chain.unsetColor();

      // Apply highlight
      if (storedFormat.highlight) chain = chain.setHighlight({ color: storedFormat.highlight });
      else chain = chain.unsetHighlight();

      // Apply text align
      if (storedFormat.textAlign) chain = chain.setTextAlign(storedFormat.textAlign);

      chain.run();

      if (!painterSticky) {
        setPainterActive(false);
        setStoredFormat(null);
      }
    };

    editor.on("selectionUpdate", handleSelectionUpdate);
    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate);
    };
  }, [editor, painterActive, painterSticky, storedFormat]);

  if (!editor) {
    return (
      <div className="h-10 w-full bg-[#edf2fa] border-b border-[#dadce0] animate-pulse select-none" />
    );
  }

  // Active state helpers
  const currentFontFamily =
    editor.getAttributes("textStyle").fontFamily?.split(",")[0]?.replace(/['"]/g, "") || "Arial";
  const currentFontSize =
    editor.getAttributes("textStyle").fontSize || "11pt";
  const currentFontSizeNum = parseInt(currentFontSize, 10) || 11;

  // Active heading label
  let currentHeadingLabel = "Normal text";
  if (editor.isActive("heading", { level: 1 })) {
    currentHeadingLabel = "Heading 1";
  } else if (editor.isActive("heading", { level: 2 })) {
    currentHeadingLabel = "Heading 2";
  } else if (editor.isActive("heading", { level: 3 })) {
    currentHeadingLabel = "Heading 3";
  }

  // Font Size modification
  const changeFontSize = (delta: number) => {
    const nextSize = Math.max(6, Math.min(96, currentFontSizeNum + delta));
    editor.chain().focus().setFontSize(`${nextSize}pt`).run();
  };

  const setExplicitFontSize = (sizeStr: string) => {
    const formatted = sizeStr.endsWith("pt") ? sizeStr : `${sizeStr}pt`;
    editor.chain().focus().setFontSize(formatted).run();
    setActiveDropdown(null);
  };

  // Heading selection
  const handleHeadingSelect = (option: (typeof HEADING_STYLES)[0]) => {
    if (option.level) {
      editor.chain().focus().setHeading({ level: option.level }).run();
    } else {
      editor.chain().focus().setParagraph().run();
    }
    setActiveDropdown(null);
  };

  // Link Insertion
  const openLinkDialog = () => {
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, " ");
    const previousUrl = editor.getAttributes("link").href || "";

    setLinkText(selectedText);
    setLinkUrl(previousUrl);
    setLinkDialogOpen(true);
  };

  const applyLink = () => {
    if (!linkUrl.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      const href = linkUrl.startsWith("http://") || linkUrl.startsWith("https://") || linkUrl.startsWith("mailto:")
        ? linkUrl
        : `https://${linkUrl}`;

      if (linkText && editor.state.selection.empty) {
        editor.chain().focus().insertContent(`<a href="${href}">${linkText}</a>`).run();
      } else {
        editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
      }
    }
    setLinkDialogOpen(false);
  };

  // Image Upload / URL
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      editor.chain().focus().setImage({ src: base64, alt: file.name }).run();
      setImageDialogOpen(false);
    };
    reader.readAsDataURL(file);
  };

  const applyImageUrl = () => {
    if (imageUrl.trim()) {
      editor.chain().focus().setImage({ src: imageUrl.trim() }).run();
      setImageUrl("");
      setImageDialogOpen(false);
    }
  };

  // Table Matrix Picker (up to 10x10)
  const insertTable = (rows: number, cols: number) => {
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
    setActiveDropdown(null);
    setTableGridHover({ rows: 0, cols: 0 });
  };

  const isInsideTable = editor.isActive("table");

  return (
    <div
      ref={toolbarRef}
      className={cn(
        "docs-toolbar sticky top-0 z-40 flex items-center flex-wrap gap-0.5 px-3 py-1 bg-[#edf2fa] border-b border-[#dadce0] select-none text-[#444746] no-print text-sm shadow-xs",
        readOnly && "opacity-75 pointer-events-none",
        className
      )}
    >
      {/* Undo */}
      <button
        type="button"
        title="Undo (Ctrl+Z)"
        disabled={readOnly || !editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
        className="p-1.5 rounded-full hover:bg-[#dfe3e7] active:bg-[#d3d7db] disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
      >
        <Undo2 className="w-4 h-4 text-[#444746]" />
      </button>

      {/* Redo */}
      <button
        type="button"
        title="Redo (Ctrl+Y)"
        disabled={readOnly || !editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
        className="p-1.5 rounded-full hover:bg-[#dfe3e7] active:bg-[#d3d7db] disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
      >
        <Redo2 className="w-4 h-4 text-[#444746]" />
      </button>

      {/* Print */}
      <button
        type="button"
        title="Print (Ctrl+P)"
        onClick={() => window.print()}
        className="p-1.5 rounded-full hover:bg-[#dfe3e7] active:bg-[#d3d7db] transition-colors cursor-pointer"
      >
        <Printer className="w-4 h-4 text-[#444746]" />
      </button>

      {/* Format Painter */}
      <button
        type="button"
        title={
          painterActive
            ? painterSticky
              ? "Format Painter (Persistent) - Click to deactivate"
              : "Format Painter active - Click to deactivate"
            : "Paint format (Double-click for persistent)"
        }
        onClick={() => handleFormatPainterClick(false)}
        onDoubleClick={() => handleFormatPainterClick(true)}
        className={cn(
          "p-1.5 rounded-full transition-colors cursor-pointer",
          painterActive
            ? "bg-[#d3e3fd] text-[#041e49] ring-1 ring-[#0b57d0]"
            : "hover:bg-[#dfe3e7] active:bg-[#d3d7db]"
        )}
      >
        <Paintbrush className="w-4 h-4 text-inherit" />
      </button>

      <div className="h-5 w-[1px] bg-[#c4c7c5] mx-1" />

      {/* Style / Heading Dropdown */}
      <div className="relative">
        <button
          type="button"
          title="Styles"
          onClick={() =>
            setActiveDropdown(activeDropdown === "heading" ? null : "heading")
          }
          className="flex items-center gap-1.5 px-2 py-1 h-7 rounded hover:bg-[#dfe3e7] transition-colors text-xs font-medium text-[#1f1f1f] cursor-pointer"
        >
          <span className="truncate max-w-[90px]">{currentHeadingLabel}</span>
          <ChevronDown className="w-3.5 h-3.5 text-[#5f6368]" />
        </button>

        {activeDropdown === "heading" && (
          <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-[#dadce0] py-1.5 z-50 animate-in fade-in">
            {HEADING_STYLES.map((style) => {
              const isSelected =
                (style.level && editor.isActive("heading", { level: style.level })) ||
                (!style.level && editor.isActive("paragraph"));

              return (
                <button
                  key={style.label}
                  type="button"
                  onClick={() => handleHeadingSelect(style)}
                  className={cn(
                    "w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-[#f1f3f4] cursor-pointer",
                    isSelected && "bg-[#e8f0fe] text-[#1a73e8]"
                  )}
                >
                  <span style={{ fontSize: style.fontSize, fontWeight: style.fontWeight }}>
                    {style.label}
                  </span>
                  {isSelected && <Check className="w-4 h-4 text-[#1a73e8]" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="h-5 w-[1px] bg-[#c4c7c5] mx-1" />

      {/* Font Family Dropdown */}
      <div className="relative">
        <button
          type="button"
          title="Font"
          onClick={() =>
            setActiveDropdown(activeDropdown === "fontFamily" ? null : "fontFamily")
          }
          className="flex items-center gap-1.5 px-2 py-1 h-7 rounded hover:bg-[#dfe3e7] transition-colors text-xs font-medium text-[#1f1f1f] cursor-pointer"
        >
          <span className="truncate max-w-[100px]">{currentFontFamily}</span>
          <ChevronDown className="w-3.5 h-3.5 text-[#5f6368]" />
        </button>

        {activeDropdown === "fontFamily" && (
          <div className="absolute left-0 top-full mt-1 w-52 max-h-72 overflow-y-auto bg-white rounded-lg shadow-xl border border-[#dadce0] py-1.5 z-50 animate-in fade-in">
            {FONT_FAMILIES.map((font) => {
              const isSelected = currentFontFamily.toLowerCase() === font.label.toLowerCase();
              return (
                <button
                  key={font.label}
                  type="button"
                  onClick={() => {
                    editor.chain().focus().setFontFamily(font.value).run();
                    setActiveDropdown(null);
                  }}
                  className={cn(
                    "w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-[#f1f3f4] text-xs cursor-pointer",
                    isSelected && "bg-[#e8f0fe] text-[#1a73e8]"
                  )}
                  style={{ fontFamily: font.value }}
                >
                  <span>{font.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#1a73e8]" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="h-5 w-[1px] bg-[#c4c7c5] mx-1" />

      {/* Font Size Selector (- / Input / +) */}
      <div className="flex items-center">
        <button
          type="button"
          title="Decrease font size"
          onClick={() => changeFontSize(-1)}
          className="p-1 rounded-l hover:bg-[#dfe3e7] active:bg-[#d3d7db] transition-colors cursor-pointer"
        >
          <Minus className="w-3.5 h-3.5 text-[#444746]" />
        </button>

        <div className="relative">
          <button
            type="button"
            title="Font size"
            onClick={() =>
              setActiveDropdown(activeDropdown === "fontSize" ? null : "fontSize")
            }
            className="w-10 h-7 text-center font-medium text-xs bg-white border border-[#dadce0] rounded-none hover:bg-neutral-50 flex items-center justify-center cursor-pointer"
          >
            {currentFontSizeNum}
          </button>

          {activeDropdown === "fontSize" && (
            <div className="absolute left-0 top-full mt-1 w-20 max-h-64 overflow-y-auto bg-white rounded-lg shadow-xl border border-[#dadce0] py-1 z-50 animate-in fade-in">
              {FONT_SIZES.map((size) => {
                const sizeNum = parseInt(size, 10);
                const isSelected = sizeNum === currentFontSizeNum;
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setExplicitFontSize(size)}
                    className={cn(
                      "w-full px-3 py-1 text-center text-xs hover:bg-[#f1f3f4] cursor-pointer",
                      isSelected && "bg-[#e8f0fe] text-[#1a73e8] font-bold"
                    )}
                  >
                    {sizeNum}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          type="button"
          title="Increase font size"
          onClick={() => changeFontSize(1)}
          className="p-1 rounded-r hover:bg-[#dfe3e7] active:bg-[#d3d7db] transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-[#444746]" />
        </button>
      </div>

      <div className="h-5 w-[1px] bg-[#c4c7c5] mx-1" />

      {/* Bold */}
      <button
        type="button"
        title="Bold (Ctrl+B)"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={cn(
          "p-1.5 rounded hover:bg-[#dfe3e7] active:bg-[#d3d7db] transition-colors cursor-pointer",
          editor.isActive("bold") && "bg-[#d3e3fd] text-[#041e49]"
        )}
      >
        <Bold className="w-4 h-4 text-inherit" />
      </button>

      {/* Italic */}
      <button
        type="button"
        title="Italic (Ctrl+I)"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={cn(
          "p-1.5 rounded hover:bg-[#dfe3e7] active:bg-[#d3d7db] transition-colors cursor-pointer",
          editor.isActive("italic") && "bg-[#d3e3fd] text-[#041e49]"
        )}
      >
        <Italic className="w-4 h-4 text-inherit" />
      </button>

      {/* Underline */}
      <button
        type="button"
        title="Underline (Ctrl+U)"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={cn(
          "p-1.5 rounded hover:bg-[#dfe3e7] active:bg-[#d3d7db] transition-colors cursor-pointer",
          editor.isActive("underline") && "bg-[#d3e3fd] text-[#041e49]"
        )}
      >
        <UnderlineIcon className="w-4 h-4 text-inherit" />
      </button>

      {/* Strike */}
      <button
        type="button"
        title="Strikethrough (Alt+Shift+5)"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={cn(
          "p-1.5 rounded hover:bg-[#dfe3e7] active:bg-[#d3d7db] transition-colors cursor-pointer",
          editor.isActive("strike") && "bg-[#d3e3fd] text-[#041e49]"
        )}
      >
        <Strikethrough className="w-4 h-4 text-inherit" />
      </button>

      {/* Text Color Picker */}
      <div className="relative">
        <button
          type="button"
          title="Text color"
          onClick={() =>
            setActiveDropdown(activeDropdown === "textColor" ? null : "textColor")
          }
          className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#dfe3e7] active:bg-[#d3d7db] transition-colors cursor-pointer"
        >
          <Baseline className="w-4 h-4 text-[#444746]" />
          <div
            className="w-4 h-0.5 rounded-full mt-0.5"
            style={{
              backgroundColor: editor.getAttributes("textStyle").color || "#000000",
            }}
          />
        </button>

        {activeDropdown === "textColor" && (
          <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-lg shadow-xl border border-[#dadce0] p-3 z-50 animate-in fade-in">
            <div className="text-xs font-semibold text-[#5f6368] mb-2">CUSTOM / HEX</div>
            <div className="flex items-center gap-2 mb-3">
              <input
                type="color"
                value={customColor}
                onChange={(e) => {
                  setCustomColor(e.target.value);
                  editor.chain().focus().setColor(e.target.value).run();
                }}
                className="w-7 h-7 rounded border border-neutral-300 cursor-pointer p-0"
              />
              <input
                type="text"
                value={customColor}
                onChange={(e) => {
                  setCustomColor(e.target.value);
                  if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                    editor.chain().focus().setColor(e.target.value).run();
                  }
                }}
                placeholder="#000000"
                className="text-xs px-2 py-1 border border-neutral-300 rounded w-24 font-mono"
              />
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().unsetColor().run();
                  setActiveDropdown(null);
                }}
                className="text-xs text-neutral-600 hover:text-neutral-900 ml-auto underline cursor-pointer"
              >
                Reset
              </button>
            </div>

            <div className="text-xs font-semibold text-[#5f6368] mb-2">PALETTE</div>
            <div className="grid grid-cols-10 gap-1">
              {GOOGLE_COLORS.map((hex, idx) => (
                <button
                  key={`${hex}-${idx}`}
                  type="button"
                  title={hex}
                  onClick={() => {
                    editor.chain().focus().setColor(hex).run();
                    setActiveDropdown(null);
                  }}
                  className="w-5 h-5 rounded-sm border border-neutral-300/80 hover:scale-125 transition-transform cursor-pointer"
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Highlight Color Picker */}
      <div className="relative">
        <button
          type="button"
          title="Highlight color"
          onClick={() =>
            setActiveDropdown(activeDropdown === "highlightColor" ? null : "highlightColor")
          }
          className="flex flex-col items-center justify-center p-1.5 rounded hover:bg-[#dfe3e7] active:bg-[#d3d7db] transition-colors cursor-pointer"
        >
          <Highlighter className="w-4 h-4 text-[#444746]" />
          <div
            className="w-4 h-0.5 rounded-full mt-0.5"
            style={{
              backgroundColor:
                editor.getAttributes("highlight").color || "transparent",
            }}
          />
        </button>

        {activeDropdown === "highlightColor" && (
          <div className="absolute left-0 top-full mt-1 w-52 bg-white rounded-lg shadow-xl border border-[#dadce0] p-3 z-50 animate-in fade-in">
            <div className="text-xs font-semibold text-[#5f6368] mb-2">HIGHLIGHT</div>
            <div className="grid grid-cols-5 gap-1.5 mb-2">
              {HIGHLIGHT_COLORS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  title={item.label}
                  onClick={() => {
                    if (item.value) {
                      editor.chain().focus().setHighlight({ color: item.value }).run();
                    } else {
                      editor.chain().focus().unsetHighlight().run();
                    }
                    setActiveDropdown(null);
                  }}
                  className={cn(
                    "w-7 h-7 rounded border border-neutral-300 flex items-center justify-center text-[10px] hover:scale-110 transition-transform cursor-pointer",
                    !item.value && "bg-white text-neutral-400"
                  )}
                  style={{ backgroundColor: item.value || "#ffffff" }}
                >
                  {!item.value && <X className="w-3.5 h-3.5 text-neutral-400" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="h-5 w-[1px] bg-[#c4c7c5] mx-1" />

      {/* Link Insertion */}
      <button
        type="button"
        title="Insert link (Ctrl+K)"
        onClick={openLinkDialog}
        className={cn(
          "p-1.5 rounded hover:bg-[#dfe3e7] active:bg-[#d3d7db] transition-colors cursor-pointer",
          editor.isActive("link") && "bg-[#d3e3fd] text-[#041e49]"
        )}
      >
        <Link2 className="w-4 h-4 text-inherit" />
      </button>

      {/* Image Insertion */}
      <button
        type="button"
        title="Insert image"
        onClick={() => setImageDialogOpen(true)}
        className="p-1.5 rounded hover:bg-[#dfe3e7] active:bg-[#d3d7db] transition-colors cursor-pointer"
      >
        <ImageIcon className="w-4 h-4 text-[#444746]" />
      </button>

      <div className="h-5 w-[1px] bg-[#c4c7c5] mx-1" />

      {/* Text Alignment (Left, Center, Right, Justify) */}
      <div className="relative">
        <button
          type="button"
          title="Alignment"
          onClick={() =>
            setActiveDropdown(activeDropdown === "align" ? null : "align")
          }
          className="flex items-center gap-0.5 p-1.5 rounded hover:bg-[#dfe3e7] active:bg-[#d3d7db] transition-colors cursor-pointer"
        >
          {editor.isActive({ textAlign: "center" }) ? (
            <AlignCenter className="w-4 h-4 text-[#1a73e8]" />
          ) : editor.isActive({ textAlign: "right" }) ? (
            <AlignRight className="w-4 h-4 text-[#1a73e8]" />
          ) : editor.isActive({ textAlign: "justify" }) ? (
            <AlignJustify className="w-4 h-4 text-[#1a73e8]" />
          ) : (
            <AlignLeft className="w-4 h-4 text-[#444746]" />
          )}
          <ChevronDown className="w-3 h-3 text-[#5f6368]" />
        </button>

        {activeDropdown === "align" && (
          <div className="absolute left-0 top-full mt-1 flex items-center bg-white rounded-lg shadow-xl border border-[#dadce0] p-1 gap-1 z-50 animate-in fade-in">
            <button
              type="button"
              title="Align left (Ctrl+Shift+L)"
              onClick={() => {
                editor.chain().focus().setTextAlign("left").run();
                setActiveDropdown(null);
              }}
              className={cn(
                "p-1.5 rounded hover:bg-[#f1f3f4] cursor-pointer",
                editor.isActive({ textAlign: "left" }) && "bg-[#e8f0fe] text-[#1a73e8]"
              )}
            >
              <AlignLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="Align center (Ctrl+Shift+E)"
              onClick={() => {
                editor.chain().focus().setTextAlign("center").run();
                setActiveDropdown(null);
              }}
              className={cn(
                "p-1.5 rounded hover:bg-[#f1f3f4] cursor-pointer",
                editor.isActive({ textAlign: "center" }) && "bg-[#e8f0fe] text-[#1a73e8]"
              )}
            >
              <AlignCenter className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="Align right (Ctrl+Shift+R)"
              onClick={() => {
                editor.chain().focus().setTextAlign("right").run();
                setActiveDropdown(null);
              }}
              className={cn(
                "p-1.5 rounded hover:bg-[#f1f3f4] cursor-pointer",
                editor.isActive({ textAlign: "right" }) && "bg-[#e8f0fe] text-[#1a73e8]"
              )}
            >
              <AlignRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="Justify (Ctrl+Shift+J)"
              onClick={() => {
                editor.chain().focus().setTextAlign("justify").run();
                setActiveDropdown(null);
              }}
              className={cn(
                "p-1.5 rounded hover:bg-[#f1f3f4] cursor-pointer",
                editor.isActive({ textAlign: "justify" }) && "bg-[#e8f0fe] text-[#1a73e8]"
              )}
            >
              <AlignJustify className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Line Spacing */}
      <div className="relative">
        <button
          type="button"
          title="Line & paragraph spacing"
          onClick={() =>
            setActiveDropdown(activeDropdown === "lineHeight" ? null : "lineHeight")
          }
          className="flex items-center gap-0.5 p-1.5 rounded hover:bg-[#dfe3e7] active:bg-[#d3d7db] transition-colors cursor-pointer"
        >
          <div className="flex flex-col gap-[2px] items-center justify-center w-4 h-4">
            <div className="w-3.5 h-[1.5px] bg-[#444746]" />
            <div className="w-2.5 h-[1.5px] bg-[#444746]" />
            <div className="w-3.5 h-[1.5px] bg-[#444746]" />
          </div>
          <ChevronDown className="w-3 h-3 text-[#5f6368]" />
        </button>

        {activeDropdown === "lineHeight" && (
          <div className="absolute left-0 top-full mt-1 w-44 bg-white rounded-lg shadow-xl border border-[#dadce0] py-1.5 z-50 animate-in fade-in">
            {LINE_HEIGHTS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  editor.chain().focus().setLineHeight(item.value).run();
                  setActiveDropdown(null);
                }}
                className="w-full px-3 py-1.5 text-left text-xs hover:bg-[#f1f3f4] flex items-center justify-between cursor-pointer"
              >
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="h-5 w-[1px] bg-[#c4c7c5] mx-1" />

      {/* Bullet List */}
      <button
        type="button"
        title="Bulleted list (Ctrl+Shift+8)"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={cn(
          "p-1.5 rounded hover:bg-[#dfe3e7] active:bg-[#d3d7db] transition-colors cursor-pointer",
          editor.isActive("bulletList") && "bg-[#d3e3fd] text-[#041e49]"
        )}
      >
        <List className="w-4 h-4 text-inherit" />
      </button>

      {/* Numbered List */}
      <button
        type="button"
        title="Numbered list (Ctrl+Shift+7)"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={cn(
          "p-1.5 rounded hover:bg-[#dfe3e7] active:bg-[#d3d7db] transition-colors cursor-pointer",
          editor.isActive("orderedList") && "bg-[#d3e3fd] text-[#041e49]"
        )}
      >
        <ListOrdered className="w-4 h-4 text-inherit" />
      </button>

      {/* Checklist / Task List */}
      <button
        type="button"
        title="Checklist (Ctrl+Shift+9)"
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        className={cn(
          "p-1.5 rounded hover:bg-[#dfe3e7] active:bg-[#d3d7db] transition-colors cursor-pointer",
          editor.isActive("taskList") && "bg-[#d3e3fd] text-[#041e49]"
        )}
      >
        <ListTodo className="w-4 h-4 text-inherit" />
      </button>

      {/* Indent / Outdent */}
      <button
        type="button"
        title="Decrease indent"
        onClick={() => editor.chain().focus().outdent().run()}
        className="p-1.5 rounded hover:bg-[#dfe3e7] active:bg-[#d3d7db] transition-colors cursor-pointer"
      >
        <OutdentIcon className="w-4 h-4 text-[#444746]" />
      </button>

      <button
        type="button"
        title="Increase indent"
        onClick={() => editor.chain().focus().indent().run()}
        className="p-1.5 rounded hover:bg-[#dfe3e7] active:bg-[#d3d7db] transition-colors cursor-pointer"
      >
        <IndentIcon className="w-4 h-4 text-[#444746]" />
      </button>

      <div className="h-5 w-[1px] bg-[#c4c7c5] mx-1" />

      {/* Table Picker & Controls */}
      <div className="relative">
        <button
          type="button"
          title="Table"
          onClick={() =>
            setActiveDropdown(activeDropdown === "table" ? null : "table")
          }
          className={cn(
            "flex items-center gap-0.5 p-1.5 rounded hover:bg-[#dfe3e7] active:bg-[#d3d7db] transition-colors cursor-pointer",
            isInsideTable && "bg-[#d3e3fd] text-[#041e49]"
          )}
        >
          <TableIcon className="w-4 h-4 text-inherit" />
          <ChevronDown className="w-3 h-3 text-[#5f6368]" />
        </button>

        {activeDropdown === "table" && (
          <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-lg shadow-xl border border-[#dadce0] p-3 z-50 animate-in fade-in">
            {!isInsideTable ? (
              <div>
                <div className="text-xs font-semibold text-[#5f6368] mb-2 flex justify-between">
                  <span>INSERT TABLE</span>
                  <span className="font-mono text-[#1a73e8]">
                    {tableGridHover.rows > 0
                      ? `${tableGridHover.rows} × ${tableGridHover.cols}`
                      : "Hover grid"}
                  </span>
                </div>

                <div
                  className="grid grid-cols-10 gap-1 p-1 bg-neutral-50 rounded border border-neutral-200 cursor-pointer"
                  onMouseLeave={() => setTableGridHover({ rows: 0, cols: 0 })}
                >
                  {Array.from({ length: 10 }).map((_, r) =>
                    Array.from({ length: 10 }).map((_, c) => {
                      const rowNum = r + 1;
                      const colNum = c + 1;
                      const isHovered =
                        rowNum <= tableGridHover.rows && colNum <= tableGridHover.cols;

                      return (
                        <div
                          key={`${r}-${c}`}
                          onMouseEnter={() =>
                            setTableGridHover({ rows: rowNum, cols: colNum })
                          }
                          onClick={() => insertTable(rowNum, colNum)}
                          className={cn(
                            "w-4 h-4 border rounded-[1px] transition-colors",
                            isHovered
                              ? "bg-[#c2e7ff] border-[#004a77]"
                              : "bg-white border-[#dadce0]"
                          )}
                        />
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1 text-xs text-[#202124]">
                <div className="font-semibold text-[#5f6368] pb-1 border-b border-neutral-200 mb-1">
                  TABLE ACTIONS
                </div>
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().addRowBefore().run();
                    setActiveDropdown(null);
                  }}
                  className="px-2 py-1.5 text-left rounded hover:bg-[#f1f3f4] cursor-pointer"
                >
                  Insert row above
                </button>
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().addRowAfter().run();
                    setActiveDropdown(null);
                  }}
                  className="px-2 py-1.5 text-left rounded hover:bg-[#f1f3f4] cursor-pointer"
                >
                  Insert row below
                </button>
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().addColumnBefore().run();
                    setActiveDropdown(null);
                  }}
                  className="px-2 py-1.5 text-left rounded hover:bg-[#f1f3f4] cursor-pointer"
                >
                  Insert column left
                </button>
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().addColumnAfter().run();
                    setActiveDropdown(null);
                  }}
                  className="px-2 py-1.5 text-left rounded hover:bg-[#f1f3f4] cursor-pointer"
                >
                  Insert column right
                </button>
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().deleteRow().run();
                    setActiveDropdown(null);
                  }}
                  className="px-2 py-1.5 text-left rounded hover:bg-[#f1f3f4] text-red-600 cursor-pointer"
                >
                  Delete row
                </button>
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().deleteColumn().run();
                    setActiveDropdown(null);
                  }}
                  className="px-2 py-1.5 text-left rounded hover:bg-[#f1f3f4] text-red-600 cursor-pointer"
                >
                  Delete column
                </button>
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().mergeOrSplit().run();
                    setActiveDropdown(null);
                  }}
                  className="px-2 py-1.5 text-left rounded hover:bg-[#f1f3f4] cursor-pointer"
                >
                  Merge / Split cell
                </button>
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().deleteTable().run();
                    setActiveDropdown(null);
                  }}
                  className="px-2 py-1.5 text-left rounded hover:bg-red-50 text-red-700 font-medium flex items-center gap-1.5 cursor-pointer mt-1 border-t border-neutral-200 pt-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete table
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Clear Formatting */}
      <button
        type="button"
        title="Clear formatting (Ctrl+\)"
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        className="p-1.5 rounded hover:bg-[#dfe3e7] active:bg-[#d3d7db] transition-colors cursor-pointer ml-auto"
      >
        <RemoveFormatting className="w-4 h-4 text-[#444746]" />
      </button>

      {/* Hidden File Input for Image Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Link Dialog */}
      {linkDialogOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#dadce0] w-full max-w-md p-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-base text-[#1f1f1f]">Insert Link</h3>
              <button
                type="button"
                onClick={() => setLinkDialogOpen(false)}
                className="p-1 rounded hover:bg-[#f1f3f4] cursor-pointer"
              >
                <X className="w-4 h-4 text-neutral-500" />
              </button>
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-medium text-[#5f6368] mb-1">
                  Text
                </label>
                <input
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="Link text"
                  className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:border-[#1a73e8]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#5f6368] mb-1">
                  Link (URL)
                </label>
                <input
                  type="text"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:border-[#1a73e8]"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              {editor.isActive("link") && (
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().unsetLink().run();
                    setLinkDialogOpen(false);
                  }}
                  className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg mr-auto flex items-center gap-1 cursor-pointer"
                >
                  <Unlink className="w-3.5 h-3.5" /> Remove link
                </button>
              )}
              <button
                type="button"
                onClick={() => setLinkDialogOpen(false)}
                className="px-4 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 rounded-lg font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyLink}
                className="px-4 py-1.5 text-xs bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-lg font-medium cursor-pointer"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Dialog */}
      {imageDialogOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#dadce0] w-full max-w-md p-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-base text-[#1f1f1f]">Insert Image</h3>
              <button
                type="button"
                onClick={() => setImageDialogOpen(false)}
                className="p-1 rounded hover:bg-[#f1f3f4] cursor-pointer"
              >
                <X className="w-4 h-4 text-neutral-500" />
              </button>
            </div>

            <div className="space-y-4 mb-5">
              {/* Option 1: File Upload */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#c4c7c5] hover:border-[#1a73e8] rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-colors bg-[#f8fafd] hover:bg-[#e8f0fe]/30"
              >
                <Upload className="w-6 h-6 text-[#1a73e8] mb-2" />
                <p className="text-xs font-semibold text-[#1f1f1f]">Upload from computer</p>
                <p className="text-[11px] text-[#5f6368] mt-0.5">PNG, JPG, GIF, WebP, SVG</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="h-[1px] bg-neutral-200 flex-1" />
                <span className="text-[11px] text-neutral-400 font-medium uppercase">or by URL</span>
                <div className="h-[1px] bg-neutral-200 flex-1" />
              </div>

              {/* Option 2: Image URL */}
              <div>
                <label className="block text-xs font-medium text-[#5f6368] mb-1">
                  Image Web Address (URL)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://example.com/image.png"
                    className="flex-1 px-3 py-2 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:border-[#1a73e8]"
                  />
                  <button
                    type="button"
                    onClick={applyImageUrl}
                    disabled={!imageUrl.trim()}
                    className="px-3 py-2 text-xs bg-[#1a73e8] disabled:opacity-40 hover:bg-[#1557b0] text-white rounded-lg font-medium cursor-pointer"
                  >
                    Insert
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setImageDialogOpen(false)}
                className="px-4 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 rounded-lg font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
