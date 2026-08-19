import React, { useState, useEffect } from 'react';
import { Plus, Search, Trash2, ArrowLeft, FileText, Clock } from 'lucide-react';
import { authManager } from '../auth/authManager.ts';
import type { DocumentMetadata } from '../types/index.ts';

export interface DocumentDashboardProps {
  onOpenDocument: (docId: string) => void;
  onNewDocument: () => void;
  onClose: () => void;
}

export default function DocumentDashboard({ onOpenDocument, onNewDocument, onClose }: DocumentDashboardProps) {
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadDocs();
  }, []);

  const loadDocs = () => {
    const list = authManager.listUserDocuments();
    setDocuments(list);
  };

  const handleDelete = (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    if (confirm('Delete this document from your recent list?')) {
      const updated = authManager.deleteDocumentFromLibrary(docId);
      setDocuments(updated);
    }
  };

  const filteredDocs = documents.filter((d) =>
    (d.title || 'Untitled document').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-40 bg-[#f8fafd] dark:bg-[#18191a] overflow-y-auto text-[#202124] dark:text-[#e3e3e3] text-xs animate-in fade-in duration-200 flex flex-col">
      {/* Top App Header */}
      <header className="bg-white dark:bg-[#1e1f20] border-b border-[#dadce0] dark:border-[#2e3032] px-4 sm:px-6 py-3 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors cursor-pointer"
            title="Back to current document"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-base shadow-xs flex-shrink-0">
              📄
            </div>
            <span className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white">
              Docsie
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="max-w-xl w-full mx-3 sm:mx-6 relative hidden sm:block">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents"
            className="w-full pl-10 pr-4 py-2 bg-[#f1f3f4] dark:bg-[#282a2c] focus:bg-white dark:focus:bg-[#1e1f20] rounded-full border border-transparent focus:border-blue-500 outline-none text-xs text-gray-900 dark:text-white transition-all shadow-inner"
          />
          <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-2.5" />
        </div>

        <div>
          <button
            onClick={onNewDocument}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-full font-medium flex items-center gap-1.5 shadow-sm hover:shadow transition cursor-pointer text-xs"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Document</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </header>

      {/* Mobile Search Bar */}
      <div className="p-4 sm:hidden bg-white dark:bg-[#1e1f20] border-b border-[#dadce0] dark:border-[#2e3032]">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents"
            className="w-full pl-9 pr-4 py-2 bg-[#f1f3f4] dark:bg-[#282a2c] rounded-full border border-transparent focus:border-blue-500 outline-none text-xs text-gray-900 dark:text-white"
          />
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-5xl w-full mx-auto p-4 sm:p-6 md:p-8 flex-1">
        {/* Start a new document section */}
        <div className="mb-8 sm:mb-10">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wider text-[11px]">
            Start a new document
          </h2>

          <div className="flex gap-4">
            <button
              onClick={onNewDocument}
              className="flex flex-col items-start group cursor-pointer"
            >
              <div className="w-32 sm:w-36 h-40 sm:h-48 bg-white dark:bg-[#282a2c] border border-[#dadce0] dark:border-[#3c4043] rounded-lg shadow-xs hover:shadow-md hover:border-blue-500 transition-all flex items-center justify-center relative overflow-hidden group-hover:scale-102">
                <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600">
                  <Plus className="w-7 h-7" />
                </div>
              </div>
              <span className="mt-2 text-xs font-medium text-gray-800 dark:text-gray-200">
                Blank document
              </span>
            </button>
          </div>
        </div>

        {/* Recent Documents Grid */}
        <div>
          <div className="flex items-center justify-between mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-[11px]">
              Recent documents ({filteredDocs.length})
            </h2>
          </div>

          {filteredDocs.length === 0 ? (
            <div className="py-16 text-center text-gray-500 dark:text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400 opacity-60" />
              <p className="font-medium text-sm">No recent documents found</p>
              <p className="text-[11px] mt-1">
                {searchQuery ? 'Try a different search query' : 'Create a new document to get started'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => onOpenDocument(doc.id)}
                  className="bg-white dark:bg-[#282a2c] border border-[#dadce0] dark:border-[#3c4043] rounded-xl overflow-hidden shadow-2xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div className="h-28 sm:h-32 bg-gray-50 dark:bg-[#1f2022] p-4 flex flex-col justify-between border-b border-gray-100 dark:border-gray-700 relative overflow-hidden">
                    <FileText className="w-6 h-6 text-blue-600" />
                    <p className="text-[10px] text-gray-400 line-clamp-3 italic">
                      {doc.snippet || 'No text preview available...'}
                    </p>
                  </div>

                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-xs text-gray-900 dark:text-white truncate" title={doc.title}>
                        {doc.title}
                      </div>
                      <button
                        onClick={(e) => handleDelete(e, doc.id)}
                        className="text-gray-400 hover:text-red-500 p-1 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(doc.lastModified).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
