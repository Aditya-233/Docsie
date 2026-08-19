/// <reference types="vite/client" />

declare module 'quill-cursors' {
  const QuillCursors: any;
  export default QuillCursors;
}

declare module 'y-webrtc' {
  export class WebrtcProvider {
    constructor(roomName: string, ydoc: any, opts?: any);
    awareness: any;
    destroy(): void;
  }
}

declare module 'y-quill' {
  export class QuillBinding {
    constructor(ytext: any, quill: any, awareness?: any);
    destroy(): void;
  }
}

declare module 'html-docx-js' {
  export function asBlob(html: string, options?: any): Blob;
}

declare module 'html2pdf.js' {
  export default function html2pdf(): any;
}
