import React, { useEffect, useRef } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import '../collab/remoteCursors.css';
import { Eye } from 'lucide-react';
import type { RulerMargins } from '../types/index.ts';

export interface EditorCanvasProps {
  onQuillReady?: (quill: any) => void;
  isViewer?: boolean;
  onRequestEditAccess?: () => void;
  zoomLevel?: number;
  margins?: RulerMargins;
}

export function EditorCanvas({
  onQuillReady,
  isViewer = false,
  onRequestEditAccess,
  zoomLevel = 1.0,
  margins = { top: 72, right: 72, bottom: 72, left: 72, firstLineIndent: 0 }
}: EditorCanvasProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const quillInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!editorRef.current || quillInstanceRef.current) return;

    try {
      const Size = Quill.import('attributors/style/size') as any;
      if (Size) {
        Size.whitelist = ['10px', '12px', '14px', '15px', '16px', '18px', '22px', '28px', '36px', '48px', '72px'];
        Quill.register(Size, true);
      }

      const Font = Quill.import('attributors/style/font') as any;
      if (Font) {
        Font.whitelist = ['Roboto', 'Inter', 'Merriweather', 'Playfair Display', 'Lora', 'Montserrat', 'Fira Code', 'Caveat', 'Comic Neue'];
        Quill.register(Font, true);
      }
    } catch (_e) {}

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
  }, [onQuillReady]);

  useEffect(() => {
    if (quillInstanceRef.current) {
      quillInstanceRef.current.enable(!isViewer);
    }
  }, [isViewer]);

  return (
    <div className="flex-1 overflow-auto flex flex-col items-center bg-[#f8fafd] dark:bg-[#131314] px-2 sm:px-4 pb-24 transition-colors">
      {/* Viewing Only Warning Bar */}
      {isViewer && (
        <div className="w-full max-w-4xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 rounded-xl px-4 py-2 my-3 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200 animate-slide-down">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span><strong>Viewing only:</strong> You do not have permission to edit this document.</span>
          </div>
          <button
            onClick={onRequestEditAccess}
            className="bg-amber-700 hover:bg-amber-800 text-white px-3 py-1 rounded-md font-medium text-xs transition shadow-xs flex-shrink-0 cursor-pointer"
          >
            Request Edit Access
          </button>
        </div>
      )}

      {/* Paginated Paper Page */}
      <div
        className="w-full flex flex-col items-center transition-transform origin-top my-3 sm:my-6"
        style={{ transform: `scale(${zoomLevel})` }}
      >
        <div
          className="w-full max-w-[816px] min-h-[calc(100vh-160px)] sm:min-h-[1056px] bg-white dark:bg-[#1e1f20] shadow-sm sm:shadow-md dark:shadow-2xl rounded-xs sm:rounded-sm relative text-gray-900 dark:text-gray-100 transition-colors p-4 sm:p-12 md:p-16 border sm:border-0 border-gray-200 dark:border-gray-800"
          style={{
            paddingTop: `${Math.max(24, margins.top ?? 72)}px`,
            paddingRight: `${Math.max(16, margins.right)}px`,
            paddingBottom: `${Math.max(24, margins.bottom ?? 72)}px`,
            paddingLeft: `${Math.max(16, margins.left)}px`
          }}
        >
          {/* Header Area */}
          <div className="hidden sm:flex absolute top-6 left-12 right-12 justify-between text-[11px] text-gray-400 select-none opacity-50 hover:opacity-100 transition">
            <span>Google Docs Document</span>
            <span>Page 1 of 1</span>
          </div>

          {/* Quill Editor Mount */}
          <div ref={editorRef} className="min-h-[500px] sm:min-h-[900px] text-[15px] outline-none" />

          {/* Footer Area */}
          <div className="hidden sm:flex absolute bottom-6 left-12 right-12 justify-between text-[11px] text-gray-400 select-none opacity-50 hover:opacity-100 transition">
            <span>Confidential</span>
            <span>Page 1</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditorCanvas;
