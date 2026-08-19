# Google Docs Clone — Production-Grade Modern Architecture

A full-featured, production-ready Google Docs application built with **React 19, Vite 6, Tailwind CSS v4, Yjs CRDT, y-webrtc, y-quill, quill-cursors, and Lucide Icons**.

---

## 🏗️ Clean Project Architecture

```
Compy/
├── index.html                               # Vite Application Entry Point
├── vite.config.js                           # Vite 6 + React + Tailwind v4 configuration
├── package.json                             # ESM Package specification & dependency manifest
├── .gitignore                               # Standard Git ignore rules
├── README.md                                # Comprehensive documentation & guide
│
├── src/                                     # Modern React Application Source
│   ├── main.jsx                             # React 19 DOM Root Mount
│   ├── App.jsx                              # Main Application Orchestrator & State Container
│   ├── index.css                            # Tailwind CSS v4 & Google Docs Theme Overrides
│   │
│   ├── components/                          # Modular React UI Components
│   │   ├── Header.jsx                       # Title, Star, Cloud Sync, Menubar, Presence Avatars, Share
│   │   ├── Toolbar.jsx                      # Rich text formatting, fonts, sizes, table picker, alignments
│   │   ├── Ruler.jsx                        # Interactive margin ruler with drag handles
│   │   ├── EditorCanvas.jsx                 # Paginated US Letter canvas, Quill mounting, viewer warnings
│   │   ├── ShareModal.jsx                   # Google Docs Share Modal (Restricted / Link Access, Roles)
│   │   ├── AccessRequestToast.jsx           # Live floating toast for permission requests & approval
│   │   ├── OutlineSidebar.jsx               # Heading (H1-H3) outline tree with jump-to-section
│   │   ├── CommentsSidebar.jsx              # Anchored comment threads, replies, and resolution
│   │   └── index.js                         # Barrel component exports
│   │
│   ├── collab/                              # Real-Time CRDT Collaboration Layer
│   │   ├── useYjsDoc.js                     # React Hook for Y.Doc, WebrtcProvider, IndexedDB, Awareness
│   │   ├── remoteCursors.css                # Google Docs remote carets with floating name tags
│   │   └── index.js                         # Collaboration module exports
│   │
│   ├── core/                                # Editor Typography & State Machine
│   │   └── editor.js                        # Font whitelists, format painter state machine, custom tables
│   │
│   ├── permissions/                         # Access Control & Link Encryption
│   │   ├── manager.js                       # Role hierarchy (Owner, Editor, Commenter, Viewer)
│   │   └── share.js                         # Share URL generator, parsing & collaborator roster
│   │
│   ├── storage/                             # Document Persistence & Version History
│   │   └── documentStore.js                 # LocalStorage repository, CRUD, snapshots, index
│   │
│   ├── export/                              # Multi-Format Exporters
│   │   └── exporter.js                      # PDF, Word (.docx), Markdown (.md), HTML5, Plain Text
│   │
│   ├── outline/                             # Document Outline & Live Statistics
│   │   └── outlineExtractor.js              # Heading extraction, slug generator, live word count
│   │
│   └── tools/                               # Editor Physical Tools
│       ├── findReplace.js                   # Find & Replace with regex and match cycling
│       └── ruler.js                         # Margin calculations and boundary constraints
│
├── tests/                                   # Complete Automated Test Suite (70 Tests)
│   ├── unit/
│   │   ├── editor_core.test.js              # Typography, format painter state machine, tables
│   │   ├── collaboration.test.js            # Protocol validation, packets, presence
│   │   ├── permissions.test.js              # Access control, role hierarchy, share links
│   │   ├── comments.test.js                 # Threaded comments, anchor range offset shifts
│   │   ├── core_modules.test.js             # Storage CRUD, snapshots, outline, export, find/replace, ruler
│   │   └── yjs_crdt_collab.test.js          # Yjs CRDT room derivation, permissions map, undo manager
│   │
│   └── integration/
│       ├── two_person_concurrent_writing.test.js # Exhaustive 2-person concurrent writing test
│       ├── collab_integration.test.js       # Multi-peer session lifecycle across roles
│       └── yjs_crdt_multi_tab.test.js       # 3-tab concurrent typing, awareness presence, role promotion
│
└── scripts/                                 # Developer Tools & Simulations
    ├── simulate_collab.js                   # Interactive CLI visual collaboration simulator
    └── serve.js                             # Local HTTP dev server
```

---

## 🧪 Testing & Verification

```bash
# Run all 70 unit and integration tests:
npm test

# Run Vite production build:
npm run build

# Start the Vite local development server:
npm run dev
```

---

## 👥 How to Test Multi-User Real-Time Collaboration Locally

1. **Start the local server:**
   ```bash
   npm run dev
   # App will start at: http://localhost:3000
   ```

2. **Open 3 Browser Tabs (or Split Windows):**
   - **Tab 1 (Owner - Alice)**:
     `http://localhost:3000/#doc=demo&role=owner&user=Alice`
   - **Tab 2 (Editor - Bob)**:
     `http://localhost:3000/#doc=demo&role=editor&user=Bob`
   - **Tab 3 (Viewer - Charlie)**:
     `http://localhost:3000/#doc=demo&role=viewer&user=Charlie`

3. **Verify All Real-Time Features:**
   - **Live Typing Sync**: Type in Tab 1; text appears in Tab 2 instantly with zero refresh.
   - **Remote Cursors & Selection**: In Tab 2, notice Alice's colored caret, floating name tag (`[Alice] |`), and highlighted selection spans.
   - **Top-Right Presence Circles**: In the top-right header, notice overlapping circular avatars with online green dots for all active collaborators.
   - **Live Edit Status**: Header displays *"Last edit was made seconds ago by [User]"*.
   - **Live Permission Request & Elevation**: In Tab 3 (Viewer), click *"Request Edit Access"*. Tab 1 (Alice) instantly receives a popup toast with an **Approve** button. Clicking **Approve** immediately promotes Charlie to Editor and unlocks the editor without reloading!
   - **Share Modal**: Click the blue **Share** button in the top right to open the Google Docs Share Modal with General Access (*Restricted* / *Anyone with the link*), Role selector (*Viewer*, *Commenter*, *Editor*), and *"Copy link"* action.
