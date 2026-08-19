import React, { useState, useRef, useEffect } from 'react';
import {
  Lock,
  Globe,
  Star,
  Folder,
  CloudCheck,
  Video,
  MessageSquare,
  Clock,
  Printer,
  FileText,
  Copy,
  Download,
  Share2,
  Check,
  ChevronDown,
  Sparkles,
  HelpCircle,
  Eye,
  Edit3
} from 'lucide-react';
import UserProfileMenu from './UserProfileMenu.jsx';

/**
 * Header Component for Google Docs.
 * Features:
 * - Document Title with inline editing and hover border
 * - Star button toggle
 * - Cloud sync status indicator & Folder move icon
 * - Live status: "Last edit was made seconds ago by [UserName]"
 * - Top-right overlapping presence circles stack with colored borders and tooltips
 * - Video call and history buttons
 * - Primary blue 'Share' button with lock icon
 * - Interactive Menubar (File, Edit, View, Insert, Format, Tools, Help)
 */
export default function Header({
  title = 'Untitled document',
  onTitleChange,
  isStarred = false,
  onToggleStar,
  lastEditUser = 'You',
  lastEditTime = 'seconds ago',
  collaborators = [],
  currentUser = null,
  currentRole = 'owner',
  onOpenShareModal,
  onMenuAction,
  theme = 'light',
  onToggleTheme,
  showRuler = true,
  onToggleRuler,
  onOpenDashboard,
  onUpdateProfile,
  onOpenAuthModal,
  onLogout
}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState(title);
  const [activeMenu, setActiveMenu] = useState(null);
  const [hoveredAvatar, setHoveredAvatar] = useState(null);
  const titleInputRef = useRef(null);
  const menubarRef = useRef(null);

  // Sync external title prop to local title state
  useEffect(() => {
    setLocalTitle(title);
  }, [title]);

  // Handle outside click to dismiss menus
  useEffect(() => {
    function handleClickOutside(event) {
      if (menubarRef.current && !menubarRef.current.contains(event.target)) {
        setActiveMenu(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    const trimmed = localTitle.trim();
    if (trimmed && trimmed !== title && onTitleChange) {
      onTitleChange(trimmed);
    } else {
      setLocalTitle(title);
    }
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleTitleSubmit();
    } else if (e.key === 'Escape') {
      setLocalTitle(title);
      setIsEditingTitle(false);
    }
  };

  // Close menu and trigger action
  const handleAction = (action, param = null) => {
    setActiveMenu(null);
    if (onMenuAction) {
      onMenuAction(action, param);
    }
  };

  return (
    <header className="bg-[#f8fafd] dark:bg-[#1e1f20] border-b border-[#e0e2e0] dark:border-[#2e3032] select-none z-30 transition-colors">
      <div className="flex items-center justify-between px-4 py-2">
        {/* Left Section: Doc Icon + Editable Title + Icons + Sub-row Menu */}
        <div className="flex items-start gap-3">
          {/* Google Docs Icon */}
          <button
            onClick={onOpenDashboard}
            title="Docs home (My Documents)"
            className="mt-1 flex items-center justify-center w-10 h-10 hover:bg-[#e0e8f6] dark:hover:bg-[#333538] rounded-full transition-colors cursor-pointer"
          >
            <svg
              className="w-8 h-8"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M14 2H6C4.9 2 4.01 2.9 4.01 4L4 20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2Z"
                fill="#4285F4"
              />
              <path d="M13 3.5V9H18.5L13 3.5Z" fill="#A1C2FA" />
              <path d="M8 13H16V14.5H8V13Z" fill="white" />
              <path d="M8 16H16V17.5H8V16Z" fill="white" />
              <path d="M8 10H13V11.5H8V10Z" fill="white" />
            </svg>
          </button>

          <div>
            {/* Top Row: Inline Title + Star + Move + Sync Status */}
            <div className="flex items-center gap-2">
              {isEditingTitle ? (
                <input
                  ref={titleInputRef}
                  type="text"
                  value={localTitle}
                  onChange={(e) => setLocalTitle(e.target.value)}
                  onBlur={handleTitleSubmit}
                  onKeyDown={handleTitleKeyDown}
                  autoFocus
                  className="text-lg font-medium text-[#1f1f1f] dark:text-[#e3e3e3] bg-white dark:bg-[#282a2c] px-2 py-0.5 rounded border border-[#1a73e8] outline-none shadow-sm min-w-[200px]"
                />
              ) : (
                <span
                  onClick={() => setIsEditingTitle(true)}
                  className="text-lg font-medium text-[#1f1f1f] dark:text-[#e3e3e3] hover:bg-[#e0e8f6] dark:hover:bg-[#333538] px-2 py-0.5 rounded cursor-pointer border border-transparent hover:border-[#dadce0] dark:hover:border-[#444746] transition-all max-w-[400px] truncate"
                  title="Rename"
                >
                  {title || 'Untitled document'}
                </span>
              )}

              {/* Star Button */}
              <button
                onClick={onToggleStar}
                className="p-1 rounded-full text-[#444746] dark:text-[#c4c7c5] hover:bg-[#e0e8f6] dark:hover:bg-[#333538] transition-colors"
                title={isStarred ? 'Unstar' : 'Star'}
              >
                <Star
                  className={`w-4 h-4 ${
                    isStarred
                      ? 'fill-[#fbbc04] text-[#fbbc04]'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                  }`}
                />
              </button>

              {/* Move to Folder */}
              <button
                onClick={() => handleAction('move')}
                className="p-1 rounded-full text-[#444746] dark:text-[#c4c7c5] hover:bg-[#e0e8f6] dark:hover:bg-[#333538] transition-colors"
                title="Move"
              >
                <Folder className="w-4 h-4" />
              </button>

              {/* Cloud Sync Status */}
              <button
                className="p-1 rounded-full text-[#444746] dark:text-[#c4c7c5] hover:bg-[#e0e8f6] dark:hover:bg-[#333538] transition-colors"
                title="Document status: Saved to cloud & peers synced"
              >
                <CloudCheck className="w-4 h-4 text-[#1e8e3e]" />
              </button>

              {/* Subtle Live Status: "Last edit was made seconds ago by [UserName]" (Image 3) */}
              <span className="text-xs text-[#727775] dark:text-[#8e918f] italic ml-2 hidden md:inline-block">
                Last edit was made {lastEditTime} by {lastEditUser}
              </span>
            </div>

            {/* Sub-row: Menubar */}
            <div ref={menubarRef} className="flex items-center space-x-0.5 mt-0.5 relative">
              {/* File Menu */}
              <div className="relative">
                <button
                  onClick={() => setActiveMenu(activeMenu === 'file' ? null : 'file')}
                  onMouseEnter={() => activeMenu && setActiveMenu('file')}
                  className={`px-2 py-0.5 text-xs font-medium rounded hover:bg-[#e0e8f6] dark:hover:bg-[#333538] transition-colors ${
                    activeMenu === 'file'
                      ? 'bg-[#d3e3fd] text-[#041e49] dark:bg-[#004a77] dark:text-[#c2e7ff]'
                      : 'text-[#444746] dark:text-[#c4c7c5]'
                  }`}
                >
                  File
                </button>
                {activeMenu === 'file' && (
                  <div className="absolute left-0 top-full mt-1 w-64 bg-white dark:bg-[#282a2c] rounded-lg gdocs-dropdown-shadow border border-[#e0e2e0] dark:border-[#444746] py-1.5 z-50 text-xs text-[#1f1f1f] dark:text-[#e3e3e3]">
                    <button
                      onClick={() => handleAction('new')}
                      className="w-full text-left px-4 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#333538] flex items-center justify-between"
                    >
                      <span>New document</span>
                    </button>
                    <button
                      onClick={() => handleAction('copy')}
                      className="w-full text-left px-4 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#333538] flex items-center justify-between"
                    >
                      <span>Make a copy</span>
                    </button>
                    <div className="border-t border-[#e0e2e0] dark:border-[#444746] my-1" />
                    <button
                      onClick={() => {
                        setActiveMenu(null);
                        onOpenShareModal();
                      }}
                      className="w-full text-left px-4 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#333538] flex items-center justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <Share2 className="w-3.5 h-3.5" /> Share
                      </span>
                    </button>
                    <div className="border-t border-[#e0e2e0] dark:border-[#444746] my-1" />
                    <div className="px-4 py-1 text-[11px] font-semibold text-[#727775] uppercase">
                      Download
                    </div>
                    <button
                      onClick={() => handleAction('download_pdf')}
                      className="w-full text-left px-6 py-1 hover:bg-[#f1f3f4] dark:hover:bg-[#333538]"
                    >
                      PDF Document (.pdf)
                    </button>
                    <button
                      onClick={() => handleAction('download_docx')}
                      className="w-full text-left px-6 py-1 hover:bg-[#f1f3f4] dark:hover:bg-[#333538]"
                    >
                      Microsoft Word (.docx)
                    </button>
                    <button
                      onClick={() => handleAction('download_txt')}
                      className="w-full text-left px-6 py-1 hover:bg-[#f1f3f4] dark:hover:bg-[#333538]"
                    >
                      Plain Text (.txt)
                    </button>
                    <button
                      onClick={() => handleAction('download_md')}
                      className="w-full text-left px-6 py-1 hover:bg-[#f1f3f4] dark:hover:bg-[#333538]"
                    >
                      Markdown (.md)
                    </button>
                    <button
                      onClick={() => handleAction('download_html')}
                      className="w-full text-left px-6 py-1 hover:bg-[#f1f3f4] dark:hover:bg-[#333538]"
                    >
                      Web Page (.html)
                    </button>
                    <div className="border-t border-[#e0e2e0] dark:border-[#444746] my-1" />
                    <button
                      onClick={() => {
                        setIsEditingTitle(true);
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-4 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#333538]"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => handleAction('version_history')}
                      className="w-full text-left px-4 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#333538] flex items-center justify-between"
                    >
                      <span>Version history</span>
                    </button>
                    <div className="border-t border-[#e0e2e0] dark:border-[#444746] my-1" />
                    <button
                      onClick={() => handleAction('print')}
                      className="w-full text-left px-4 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#333538] flex items-center justify-between"
                    >
                      <span>Print</span>
                      <span className="text-[#727775] text-[10px]">Ctrl+P</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Edit Menu */}
              <div className="relative">
                <button
                  onClick={() => setActiveMenu(activeMenu === 'edit' ? null : 'edit')}
                  onMouseEnter={() => activeMenu && setActiveMenu('edit')}
                  className={`px-2 py-0.5 text-xs font-medium rounded hover:bg-[#e0e8f6] dark:hover:bg-[#333538] transition-colors ${
                    activeMenu === 'edit'
                      ? 'bg-[#d3e3fd] text-[#041e49] dark:bg-[#004a77] dark:text-[#c2e7ff]'
                      : 'text-[#444746] dark:text-[#c4c7c5]'
                  }`}
                >
                  Edit
                </button>
                {activeMenu === 'edit' && (
                  <div className="absolute left-0 top-full mt-1 w-56 bg-white dark:bg-[#282a2c] rounded-lg gdocs-dropdown-shadow border border-[#e0e2e0] dark:border-[#444746] py-1.5 z-50 text-xs text-[#1f1f1f] dark:text-[#e3e3e3]">
                    <button
                      onClick={() => handleAction('undo')}
                      className="w-full text-left px-4 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#333538] flex items-center justify-between"
                    >
                      <span>Undo</span>
                      <span className="text-[#727775] text-[10px]">Ctrl+Z</span>
                    </button>
                    <button
                      onClick={() => handleAction('redo')}
                      className="w-full text-left px-4 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#333538] flex items-center justify-between"
                    >
                      <span>Redo</span>
                      <span className="text-[#727775] text-[10px]">Ctrl+Y</span>
                    </button>
                    <div className="border-t border-[#e0e2e0] dark:border-[#444746] my-1" />
                    <button
                      onClick={() => handleAction('select_all')}
                      className="w-full text-left px-4 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#333538] flex items-center justify-between"
                    >
                      <span>Select all</span>
                      <span className="text-[#727775] text-[10px]">Ctrl+A</span>
                    </button>
                    <button
                      onClick={() => handleAction('find_replace')}
                      className="w-full text-left px-4 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#333538] flex items-center justify-between"
                    >
                      <span>Find and replace</span>
                      <span className="text-[#727775] text-[10px]">Ctrl+H</span>
                    </button>
                  </div>
                )}
              </div>

              {/* View Menu */}
              <div className="relative">
                <button
                  onClick={() => setActiveMenu(activeMenu === 'view' ? null : 'view')}
                  onMouseEnter={() => activeMenu && setActiveMenu('view')}
                  className={`px-2 py-0.5 text-xs font-medium rounded hover:bg-[#e0e8f6] dark:hover:bg-[#333538] transition-colors ${
                    activeMenu === 'view'
                      ? 'bg-[#d3e3fd] text-[#041e49] dark:bg-[#004a77] dark:text-[#c2e7ff]'
                      : 'text-[#444746] dark:text-[#c4c7c5]'
                  }`}
                >
                  View
                </button>
                {activeMenu === 'view' && (
                  <div className="absolute left-0 top-full mt-1 w-56 bg-white dark:bg-[#282a2c] rounded-lg gdocs-dropdown-shadow border border-[#e0e2e0] dark:border-[#444746] py-1.5 z-50 text-xs text-[#1f1f1f] dark:text-[#e3e3e3]">
                    <button
                      onClick={() => {
                        onToggleRuler();
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-4 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#333538] flex items-center justify-between"
                    >
                      <span>Show ruler</span>
                      {showRuler && <Check className="w-3.5 h-3.5 text-[#1a73e8]" />}
                    </button>
                    <button
                      onClick={() => {
                        onToggleTheme();
                        setActiveMenu(null);
                      }}
                      className="w-full text-left px-4 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#333538] flex items-center justify-between"
                    >
                      <span>Dark mode</span>
                      {theme === 'dark' && <Check className="w-3.5 h-3.5 text-[#1a73e8]" />}
                    </button>
                    <div className="border-t border-[#e0e2e0] dark:border-[#444746] my-1" />
                    <button
                      onClick={() => handleAction('fullscreen')}
                      className="w-full text-left px-4 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#333538]"
                    >
                      Full screen
                    </button>
                  </div>
                )}
              </div>

              {/* Insert Menu */}
              <div className="relative">
                <button
                  onClick={() => setActiveMenu(activeMenu === 'insert' ? null : 'insert')}
                  onMouseEnter={() => activeMenu && setActiveMenu('insert')}
                  className={`px-2 py-0.5 text-xs font-medium rounded hover:bg-[#e0e8f6] dark:hover:bg-[#333538] transition-colors ${
                    activeMenu === 'insert'
                      ? 'bg-[#d3e3fd] text-[#041e49] dark:bg-[#004a77] dark:text-[#c2e7ff]'
                      : 'text-[#444746] dark:text-[#c4c7c5]'
                  }`}
                >
                  Insert
                </button>
                {activeMenu === 'insert' && (
                  <div className="absolute left-0 top-full mt-1 w-56 bg-white dark:bg-[#282a2c] rounded-lg gdocs-dropdown-shadow border border-[#e0e2e0] dark:border-[#444746] py-1.5 z-50 text-xs text-[#1f1f1f] dark:text-[#e3e3e3]">
                    <button
                      onClick={() => handleAction('insert_image')}
                      className="w-full text-left px-4 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#333538]"
                    >
                      Image
                    </button>
                    <button
                      onClick={() => handleAction('insert_table')}
                      className="w-full text-left px-4 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#333538]"
                    >
                      Table
                    </button>
                    <button
                      onClick={() => handleAction('insert_link')}
                      className="w-full text-left px-4 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#333538] flex items-center justify-between"
                    >
                      <span>Link</span>
                      <span className="text-[#727775] text-[10px]">Ctrl+K</span>
                    </button>
                    <button
                      onClick={() => handleAction('insert_comment')}
                      className="w-full text-left px-4 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#333538] flex items-center justify-between"
                    >
                      <span>Comment</span>
                      <span className="text-[#727775] text-[10px]">Ctrl+Alt+M</span>
                    </button>
                    <div className="border-t border-[#e0e2e0] dark:border-[#444746] my-1" />
                    <button
                      onClick={() => handleAction('insert_hr')}
                      className="w-full text-left px-4 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#333538]"
                    >
                      Horizontal line
                    </button>
                    <button
                      onClick={() => handleAction('insert_page_break')}
                      className="w-full text-left px-4 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#333538]"
                    >
                      Page break
                    </button>
                  </div>
                )}
              </div>

              {/* Format Menu */}
              <div className="relative">
                <button
                  onClick={() => setActiveMenu(activeMenu === 'format' ? null : 'format')}
                  onMouseEnter={() => activeMenu && setActiveMenu('format')}
                  className={`px-2 py-0.5 text-xs font-medium rounded hover:bg-[#e0e8f6] dark:hover:bg-[#333538] transition-colors ${
                    activeMenu === 'format'
                      ? 'bg-[#d3e3fd] text-[#041e49] dark:bg-[#004a77] dark:text-[#c2e7ff]'
                      : 'text-[#444746] dark:text-[#c4c7c5]'
                  }`}
                >
                  Format
                </button>
                {activeMenu === 'format' && (
                  <div className="absolute left-0 top-full mt-1 w-56 bg-white dark:bg-[#282a2c] rounded-lg gdocs-dropdown-shadow border border-[#e0e2e0] dark:border-[#444746] py-1.5 z-50 text-xs text-[#1f1f1f] dark:text-[#e3e3e3]">
                    <button
                      onClick={() => handleAction('format_bold')}
                      className="w-full text-left px-4 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#333538] flex items-center justify-between font-bold"
                    >
                      <span>Bold</span>
                      <span className="text-[#727775] text-[10px] font-normal">Ctrl+B</span>
                    </button>
                    <button
                      onClick={() => handleAction('format_italic')}
                      className="w-full text-left px-4 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#333538] flex items-center justify-between italic"
                    >
                      <span>Italic</span>
                      <span className="text-[#727775] text-[10px] font-normal">Ctrl+I</span>
                    </button>
                    <button
                      onClick={() => handleAction('format_underline')}
                      className="w-full text-left px-4 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#333538] flex items-center justify-between underline"
                    >
                      <span>Underline</span>
                      <span className="text-[#727775] text-[10px] font-normal">Ctrl+U</span>
                    </button>
                    <button
                      onClick={() => handleAction('format_strike')}
                      className="w-full text-left px-4 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#333538] line-through"
                    >
                      Strikethrough
                    </button>
                    <div className="border-t border-[#e0e2e0] dark:border-[#444746] my-1" />
                    <button
                      onClick={() => handleAction('clear_formatting')}
                      className="w-full text-left px-4 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#333538] flex items-center justify-between"
                    >
                      <span>Clear formatting</span>
                      <span className="text-[#727775] text-[10px]">Ctrl+\</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Tools Menu */}
              <div className="relative">
                <button
                  onClick={() => setActiveMenu(activeMenu === 'tools' ? null : 'tools')}
                  onMouseEnter={() => activeMenu && setActiveMenu('tools')}
                  className={`px-2 py-0.5 text-xs font-medium rounded hover:bg-[#e0e8f6] dark:hover:bg-[#333538] transition-colors ${
                    activeMenu === 'tools'
                      ? 'bg-[#d3e3fd] text-[#041e49] dark:bg-[#004a77] dark:text-[#c2e7ff]'
                      : 'text-[#444746] dark:text-[#c4c7c5]'
                  }`}
                >
                  Tools
                </button>
                {activeMenu === 'tools' && (
                  <div className="absolute left-0 top-full mt-1 w-56 bg-white dark:bg-[#282a2c] rounded-lg gdocs-dropdown-shadow border border-[#e0e2e0] dark:border-[#444746] py-1.5 z-50 text-xs text-[#1f1f1f] dark:text-[#e3e3e3]">
                    <button
                      onClick={() => handleAction('word_count')}
                      className="w-full text-left px-4 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#333538]"
                    >
                      Word count
                    </button>
                    <button
                      onClick={() => handleAction('spelling')}
                      className="w-full text-left px-4 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#333538]"
                    >
                      Spelling and grammar
                    </button>
                  </div>
                )}
              </div>

              {/* Help Menu */}
              <div className="relative">
                <button
                  onClick={() => setActiveMenu(activeMenu === 'help' ? null : 'help')}
                  onMouseEnter={() => activeMenu && setActiveMenu('help')}
                  className={`px-2 py-0.5 text-xs font-medium rounded hover:bg-[#e0e8f6] dark:hover:bg-[#333538] transition-colors ${
                    activeMenu === 'help'
                      ? 'bg-[#d3e3fd] text-[#041e49] dark:bg-[#004a77] dark:text-[#c2e7ff]'
                      : 'text-[#444746] dark:text-[#c4c7c5]'
                  }`}
                >
                  Help
                </button>
                {activeMenu === 'help' && (
                  <div className="absolute left-0 top-full mt-1 w-56 bg-white dark:bg-[#282a2c] rounded-lg gdocs-dropdown-shadow border border-[#e0e2e0] dark:border-[#444746] py-1.5 z-50 text-xs text-[#1f1f1f] dark:text-[#e3e3e3]">
                    <button
                      onClick={() => handleAction('help_shortcuts')}
                      className="w-full text-left px-4 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-[#333538] flex items-center justify-between"
                    >
                      <span>Keyboard shortcuts</span>
                      <span className="text-[#727775] text-[10px]">Ctrl+/</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Section: Collaborators Stack + Video + Primary Share Button (Image 3) */}
        <div className="flex items-center gap-3">
          {/* Overlapping Collaborators Presence Circles Stack (Image 3) */}
          <div className="flex items-center -space-x-2 relative">
            {collaborators.map((collab, index) => {
              const initials = (collab.name || 'User')
                .split(' ')
                .map((n) => n[0])
                .join('')
                .substring(0, 2)
                .toUpperCase();
              const borderColor = collab.color || '#e91e63';

              return (
                <div
                  key={collab.id || index}
                  className="relative group cursor-pointer"
                  onMouseEnter={() => setHoveredAvatar(collab.id || index)}
                  onMouseLeave={() => setHoveredAvatar(null)}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shadow-sm transition-transform group-hover:scale-110 group-hover:z-30 relative"
                    style={{
                      backgroundColor: collab.color || '#4285f4',
                      border: `2.5px solid ${borderColor}`
                    }}
                  >
                    {collab.avatar ? (
                      <img
                        src={collab.avatar}
                        alt={collab.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span>{initials}</span>
                    )}

                    {/* Online Green Indicator Dot */}
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#34a853] border-2 border-white dark:border-[#1e1f20] rounded-full" />
                  </div>

                  {/* Hover Tooltip (Image 3) */}
                  {hoveredAvatar === (collab.id || index) && (
                    <div className="absolute top-full right-0 mt-2 z-50 bg-[#282a2c] text-white text-xs py-1.5 px-3 rounded-md shadow-lg whitespace-nowrap tooltip-animate pointer-events-none">
                      <div className="font-semibold">{collab.name || 'Anonymous User'}</div>
                      <div className="text-gray-300 text-[11px]">
                        {collab.email || `${collab.role || 'Editor'}`}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Video Call Icon */}
          <button
            onClick={() => handleAction('meet')}
            className="p-2 rounded-full text-[#444746] dark:text-[#c4c7c5] hover:bg-[#e0e8f6] dark:hover:bg-[#333538] transition-colors"
            title="Join a call or present to this meeting"
          >
            <Video className="w-5 h-5" />
          </button>

          {/* Comments History Icon */}
          <button
            onClick={() => handleAction('comments')}
            className="p-2 rounded-full text-[#444746] dark:text-[#c4c7c5] hover:bg-[#e0e8f6] dark:hover:bg-[#333538] transition-colors"
            title="Open comment history"
          >
            <MessageSquare className="w-5 h-5" />
          </button>

          {/* Primary Blue 'Share' Button (Image 3) */}
          <button
            onClick={onOpenShareModal}
            className="flex items-center gap-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white px-5 py-2 rounded-full font-medium text-sm shadow-sm transition-all hover:shadow hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            title="Share with people and groups"
          >
            <Lock className="w-4 h-4 stroke-[2.5]" />
            <span>Share</span>
          </button>

          {/* User Account & Profile Menu (Google Style) */}
          <UserProfileMenu
            currentUser={currentUser}
            currentRole={currentRole}
            onUpdateProfile={onUpdateProfile}
            onOpenAuthModal={onOpenAuthModal}
            onOpenDashboard={onOpenDashboard}
            onLogout={onLogout}
          />
        </div>
      </div>
    </header>
  );
}
