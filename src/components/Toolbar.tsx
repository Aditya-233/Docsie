import React, { useState, useEffect, useRef } from 'react';
import {
  Undo,
  Redo,
  Printer,
  PaintRoller,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Highlighter,
  Link as LinkIcon,
  MessageSquare,
  Image as ImageIcon,
  Table as TableIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  ListTodo,
  Indent,
  Outdent,
  RemoveFormatting,
  Minus,
  Plus,
  ChevronDown,
  Check
} from 'lucide-react';
import { FONT_FAMILIES_WHITELIST } from '../core/editor.ts';

const COLOR_PALETTE: readonly string[] = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
  '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
  '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
  '#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd',
  '#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0',
  '#a61c1c', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79',
  '#85200c', '#990000', '#b45f06', '#bf9000', '#38761d', '#134f5c', '#1155cc', '#0b5394', '#351c75', '#741b47',
  '#5b0f00', '#660000', '#783f04', '#7f6000', '#274e13', '#0c343d', '#073763', '#073763', '#20124d', '#4c1130'
];

const HEADING_OPTIONS = [
  { label: 'Normal text', value: false, sizeClass: 'text-sm' },
  { label: 'Title', value: 1, sizeClass: 'text-2xl font-bold' },
  { label: 'Subtitle', value: 2, sizeClass: 'text-lg text-gray-600' },
  { label: 'Heading 1', value: 1, sizeClass: 'text-xl font-bold' },
  { label: 'Heading 2', value: 2, sizeClass: 'text-lg font-semibold' },
  { label: 'Heading 3', value: 3, sizeClass: 'text-base font-medium' }
];

const ZOOM_OPTIONS = ['50%', '75%', '90%', '100%', '125%', '150%', '200%'];

export interface ToolbarProps {
  quill?: any;
  isReadOnly?: boolean;
  formatPainterActive?: boolean;
  onToggleFormatPainter?: () => void;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  onOpenCommentBox?: () => void;
}

export default function Toolbar({
  quill,
  isReadOnly = false,
  formatPainterActive = false,
  onToggleFormatPainter,
  zoom = 100,
  onZoomChange,
  onOpenCommentBox
}: ToolbarProps) {
  const [activeFormats, setActiveFormats] = useState<Record<string, any>>({});
  const [fontFamily, setFontFamily] = useState('Roboto');
  const [fontSize, setFontSize] = useState('11');
  const [headingStyle, setHeadingStyle] = useState('Normal text');
  const [textColor, setTextColor] = useState('#000000');
  const [highlightColor, setHighlightColor] = useState('transparent');

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [tableHoverRows, setTableHoverRows] = useState(1);
  const [tableHoverCols, setTableHoverCols] = useState(1);

  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!quill) return;

    function handleSelectionChange(range: any) {
      if (range) {
        const formats = quill.getFormat(range) || {};
        setActiveFormats(formats);

        if (formats.font) {
          setFontFamily(formats.font);
        } else {
          setFontFamily('Roboto');
        }

        if (formats.size) {
          setFontSize(String(formats.size).replace('px', ''));
        } else {
          setFontSize('11');
        }

        if (formats.header) {
          setHeadingStyle(`Heading ${formats.header}`);
        } else {
          setHeadingStyle('Normal text');
        }

        setTextColor(formats.color || '#000000');
        setHighlightColor(formats.background || 'transparent');
      }
    }

    quill.on('selection-change', handleSelectionChange);
    quill.on('text-change', () => {
      const range = quill.getSelection();
      if (range) handleSelectionChange(range);
    });

    return () => {
      quill.off('selection-change', handleSelectionChange);
    };
  }, [quill]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = (name: string) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  const applyFormat = (name: string, value: any) => {
    if (!quill || isReadOnly) return;
    quill.format(name, value);
    setActiveFormats((prev) => ({ ...prev, [name]: value }));
  };

  const handleToggleFormat = (formatKey: string) => {
    if (!quill || isReadOnly) return;
    const current = !!activeFormats[formatKey];
    quill.format(formatKey, !current);
    setActiveFormats((prev) => ({ ...prev, [formatKey]: !current }));
  };

  const handleFontFamilySelect = (font: string) => {
    setFontFamily(font);
    applyFormat('font', font);
    setOpenDropdown(null);
  };

  const handleHeadingSelect = (option: any) => {
    setHeadingStyle(option.label);
    if (!quill || isReadOnly) return;
    if (option.value === false) {
      quill.format('header', false);
    } else {
      quill.format('header', option.value);
    }
    setOpenDropdown(null);
  };

  const handleFontSizeChange = (delta: number) => {
    const current = parseInt(fontSize, 10) || 11;
    const next = Math.max(6, Math.min(120, current + delta));
    setFontSize(String(next));
    applyFormat('size', `${next}px`);
  };

  const handleFontSizeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    setFontSize(val);
  };

  const handleFontSizeBlur = () => {
    const num = parseInt(fontSize, 10) || 11;
    setFontSize(String(num));
    applyFormat('size', `${num}px`);
  };

  const handleTextColorSelect = (color: string) => {
    setTextColor(color);
    applyFormat('color', color);
    setOpenDropdown(null);
  };

  const handleHighlightColorSelect = (color: string) => {
    setHighlightColor(color);
    applyFormat('background', color === 'transparent' ? false : color);
    setOpenDropdown(null);
  };

  const handleInsertTable = (rows: number, cols: number) => {
    if (!quill || isReadOnly) return;
    setOpenDropdown(null);
    const range = quill.getSelection(true);
    let tableHtml = `<table style="width:100%;border-collapse:collapse;margin:12px 0;"><tbody>`;
    for (let r = 0; r < rows; r++) {
      tableHtml += '<tr>';
      for (let c = 0; c < cols; c++) {
        tableHtml += `<td style="border:1px solid #c7c7c7;padding:8px 12px;min-width:60px;">&nbsp;</td>`;
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</tbody></table><p><br></p>';
    quill.clipboard.dangerouslyPasteHTML(range.index, tableHtml, 'user');
  };

  const handleInsertLink = () => {
    if (!quill || isReadOnly) return;
    const url = prompt('Enter link URL:');
    if (url) {
      applyFormat('link', url);
    }
  };

  const handleInsertImage = () => {
    if (!quill || isReadOnly) return;
    const url = prompt('Enter image URL:');
    if (url) {
      const range = quill.getSelection(true);
      quill.insertEmbed(range.index, 'image', url, 'user');
    }
  };

  const handleClearFormatting = () => {
    if (!quill || isReadOnly) return;
    const range = quill.getSelection();
    if (range) {
      quill.removeFormat(range.index, range.length);
      setActiveFormats({});
    }
  };

  return (
    <div
      ref={toolbarRef}
      className="bg-[#edf2fa] dark:bg-[#282a2c] px-2 sm:px-3 py-1 border-b border-[#e0e2e0] dark:border-[#333538] flex items-center gap-0.5 sm:gap-1 overflow-x-auto scrollbar-none touch-pan-x select-none transition-colors text-[#444746] dark:text-[#c4c7c5] flex-nowrap"
    >
      {/* 1. Undo & Redo */}
      <button
        onClick={() => quill?.history?.undo?.()}
        disabled={isReadOnly}
        className="p-1.5 rounded hover:bg-[#e0e8f6] dark:hover:bg-[#333538] disabled:opacity-40 transition-colors flex-shrink-0 cursor-pointer"
        title="Undo (Ctrl+Z)"
      >
        <Undo className="w-4 h-4" />
      </button>
      <button
        onClick={() => quill?.history?.redo?.()}
        disabled={isReadOnly}
        className="p-1.5 rounded hover:bg-[#e0e8f6] dark:hover:bg-[#333538] disabled:opacity-40 transition-colors flex-shrink-0 cursor-pointer"
        title="Redo (Ctrl+Y)"
      >
        <Redo className="w-4 h-4" />
      </button>

      {/* 2. Print */}
      <button
        onClick={() => window.print()}
        className="p-1.5 rounded hover:bg-[#e0e8f6] dark:hover:bg-[#333538] transition-colors hidden sm:inline-block flex-shrink-0 cursor-pointer"
        title="Print (Ctrl+P)"
      >
        <Printer className="w-4 h-4" />
      </button>

      {/* 3. Format Painter */}
      <button
        onClick={onToggleFormatPainter}
        disabled={isReadOnly}
        className={`p-1.5 rounded transition-colors flex-shrink-0 cursor-pointer ${
          formatPainterActive
            ? 'bg-[#d3e3fd] text-[#041e49] dark:bg-[#004a77] dark:text-[#c2e7ff]'
            : 'hover:bg-[#e0e8f6] dark:hover:bg-[#333538]'
        }`}
        title="Paint format"
      >
        <PaintRoller className="w-4 h-4" />
      </button>

      <div className="w-[1px] h-5 bg-[#dadce0] dark:bg-[#444746] mx-0.5 sm:mx-1 flex-shrink-0" />

      {/* 4. Zoom Selector */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => toggleDropdown('zoom')}
          className="flex items-center gap-1 px-1.5 sm:px-2 py-1 text-xs font-medium rounded hover:bg-[#e0e8f6] dark:hover:bg-[#333538] transition-colors min-w-[48px] sm:min-w-[56px] justify-between cursor-pointer"
          title="Zoom"
        >
          <span>{zoom}%</span>
          <ChevronDown className="w-3 h-3 text-gray-500" />
        </button>
        {openDropdown === 'zoom' && (
          <div className="absolute left-0 top-full mt-1 w-24 bg-white dark:bg-[#282a2c] rounded-lg gdocs-dropdown-shadow border border-[#e0e2e0] dark:border-[#444746] py-1 z-50 text-xs">
            {ZOOM_OPTIONS.map((z) => (
              <button
                key={z}
                onClick={() => {
                  if (onZoomChange) onZoomChange(parseInt(z, 10));
                  setOpenDropdown(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#333538] flex items-center justify-between cursor-pointer"
              >
                <span>{z}</span>
                {parseInt(z, 10) === zoom && (
                  <Check className="w-3 h-3 text-[#1a73e8]" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-[1px] h-5 bg-[#dadce0] dark:bg-[#444746] mx-0.5 sm:mx-1 flex-shrink-0" />

      {/* 5. Heading Styles */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => toggleDropdown('heading')}
          disabled={isReadOnly}
          className="flex items-center gap-1 px-1.5 sm:px-2 py-1 text-xs font-medium rounded hover:bg-[#e0e8f6] dark:hover:bg-[#333538] transition-colors min-w-[80px] sm:min-w-[96px] justify-between cursor-pointer"
          title="Styles"
        >
          <span className="truncate">{headingStyle}</span>
          <ChevronDown className="w-3 h-3 text-gray-500" />
        </button>
        {openDropdown === 'heading' && (
          <div className="absolute left-0 top-full mt-1 w-52 bg-white dark:bg-[#282a2c] rounded-lg gdocs-dropdown-shadow border border-[#e0e2e0] dark:border-[#444746] py-1.5 z-50 text-xs">
            {HEADING_OPTIONS.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleHeadingSelect(opt)}
                className="w-full text-left px-3.5 py-2 hover:bg-[#f1f3f4] dark:hover:bg-[#333538] flex items-center justify-between cursor-pointer"
              >
                <span className={opt.sizeClass}>{opt.label}</span>
                {headingStyle === opt.label && (
                  <Check className="w-3.5 h-3.5 text-[#1a73e8]" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-[1px] h-5 bg-[#dadce0] dark:bg-[#444746] mx-0.5 sm:mx-1 flex-shrink-0" />

      {/* 6. Font Family Dropdown */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => toggleDropdown('font')}
          disabled={isReadOnly}
          className="flex items-center gap-1 px-1.5 sm:px-2 py-1 text-xs font-medium rounded hover:bg-[#e0e8f6] dark:hover:bg-[#333538] transition-colors min-w-[85px] sm:min-w-[110px] justify-between cursor-pointer"
          title="Font"
        >
          <span className="truncate" style={{ fontFamily }}>
            {fontFamily}
          </span>
          <ChevronDown className="w-3 h-3 text-gray-500" />
        </button>
        {openDropdown === 'font' && (
          <div className="absolute left-0 top-full mt-1 w-48 bg-white dark:bg-[#282a2c] rounded-lg gdocs-dropdown-shadow border border-[#e0e2e0] dark:border-[#444746] py-1.5 z-50 text-xs max-h-64 overflow-y-auto">
            {FONT_FAMILIES_WHITELIST.map((font) => (
              <button
                key={font}
                onClick={() => handleFontFamilySelect(font)}
                style={{ fontFamily: font }}
                className="w-full text-left px-3.5 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#333538] flex items-center justify-between text-sm cursor-pointer"
              >
                <span>{font}</span>
                {fontFamily === font && (
                  <Check className="w-3.5 h-3.5 text-[#1a73e8]" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-[1px] h-5 bg-[#dadce0] dark:bg-[#444746] mx-0.5 sm:mx-1 flex-shrink-0" />

      {/* 7. Font Size Stepper */}
      <div className="flex items-center flex-shrink-0">
        <button
          onClick={() => handleFontSizeChange(-1)}
          disabled={isReadOnly}
          className="p-1 rounded-l hover:bg-[#e0e8f6] dark:hover:bg-[#333538] transition-colors cursor-pointer"
          title="Decrease font size"
        >
          <Minus className="w-3 h-3" />
        </button>
        <input
          type="text"
          value={fontSize}
          onChange={handleFontSizeInput}
          onBlur={handleFontSizeBlur}
          disabled={isReadOnly}
          className="w-7 sm:w-8 text-center text-xs font-medium bg-transparent border-x border-[#dadce0] dark:border-[#444746] py-0.5 outline-none"
        />
        <button
          onClick={() => handleFontSizeChange(1)}
          disabled={isReadOnly}
          className="p-1 rounded-r hover:bg-[#e0e8f6] dark:hover:bg-[#333538] transition-colors cursor-pointer"
          title="Increase font size"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      <div className="w-[1px] h-5 bg-[#dadce0] dark:bg-[#444746] mx-0.5 sm:mx-1 flex-shrink-0" />

      {/* 8. Formatting Toggles */}
      <button
        onClick={() => handleToggleFormat('bold')}
        disabled={isReadOnly}
        className={`p-1.5 rounded transition-colors flex-shrink-0 cursor-pointer ${
          activeFormats.bold
            ? 'bg-[#d3e3fd] text-[#041e49] dark:bg-[#004a77] dark:text-[#c2e7ff]'
            : 'hover:bg-[#e0e8f6] dark:hover:bg-[#333538]'
        }`}
        title="Bold (Ctrl+B)"
      >
        <Bold className="w-4 h-4 font-bold" />
      </button>
      <button
        onClick={() => handleToggleFormat('italic')}
        disabled={isReadOnly}
        className={`p-1.5 rounded transition-colors flex-shrink-0 cursor-pointer ${
          activeFormats.italic
            ? 'bg-[#d3e3fd] text-[#041e49] dark:bg-[#004a77] dark:text-[#c2e7ff]'
            : 'hover:bg-[#e0e8f6] dark:hover:bg-[#333538]'
        }`}
        title="Italic (Ctrl+I)"
      >
        <Italic className="w-4 h-4" />
      </button>
      <button
        onClick={() => handleToggleFormat('underline')}
        disabled={isReadOnly}
        className={`p-1.5 rounded transition-colors flex-shrink-0 cursor-pointer ${
          activeFormats.underline
            ? 'bg-[#d3e3fd] text-[#041e49] dark:bg-[#004a77] dark:text-[#c2e7ff]'
            : 'hover:bg-[#e0e8f6] dark:hover:bg-[#333538]'
        }`}
        title="Underline (Ctrl+U)"
      >
        <Underline className="w-4 h-4" />
      </button>
      <button
        onClick={() => handleToggleFormat('strike')}
        disabled={isReadOnly}
        className={`p-1.5 rounded transition-colors flex-shrink-0 cursor-pointer ${
          activeFormats.strike
            ? 'bg-[#d3e3fd] text-[#041e49] dark:bg-[#004a77] dark:text-[#c2e7ff]'
            : 'hover:bg-[#e0e8f6] dark:hover:bg-[#333538]'
        }`}
        title="Strikethrough"
      >
        <Strikethrough className="w-4 h-4" />
      </button>

      {/* 9. Text Color Picker */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => toggleDropdown('textColor')}
          disabled={isReadOnly}
          className="flex flex-col items-center justify-center p-1 rounded hover:bg-[#e0e8f6] dark:hover:bg-[#333538] transition-colors cursor-pointer"
          title="Text color"
        >
          <span className="text-xs font-bold leading-none">A</span>
          <span
            className="w-3.5 h-1 mt-0.5 rounded-sm"
            style={{ backgroundColor: textColor }}
          />
        </button>
        {openDropdown === 'textColor' && (
          <div className="absolute left-0 top-full mt-1 p-2 bg-white dark:bg-[#282a2c] rounded-lg gdocs-dropdown-shadow border border-[#e0e2e0] dark:border-[#444746] z-50 w-52">
            <div className="grid grid-cols-10 gap-1">
              {COLOR_PALETTE.map((c, i) => (
                <button
                  key={i}
                  onClick={() => handleTextColorSelect(c)}
                  className="w-4 h-4 rounded-sm border border-black/10 hover:scale-125 transition-transform cursor-pointer"
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 10. Highlight Color Picker */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => toggleDropdown('bgColor')}
          disabled={isReadOnly}
          className="flex flex-col items-center justify-center p-1 rounded hover:bg-[#e0e8f6] dark:hover:bg-[#333538] transition-colors cursor-pointer"
          title="Highlight color"
        >
          <Highlighter className="w-3.5 h-3.5" />
          <span
            className="w-3.5 h-1 mt-0.5 rounded-sm"
            style={{ backgroundColor: highlightColor === 'transparent' ? '#fbbc04' : highlightColor }}
          />
        </button>
        {openDropdown === 'bgColor' && (
          <div className="absolute left-0 top-full mt-1 p-2 bg-white dark:bg-[#282a2c] rounded-lg gdocs-dropdown-shadow border border-[#e0e2e0] dark:border-[#444746] z-50 w-52">
            <button
              onClick={() => handleHighlightColorSelect('transparent')}
              className="w-full text-center py-1 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded mb-1.5 cursor-pointer"
            >
              None
            </button>
            <div className="grid grid-cols-10 gap-1">
              {COLOR_PALETTE.map((c, i) => (
                <button
                  key={i}
                  onClick={() => handleHighlightColorSelect(c)}
                  className="w-4 h-4 rounded-sm border border-black/10 hover:scale-125 transition-transform cursor-pointer"
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="w-[1px] h-5 bg-[#dadce0] dark:bg-[#444746] mx-0.5 sm:mx-1 flex-shrink-0" />

      {/* 11. Links & Media */}
      <button
        onClick={handleInsertLink}
        disabled={isReadOnly}
        className="p-1.5 rounded hover:bg-[#e0e8f6] dark:hover:bg-[#333538] transition-colors flex-shrink-0 cursor-pointer"
        title="Insert link (Ctrl+K)"
      >
        <LinkIcon className="w-4 h-4" />
      </button>

      <button
        onClick={onOpenCommentBox}
        className="p-1.5 rounded hover:bg-[#e0e8f6] dark:hover:bg-[#333538] transition-colors flex-shrink-0 cursor-pointer"
        title="Add comment (Ctrl+Alt+M)"
      >
        <MessageSquare className="w-4 h-4" />
      </button>

      <button
        onClick={handleInsertImage}
        disabled={isReadOnly}
        className="p-1.5 rounded hover:bg-[#e0e8f6] dark:hover:bg-[#333538] transition-colors flex-shrink-0 cursor-pointer"
        title="Insert image"
      >
        <ImageIcon className="w-4 h-4" />
      </button>

      {/* Table Picker */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => toggleDropdown('table')}
          disabled={isReadOnly}
          className="p-1.5 rounded hover:bg-[#e0e8f6] dark:hover:bg-[#333538] transition-colors cursor-pointer"
          title="Insert table"
        >
          <TableIcon className="w-4 h-4" />
        </button>
        {openDropdown === 'table' && (
          <div className="absolute left-0 top-full mt-1 p-3 bg-white dark:bg-[#282a2c] rounded-lg gdocs-dropdown-shadow border border-[#e0e2e0] dark:border-[#444746] z-50">
            <div className="text-center text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              {tableHoverRows} x {tableHoverCols} Table
            </div>
            <div
              className="grid grid-cols-6 gap-1"
              onMouseLeave={() => {
                setTableHoverRows(1);
                setTableHoverCols(1);
              }}
            >
              {[1, 2, 3, 4, 5, 6].map((r) =>
                [1, 2, 3, 4, 5, 6].map((c) => (
                  <div
                    key={`${r}-${c}`}
                    onMouseEnter={() => {
                      setTableHoverRows(r);
                      setTableHoverCols(c);
                    }}
                    onClick={() => handleInsertTable(r, c)}
                    className={`w-5 h-5 border rounded-sm cursor-pointer transition-colors ${
                      r <= tableHoverRows && c <= tableHoverCols
                        ? 'bg-[#c2e7ff] border-[#0b57d0]'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-transparent'
                    }`}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div className="w-[1px] h-5 bg-[#dadce0] dark:bg-[#444746] mx-0.5 sm:mx-1 flex-shrink-0" />

      {/* 12. Alignments */}
      <button
        onClick={() => applyFormat('align', false)}
        disabled={isReadOnly}
        className={`p-1.5 rounded transition-colors flex-shrink-0 cursor-pointer ${
          !activeFormats.align
            ? 'bg-[#d3e3fd] text-[#041e49] dark:bg-[#004a77] dark:text-[#c2e7ff]'
            : 'hover:bg-[#e0e8f6] dark:hover:bg-[#333538]'
        }`}
        title="Left align"
      >
        <AlignLeft className="w-4 h-4" />
      </button>
      <button
        onClick={() => applyFormat('align', 'center')}
        disabled={isReadOnly}
        className={`p-1.5 rounded transition-colors flex-shrink-0 cursor-pointer ${
          activeFormats.align === 'center'
            ? 'bg-[#d3e3fd] text-[#041e49] dark:bg-[#004a77] dark:text-[#c2e7ff]'
            : 'hover:bg-[#e0e8f6] dark:hover:bg-[#333538]'
        }`}
        title="Center align"
      >
        <AlignCenter className="w-4 h-4" />
      </button>
      <button
        onClick={() => applyFormat('align', 'right')}
        disabled={isReadOnly}
        className={`p-1.5 rounded transition-colors flex-shrink-0 cursor-pointer ${
          activeFormats.align === 'right'
            ? 'bg-[#d3e3fd] text-[#041e49] dark:bg-[#004a77] dark:text-[#c2e7ff]'
            : 'hover:bg-[#e0e8f6] dark:hover:bg-[#333538]'
        }`}
        title="Right align"
      >
        <AlignRight className="w-4 h-4" />
      </button>
      <button
        onClick={() => applyFormat('align', 'justify')}
        disabled={isReadOnly}
        className={`p-1.5 rounded transition-colors flex-shrink-0 cursor-pointer ${
          activeFormats.align === 'justify'
            ? 'bg-[#d3e3fd] text-[#041e49] dark:bg-[#004a77] dark:text-[#c2e7ff]'
            : 'hover:bg-[#e0e8f6] dark:hover:bg-[#333538]'
        }`}
        title="Justify"
      >
        <AlignJustify className="w-4 h-4" />
      </button>

      <div className="w-[1px] h-5 bg-[#dadce0] dark:bg-[#444746] mx-0.5 sm:mx-1 flex-shrink-0" />

      {/* 13. Lists & Checklist */}
      <button
        onClick={() => handleToggleFormat('list')}
        disabled={isReadOnly}
        className={`p-1.5 rounded transition-colors flex-shrink-0 cursor-pointer ${
          activeFormats.list === 'bullet'
            ? 'bg-[#d3e3fd] text-[#041e49] dark:bg-[#004a77] dark:text-[#c2e7ff]'
            : 'hover:bg-[#e0e8f6] dark:hover:bg-[#333538]'
        }`}
        title="Bulleted list"
      >
        <List className="w-4 h-4" />
      </button>
      <button
        onClick={() => {
          if (!quill || isReadOnly) return;
          const current = activeFormats.list === 'ordered';
          quill.format('list', current ? false : 'ordered');
        }}
        disabled={isReadOnly}
        className={`p-1.5 rounded transition-colors flex-shrink-0 cursor-pointer ${
          activeFormats.list === 'ordered'
            ? 'bg-[#d3e3fd] text-[#041e49] dark:bg-[#004a77] dark:text-[#c2e7ff]'
            : 'hover:bg-[#e0e8f6] dark:hover:bg-[#333538]'
        }`}
        title="Numbered list"
      >
        <ListOrdered className="w-4 h-4" />
      </button>
      <button
        onClick={() => {
          if (!quill || isReadOnly) return;
          const current = activeFormats.list === 'unchecked';
          quill.format('list', current ? false : 'unchecked');
        }}
        disabled={isReadOnly}
        className={`p-1.5 rounded transition-colors flex-shrink-0 cursor-pointer ${
          activeFormats.list === 'unchecked' || activeFormats.list === 'checked'
            ? 'bg-[#d3e3fd] text-[#041e49] dark:bg-[#004a77] dark:text-[#c2e7ff]'
            : 'hover:bg-[#e0e8f6] dark:hover:bg-[#333538]'
        }`}
        title="Checklist"
      >
        <ListTodo className="w-4 h-4" />
      </button>

      {/* 14. Indent */}
      <button
        onClick={() => applyFormat('indent', '-1')}
        disabled={isReadOnly}
        className="p-1.5 rounded hover:bg-[#e0e8f6] dark:hover:bg-[#333538] transition-colors flex-shrink-0 cursor-pointer"
        title="Decrease indent"
      >
        <Outdent className="w-4 h-4" />
      </button>
      <button
        onClick={() => applyFormat('indent', '+1')}
        disabled={isReadOnly}
        className="p-1.5 rounded hover:bg-[#e0e8f6] dark:hover:bg-[#333538] transition-colors flex-shrink-0 cursor-pointer"
        title="Increase indent"
      >
        <Indent className="w-4 h-4" />
      </button>

      {/* 15. Clear Formatting */}
      <button
        onClick={handleClearFormatting}
        disabled={isReadOnly}
        className="p-1.5 rounded hover:bg-[#e0e8f6] dark:hover:bg-[#333538] transition-colors flex-shrink-0 cursor-pointer"
        title="Clear formatting"
      >
        <RemoveFormatting className="w-4 h-4" />
      </button>
    </div>
  );
}
