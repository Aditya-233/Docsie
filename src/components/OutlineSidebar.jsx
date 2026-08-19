import { ChevronLeft, ListTree } from 'lucide-react';

export function OutlineSidebar({
  isOpen,
  onClose,
  headings = [],
  onHeadingClick
}) {
  if (!isOpen) return null;

  return (
    <aside className="w-64 bg-white dark:bg-[#1e1f20] border-r border-gray-200 dark:border-gray-700 flex flex-col shrink-0 select-none transition-colors">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-200">
          <ListTree className="w-4 h-4 text-blue-600" />
          <span>Document outline</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          title="Close outline"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {headings.length === 0 ? (
          <div className="text-xs text-gray-400 text-center mt-8 px-4 leading-relaxed">
            Headings you add to the document will appear here.
          </div>
        ) : (
          headings.map((h, i) => (
            <div
              key={i}
              onClick={() => onHeadingClick && onHeadingClick(h)}
              className={`px-3 py-1.5 rounded-lg text-xs cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 truncate transition ${
                h.level === 1 ? 'font-semibold' : h.level === 2 ? 'pl-6' : 'pl-9 text-gray-500'
              }`}
            >
              {h.text}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
