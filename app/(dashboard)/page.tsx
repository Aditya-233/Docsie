"use client";

import { useState, useEffect, useMemo, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  MoreVertical,
  Star,
  Trash2,
  Edit3,
  LayoutGrid,
  List,
  FileText,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Folder,
  ExternalLink,
} from "lucide-react";
import {
  DocumentItem,
  INITIAL_TEMPLATES,
  getLocalDocuments,
  saveLocalDocument,
  deleteLocalDocument,
  toggleStarDocument,
  renameDocument,
} from "@/lib/storage";
import { generateId, formatDate } from "@/lib/utils";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [ownerFilter, setOwnerFilter] = useState<"all" | "me" | "others">("all");
  const [sortBy, setSortBy] = useState<"updatedAt" | "title">("updatedAt");
  const [templateGalleryOpen, setTemplateGalleryOpen] = useState(true);

  // Modals state
  const [renameModalDoc, setRenameModalDoc] = useState<DocumentItem | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [deleteModalDoc, setDeleteModalDoc] = useState<DocumentItem | null>(null);
  const [activeMenuDocId, setActiveMenuDocId] = useState<string | null>(null);

  const query = searchParams?.get("q")?.toLowerCase() || "";

  useEffect(() => {
    const docs = getLocalDocuments();
    setDocuments(docs);
    setIsLoaded(true);
  }, []);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveMenuDocId(null);
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const handleCreateDocument = (templateId?: string) => {
    const newId = `doc-${generateId()}`;
    let title = "Untitled document";
    let content = "<p></p>";
    let category: DocumentItem["category"] = "blank";

    if (templateId) {
      const tmpl = INITIAL_TEMPLATES.find((t) => t.id === templateId);
      if (tmpl) {
        title = tmpl.id === "blank" ? "Untitled document" : tmpl.title;
        content = tmpl.content;
        category = tmpl.category;
      }
    }

    const newDoc: DocumentItem = {
      id: newId,
      title,
      content,
      owner: "me",
      ownerEmail: "user@example.com",
      updatedAt: Date.now(),
      createdAt: Date.now(),
      isStarred: false,
      role: "owner",
      category,
    };

    saveLocalDocument(newDoc);
    startTransition(() => {
      router.push(`/doc/${newId}`);
    });
  };

  const handleToggleStar = (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    e.preventDefault();
    toggleStarDocument(docId);
    setDocuments(getLocalDocuments());
  };

  const handleOpenRename = (e: React.MouseEvent, doc: DocumentItem) => {
    e.stopPropagation();
    e.preventDefault();
    setRenameModalDoc(doc);
    setRenameInput(doc.title);
    setActiveMenuDocId(null);
  };

  const handleSaveRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (renameModalDoc && renameInput.trim()) {
      renameDocument(renameModalDoc.id, renameInput.trim());
      setDocuments(getLocalDocuments());
      setRenameModalDoc(null);
    }
  };

  const handleOpenDelete = (e: React.MouseEvent, doc: DocumentItem) => {
    e.stopPropagation();
    e.preventDefault();
    setDeleteModalDoc(doc);
    setActiveMenuDocId(null);
  };

  const handleConfirmDelete = () => {
    if (deleteModalDoc) {
      deleteLocalDocument(deleteModalDoc.id);
      setDocuments(getLocalDocuments());
      setDeleteModalDoc(null);
    }
  };

  // Filter & sort docs
  const filteredDocuments = useMemo(() => {
    return documents
      .filter((doc) => {
        // Search filter
        if (query) {
          const matchTitle = doc.title.toLowerCase().includes(query);
          const matchOwner = doc.owner.toLowerCase().includes(query);
          if (!matchTitle && !matchOwner) return false;
        }
        // Owner filter
        if (ownerFilter === "me" && doc.owner !== "me") return false;
        if (ownerFilter === "others" && doc.owner === "me") return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "title") {
          return a.title.localeCompare(b.title);
        }
        return b.updatedAt - a.updatedAt;
      });
  }, [documents, query, ownerFilter, sortBy]);

  return (
    <div className="flex-1 pb-16">
      {/* "Start a new document" Template Section */}
      <section className="bg-[#f1f3f4] border-b border-[#dadce0] transition-all duration-300">
        <div className="max-w-[1050px] mx-auto px-4 py-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-[#202124]">
              Start a new document
            </span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setTemplateGalleryOpen(!templateGalleryOpen)}
                className="flex items-center space-x-1 text-xs font-medium text-[#5f6368] hover:text-[#202124] hover:bg-gray-200/70 px-2.5 py-1.5 rounded-md transition-colors"
              >
                <span>Template gallery</span>
                {templateGalleryOpen ? (
                  <ChevronUp className="w-4 h-4 text-[#5f6368]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#5f6368]" />
                )}
              </button>
            </div>
          </div>

          {templateGalleryOpen && (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-4 animate-in fade-in duration-200">
              {/* Blank document card */}
              <div className="flex flex-col group">
                <button
                  type="button"
                  onClick={() => handleCreateDocument("blank")}
                  className="w-full aspect-[3/4] bg-white border border-[#dadce0] rounded-sm hover:border-[#1a73e8] hover:shadow-md transition-all flex items-center justify-center relative overflow-hidden group-hover:scale-[1.01]"
                >
                  <div className="w-12 h-12 flex items-center justify-center">
                    <svg viewBox="0 0 48 48" className="w-10 h-10">
                      <path
                        fill="#EA4335"
                        d="M24 13v22M24 13h11M24 13H13"
                        stroke="#4285F4"
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                      <path
                        fill="#34A853"
                        d="M13 24h22"
                        stroke="#EA4335"
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                      <path
                        d="M24 13v22"
                        stroke="#FBBC05"
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                      <path
                        d="M13 24h22"
                        stroke="#34A853"
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </button>
                <span className="text-xs font-medium text-[#202124] mt-2 group-hover:text-[#1a73e8] transition-colors truncate">
                  Blank document
                </span>
              </div>

              {/* Project Proposal */}
              <div className="flex flex-col group">
                <button
                  type="button"
                  onClick={() => handleCreateDocument("proposal")}
                  className="w-full aspect-[3/4] bg-white border border-[#dadce0] rounded-sm hover:border-[#1a73e8] hover:shadow-md transition-all p-3 flex flex-col justify-between text-left relative overflow-hidden group-hover:scale-[1.01]"
                >
                  <div className="space-y-1.5 pointer-events-none opacity-80">
                    <div className="w-16 h-2 bg-[#1a73e8] rounded-xs" />
                    <div className="w-full h-1 bg-gray-300 rounded-xs" />
                    <div className="w-4/5 h-1 bg-gray-200 rounded-xs" />
                    <div className="w-full h-1 bg-gray-200 rounded-xs" />
                    <div className="w-2/3 h-1 bg-gray-200 rounded-xs mt-3" />
                  </div>
                  <div className="text-[9px] font-semibold tracking-wider text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded self-start">
                    WORK
                  </div>
                </button>
                <span className="text-xs font-medium text-[#202124] mt-2 group-hover:text-[#1a73e8] transition-colors truncate">
                  Project proposal
                </span>
                <span className="text-[11px] text-[#5f6368] truncate">Tropic</span>
              </div>

              {/* Resume */}
              <div className="flex flex-col group">
                <button
                  type="button"
                  onClick={() => handleCreateDocument("resume")}
                  className="w-full aspect-[3/4] bg-white border border-[#dadce0] rounded-sm hover:border-[#1a73e8] hover:shadow-md transition-all p-3 flex flex-col justify-between text-left relative overflow-hidden group-hover:scale-[1.01]"
                >
                  <div className="space-y-1.5 pointer-events-none opacity-80">
                    <div className="w-12 h-2.5 bg-gray-800 rounded-xs" />
                    <div className="w-20 h-1 bg-gray-400 rounded-xs" />
                    <div className="w-full h-[0.5px] bg-gray-300 my-1" />
                    <div className="w-full h-1 bg-gray-200 rounded-xs" />
                    <div className="w-3/4 h-1 bg-gray-200 rounded-xs" />
                  </div>
                  <div className="text-[9px] font-semibold tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded self-start">
                    PERSONAL
                  </div>
                </button>
                <span className="text-xs font-medium text-[#202124] mt-2 group-hover:text-[#1a73e8] transition-colors truncate">
                  Resume
                </span>
                <span className="text-[11px] text-[#5f6368] truncate">Modern Serif</span>
              </div>

              {/* Meeting Notes */}
              <div className="flex flex-col group">
                <button
                  type="button"
                  onClick={() => handleCreateDocument("notes")}
                  className="w-full aspect-[3/4] bg-white border border-[#dadce0] rounded-sm hover:border-[#1a73e8] hover:shadow-md transition-all p-3 flex flex-col justify-between text-left relative overflow-hidden group-hover:scale-[1.01]"
                >
                  <div className="space-y-1.5 pointer-events-none opacity-80">
                    <div className="w-14 h-2 bg-purple-600 rounded-xs" />
                    <div className="w-full h-1 bg-gray-300 rounded-xs" />
                    <div className="flex items-center gap-1 mt-2">
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                      <div className="w-3/4 h-1 bg-gray-200 rounded-xs" />
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                      <div className="w-1/2 h-1 bg-gray-200 rounded-xs" />
                    </div>
                  </div>
                  <div className="text-[9px] font-semibold tracking-wider text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded self-start">
                    MEETING
                  </div>
                </button>
                <span className="text-xs font-medium text-[#202124] mt-2 group-hover:text-[#1a73e8] transition-colors truncate">
                  Meeting notes
                </span>
                <span className="text-[11px] text-[#5f6368] truncate">Simple Agenda</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Documents Repository List / Grid */}
      <section className="max-w-[1050px] mx-auto px-4 mt-6">
        {/* Controls bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-transparent">
          {/* Left: Filter dropdown */}
          <div className="flex items-center space-x-4">
            <span className="text-base font-medium text-[#202124]">
              {query ? `Search results for "${query}"` : "Recent documents"}
            </span>

            <select
              value={ownerFilter}
              aria-label="Filter documents by owner"
              onChange={(e) => setOwnerFilter(e.target.value as any)}
              className="text-xs font-medium text-[#5f6368] bg-transparent hover:bg-gray-200/60 py-1.5 px-2 rounded-md border-none outline-none cursor-pointer"
            >
              <option value="all">Owned by anyone</option>
              <option value="me">Owned by me</option>
              <option value="others">Not owned by me</option>
            </select>
          </div>

          {/* Right: View Mode & Sorting */}
          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={() =>
                setSortBy((prev) => (prev === "updatedAt" ? "title" : "updatedAt"))
              }
              className="p-2 rounded-full text-[#5f6368] hover:bg-gray-100 transition-colors"
              title={
                sortBy === "updatedAt"
                  ? "Sort by: Last modified"
                  : "Sort by: Title"
              }
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-full transition-colors ${
                viewMode === "grid"
                  ? "bg-blue-50 text-[#1a73e8]"
                  : "text-[#5f6368] hover:bg-gray-100"
              }`}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-full transition-colors ${
                viewMode === "list"
                  ? "bg-blue-50 text-[#1a73e8]"
                  : "text-[#5f6368] hover:bg-gray-100"
              }`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => handleCreateDocument()}
              className="p-2 rounded-full text-[#5f6368] hover:bg-gray-100 transition-colors"
              title="Open file picker"
            >
              <Folder className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Empty state */}
        {isLoaded && filteredDocuments.length === 0 && (
          <div className="text-center py-16 bg-white border border-[#dadce0] rounded-xl my-6">
            <FileText className="w-12 h-12 text-[#9aa0a6] mx-auto mb-3 stroke-[1.5]" />
            <h3 className="text-base font-medium text-[#202124]">
              {query ? "No documents match your search" : "No text documents yet"}
            </h3>
            <p className="text-xs text-[#5f6368] mt-1 max-w-sm mx-auto">
              {query
                ? "Check your spelling or try searching for another term."
                : "Click + to create a new document or pick a template above."}
            </p>
            <button
              onClick={() => handleCreateDocument()}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white text-sm font-medium rounded-full shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> Create new document
            </button>
          </div>
        )}

        {/* Grid View */}
        {viewMode === "grid" && filteredDocuments.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-4">
            {filteredDocuments.map((doc) => (
              <div
                key={doc.id}
                onClick={() => router.push(`/doc/${doc.id}`)}
                className="bg-white border border-[#dadce0] hover:border-[#1a73e8] rounded-md overflow-hidden cursor-pointer shadow-xs hover:shadow-md transition-all flex flex-col group"
              >
                {/* Document Thumbnail Preview */}
                <div className="h-40 bg-[#f8fafd] border-b border-[#dadce0] p-4 flex flex-col justify-start relative overflow-hidden group-hover:bg-[#f1f4f9] transition-colors">
                  <div className="text-[10px] text-gray-400 font-serif leading-relaxed line-clamp-6 select-none opacity-70">
                    <p className="font-semibold text-gray-600 mb-1">{doc.title}</p>
                    {doc.content
                      ? doc.content.replace(/<[^>]+>/g, " ")
                      : "Start typing here to create your document content and collaborate in real-time."}
                  </div>
                </div>

                {/* Card Meta Footer */}
                <div className="p-3 bg-white flex flex-col justify-between flex-1">
                  <div className="flex items-start justify-between gap-1">
                    <h4 className="text-sm font-medium text-[#202124] truncate group-hover:text-[#1a73e8] transition-colors flex-1">
                      {doc.title}
                    </h4>
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 text-[11px] text-[#5f6368]">
                    <div className="flex items-center space-x-1.5 truncate">
                      <div className="w-3.5 h-4 bg-[#2684fc] rounded-xs flex items-center justify-center shrink-0">
                        <FileText className="w-2.5 h-2.5 text-white" />
                      </div>
                      <span className="truncate">{formatDate(doc.updatedAt)}</span>
                    </div>

                    <div className="flex items-center space-x-0.5">
                      <button
                        type="button"
                        onClick={(e) => handleToggleStar(e, doc.id)}
                        className={`p-1 rounded-full hover:bg-gray-100 transition-colors ${
                          doc.isStarred ? "text-amber-500 fill-amber-500" : "text-gray-400"
                        }`}
                        title={doc.isStarred ? "Starred" : "Star"}
                      >
                        <Star className={`w-3.5 h-3.5 ${doc.isStarred ? "fill-amber-400 text-amber-500" : ""}`} />
                      </button>

                      {/* Dropdown Menu */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setActiveMenuDocId(activeMenuDocId === doc.id ? null : doc.id);
                          }}
                          className="p-1 rounded-full text-[#5f6368] hover:bg-gray-100 transition-colors"
                          title="More options"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>

                        {activeMenuDocId === doc.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 bottom-full mb-1 w-44 bg-white rounded-lg shadow-xl border border-gray-200 py-1.5 z-40 animate-in fade-in"
                          >
                            <button
                              type="button"
                              onClick={(e) => handleOpenRename(e, doc)}
                              className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-gray-500" /> Rename
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleOpenDelete(e, doc)}
                              className="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500" /> Remove
                            </button>
                            <a
                              href={`/doc/${doc.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-gray-500" /> Open in new tab
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* List View */}
        {viewMode === "list" && filteredDocuments.length > 0 && (
          <div className="mt-4 bg-white border border-[#dadce0] rounded-lg overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#dadce0] text-xs font-medium text-[#5f6368] bg-[#f8fafd]">
                  <th className="py-2.5 px-4">Title</th>
                  <th className="py-2.5 px-4 hidden sm:table-cell">Owner</th>
                  <th className="py-2.5 px-4 hidden md:table-cell">Last modified</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-[#202124]">
                {filteredDocuments.map((doc) => (
                  <tr
                    key={doc.id}
                    onClick={() => router.push(`/doc/${doc.id}`)}
                    className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                  >
                    <td className="py-3 px-4 flex items-center space-x-3">
                      <div className="w-5 h-6 bg-[#2684fc] rounded-xs flex items-center justify-center shrink-0">
                        <FileText className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="font-medium text-[#202124] group-hover:text-[#1a73e8] transition-colors truncate max-w-xs">
                        {doc.title}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#5f6368] hidden sm:table-cell">
                      {doc.owner === "me" ? "me" : doc.owner}
                    </td>
                    <td className="py-3 px-4 text-[#5f6368] hidden md:table-cell">
                      {formatDate(doc.updatedAt)}
                    </td>
                    <td
                      className="py-3 px-4 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          type="button"
                          onClick={(e) => handleToggleStar(e, doc.id)}
                          className={`p-1.5 rounded-full hover:bg-gray-100 transition-colors ${
                            doc.isStarred ? "text-amber-500 fill-amber-500" : "text-gray-400"
                          }`}
                          title="Star"
                        >
                          <Star className={`w-4 h-4 ${doc.isStarred ? "fill-amber-400 text-amber-500" : ""}`} />
                        </button>

                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuDocId(activeMenuDocId === doc.id ? null : doc.id);
                            }}
                            className="p-1.5 rounded-full text-[#5f6368] hover:bg-gray-100 transition-colors"
                            title="More options"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {activeMenuDocId === doc.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-xl border border-gray-200 py-1.5 z-40 animate-in fade-in"
                            >
                              <button
                                type="button"
                                onClick={(e) => handleOpenRename(e, doc)}
                                className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-gray-500" /> Rename
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleOpenDelete(e, doc)}
                                className="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" /> Remove
                              </button>
                              <a
                                href={`/doc/${doc.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-gray-500" /> Open in new tab
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Floating Action Button for Mobile/Quick Create */}
      <button
        onClick={() => handleCreateDocument()}
        className="fixed bottom-6 right-6 w-14 h-14 bg-white hover:bg-gray-50 text-[#1a73e8] rounded-2xl shadow-lg hover:shadow-2xl border border-gray-100 flex items-center justify-center transition-all hover:scale-105 group focus:outline-none focus:ring-4 focus:ring-blue-100"
        title="Create new document"
      >
        <Plus className="w-8 h-8 text-[#1a73e8] group-hover:rotate-90 transition-transform duration-200" />
      </button>

      {/* Rename Dialog Modal */}
      {renameModalDoc && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <h3 className="text-lg font-medium text-[#202124] mb-3">Rename document</h3>
            <form onSubmit={handleSaveRename}>
              <input
                type="text"
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                autoFocus
                className="w-full px-3.5 py-2.5 border border-[#1a73e8] rounded-lg text-sm text-[#202124] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Document title"
              />
              <div className="flex items-center justify-end gap-2 mt-5">
                <button
                  type="button"
                  onClick={() => setRenameModalDoc(null)}
                  className="px-4 py-2 text-sm font-medium text-[#5f6368] hover:bg-gray-100 rounded-full transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!renameInput.trim()}
                  className="px-5 py-2 text-sm font-medium bg-[#1a73e8] hover:bg-[#1557b0] disabled:opacity-50 text-white rounded-full transition-colors shadow-xs"
                >
                  OK
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalDoc && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
            <h3 className="text-lg font-medium text-[#202124] mb-2">Move to trash?</h3>
            <p className="text-sm text-[#5f6368] mb-5">
              &quot;{deleteModalDoc.title}&quot; will be removed from your recent documents.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteModalDoc(null)}
                className="px-4 py-2 text-sm font-medium text-[#5f6368] hover:bg-gray-100 rounded-full transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors shadow-xs"
              >
                Move to trash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
