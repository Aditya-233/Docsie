import { useEffect, useRef } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import '../collab/remoteCursors.css';
import { Eye } from 'lucide-react';

export function EditorCanvas({
  onQuillReady,
  isViewer = false,
  onRequestEditAccess,
  zoomLevel = 1.0,
  margins = { top: 72, right: 72, bottom: 72, left: 72 }
}) {
  const editorRef = useRef(null);
  const quillInstanceRef = useRef(null);

  useEffect(() => {
    if (!editorRef.current || quillInstanceRef.current) return;

    const Size = Quill.import('attributors/style/size');
    Size.whitelist = ['10px', '12px', '14px', '15px', '16px', '18px', '22px', '28px', '36px', '48px', '72px'];
    Quill.register(Size, true);

    const Font = Quill.import('attributors/style/font');
    Font.whitelist = ['Roboto', 'Inter', 'Merriweather', 'Playfair Display', 'Lora', 'Montserrat', 'Fira Code', 'Caveat', 'Comic Neue'];
    Quill.register(Font, true);

    const quill = new Quill(editorRef.current, {
      theme: 'snow',
      modules: {
        toolbar: false,
        cursors: true,
        table: true
      },
      placeholder: 'Type @ to insert, or start writing...'
    });

    quillInstanceRef.current = quill;

    if (onQuillReady) {
      onQuillReady(quill);
    }
  }, []);

  useEffect(() => {
    if (quillInstanceRef.current) {
      quillInstanceRef.current.enable(!isViewer);
    }
  }, [isViewer]);

  return (
    <div className="flex-1 overflow-auto flex flex-col items-center bg-[#f8fafd] dark:bg-[#131314] pb-24 transition-colors">
      
      {/* Viewing Only Warning Bar (When in Viewer mode) */}
      {isViewer && (
        <div className="w-full bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-800/60 px-6 py-2 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200 animate-slide-down">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span><strong>Viewing only:</strong> You do not have permission to edit this document directly.</span>
          </div>
          <button
            onClick={onRequestEditAccess}
            className="bg-amber-700 hover:bg-amber-800 text-white px-3 py-1 rounded-md font-medium text-xs transition shadow-xs"
          >
            Request Edit Access
          </button>
        </div>
      )}

      {/* Paginated Paper Page */}
      <div
        className="mt-6 flex flex-col items-center transition-transform origin-top"
        style={{ transform: `scale(${zoomLevel})` }}
      >
        <div
          className="w-[816px] min-h-[1056px] bg-white dark:bg-[#1e1f20] shadow-md dark:shadow-2xl rounded-xs relative text-gray-900 dark:text-gray-100 transition-colors"
          style={{
            padding: `${margins.top}px ${margins.right}px ${margins.bottom}px ${margins.left}px`
          }}
        >
          {/* Header Area */}
          <div className="absolute top-6 left-16 right-16 flex justify-between text-[11px] text-gray-400 select-none opacity-50 hover:opacity-100 transition">
            <span>Google Docs Document</span>
            <span>Page 1 of 1</span>
          </div>

          {/* Quill Editor Mount */}
          <div ref={editorRef} className="min-h-[900px] text-[15px] outline-none" />

          {/* Footer Area */}
          <div className="absolute bottom-6 left-16 right-16 flex justify-between text-[11px] text-gray-400 select-none opacity-50 hover:opacity-100 transition">
            <span>Confidential</span>
            <span>Page 1</span>
          </div>
        </div>
      </div>

    </div>
  );
}
