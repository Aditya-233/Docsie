# Google Docs Clone — Next.js 15, Tiptap & Supabase Realtime Architecture

A full-featured, production-ready Google Docs collaborative platform built with **Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Tiptap (ProseMirror), Yjs CRDT, Supabase Realtime, PostgreSQL Auth & Storage**.

---

## 🏗️ Clean Project Architecture

```
Compy/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx               # Modern Auth Portal (Email/PW, Magic Link, OAuth, Guest)
│   │   └── auth/callback/route.ts       # OAuth Callback Exchange Handler
│   ├── (dashboard)/
│   │   ├── layout.tsx                   # Google Docs Top App Bar with search & User Avatar menu
│   │   └── page.tsx                     # Documents Dashboard (Templates, Grid/List view, Star, Trash)
│   ├── doc/
│   │   └── [docId]/
│   │       ├── page.tsx                 # Real-time Collaborative Document Canvas
│   │       └── loading.tsx              # Shimmering Skeleton Loader
│   ├── api/
│   │   └── export/route.ts              # Serverless DOCX, PDF, Markdown & HTML Exporter
│   ├── globals.css                      # Tailwind v4 theme, Google Docs typography & print styles
│   └── layout.tsx                       # Root App Layout with Google Fonts & Metadata
│
├── components/
│   ├── editor/
│   │   ├── editor.tsx                   # Tiptap ProseMirror mount + Collaboration + Carets
│   │   ├── toolbar.tsx                  # Google Docs floating toolbar (Fonts, Sizes, Colors, Tables)
│   │   ├── ruler.tsx                    # Interactive draggable margin handles (US Letter / A4)
│   │   ├── page-sheet.tsx               # Paginated 816px x 1056px white canvas with drop shadow
│   │   └── remote-caret.css             # Floating colored remote carets and selection spans
│   ├── document/
│   │   ├── share-modal.tsx              # Role switcher (Owner, Editor, Commenter, Viewer) & Share link
│   │   ├── outline-sidebar.tsx          # Real-time H1-H3 heading tree with jump-to-section & live stats
│   │   └── version-history-drawer.tsx   # Snapshot restorer and version audit log
│   └── comments/
│       ├── comments-sidebar.tsx         # Real-time threaded discussion drawer
│       └── comment-bubble.tsx           # Floating selection comment bubble
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                    # Browser client (@supabase/ssr) + fallback mock client
│   │   ├── server.ts                    # Server client (@supabase/ssr with async cookies)
│   │   └── provider.ts                  # Production Yjs Supabase Provider (SyncStep1/2, Awareness)
│   ├── editor/
│   │   ├── font-size.ts                 # Custom Tiptap font size extension (8pt - 96pt)
│   │   ├── line-height.ts               # Custom line spacing extension (Single, 1.15, 1.5, Double)
│   │   ├── indent.ts                    # Indentation controls with keyboard shortcuts
│   │   └── constants.ts                 # Fonts, color palettes, and page dimensions
│   ├── export/
│   │   ├── docx-generator.ts            # Tiptap AST to DOCX binary exporter
│   │   ├── pdf-generator.ts             # Formatted PDF generator with print media rules
│   │   ├── markdown-generator.ts        # GitHub Flavored Markdown serializer
│   │   └── html-generator.ts            # Standalone HTML5 document generator
│   └── utils.ts                         # Class merging and formatting utilities
│
├── supabase/
│   ├── migrations/
│   │   └── 20260820000000_initial_schema.sql # PostgreSQL DDL, RLS policies, triggers & buckets
│   └── config.toml                      # Supabase local development configuration
│
└── tests/                               # Comprehensive Automated Test Suite (62 Tests)
    ├── awareness.test.ts                # Awareness protocol, cursor tracking, and stale client timeout
    ├── exporter.test.ts                 # Markdown, HTML, Plain text, and DOCX generators
    ├── outline.test.ts                  # Heading extraction, slug generator, and live word counters
    ├── permissions.test.ts              # Role hierarchy, AccessControl matrix, and share URLs
    ├── provider.test.ts                 # Yjs 2-step sync protocol, delta exchange, and state compaction
    └── schema.test.ts                   # PostgreSQL DDL, RLS, indexes, and storage validation
```

---

## ⚡ Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables (Optional for Cloud Supabase)
Create a `.env.local` file:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```
*(Note: The app automatically falls back to robust local/in-memory collaboration if Supabase credentials are not provided).*

### 3. Run Development Server
```bash
npm run dev
# App will start at http://localhost:3000
```

### 4. Run Test Suite
```bash
npm test
```

### 5. Production Build
```bash
npm run build
```

---

## 👥 How to Test Multi-User Real-Time Collaboration

1. **Start the local server:**
   ```bash
   npm run dev
   ```

2. **Open 3 Browser Windows (or Incognito tabs):**
   - **User 1 (Alice - Owner)**: `http://localhost:3000/doc/demo`
   - **User 2 (Bob - Editor)**: `http://localhost:3000/doc/demo#role=editor&user=Bob`
   - **User 3 (Charlie - Viewer)**: `http://localhost:3000/doc/demo#role=viewer&user=Charlie`

3. **Verify Collaboration Features:**
   - **Live Typing Sync**: Type in Tab 1; text, tables, and lists appear in Tab 2 in real-time with zero conflict.
   - **Remote Cursors & Selection**: Notice colored carets with user name flags (`[Alice] |`) and highlighted text selection.
   - **Live Presence Avatars**: Top header displays active collaborators with status rings and initials.
   - **Threaded Comments**: Highlight text $\rightarrow$ click comment button $\rightarrow$ add reply or resolve.
   - **Heading Outline**: Insert H1/H2 headings; watch the Outline Sidebar update live and click to jump.
   - **Multi-Format Export**: Export to `.docx`, `.pdf`, `.md`, `.html`, or `.txt` via the File menu or toolbar.
