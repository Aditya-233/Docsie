export interface DocumentItem {
  id: string;
  title: string;
  content?: string;
  owner: string;
  ownerEmail?: string;
  ownerAvatar?: string;
  updatedAt: number;
  createdAt: number;
  isStarred?: boolean;
  role?: "owner" | "editor" | "commenter" | "viewer";
  lastModifiedBy?: string;
  category?: "blank" | "proposal" | "resume" | "notes";
  thumbnail?: string;
}

export const PRE_RENDERED_DOC_IDS = [
  "demo",
  "new",
  "getting-started",
  "q3-planning-doc",
  "design-system-spec",
  "blank",
  "proposal",
  "resume",
  "notes",
] as const;

const STORAGE_KEY = "google_docs_clone_documents";

export const INITIAL_TEMPLATES: Array<{
  id: string;
  title: string;
  category: DocumentItem["category"];
  badge?: string;
  content: string;
}> = [
  {
    id: "blank",
    title: "Blank document",
    category: "blank",
    content: "<p></p>",
  },
  {
    id: "proposal",
    title: "Project proposal",
    category: "proposal",
    badge: "Work",
    content: `
      <h1>Project Proposal: Cloud Document Suite</h1>
      <h2>1. Executive Summary</h2>
      <p>This project introduces next-generation real-time CRDT collaborative document editing with seamless presence awareness, responsive pagination, and enterprise-grade reliability.</p>
      <h2>2. Project Goals</h2>
      <ul>
        <li>Sub-50ms peer-to-peer and cloud synchronization.</li>
        <li>Rich text, tables, outlines, and anchored comments.</li>
        <li>Role-based access controls (Owner, Editor, Commenter, Viewer).</li>
      </ul>
      <h2>3. Timeline & Deliverables</h2>
      <p>Phase 1 includes core editor rollout, followed by team workspaces and export pipelines.</p>
    `,
  },
  {
    id: "resume",
    title: "Resume",
    category: "resume",
    badge: "Personal",
    content: `
      <h1>Alex Rivera</h1>
      <p><strong>Senior Software Engineer</strong> | alex.rivera@example.com | San Francisco, CA</p>
      <hr />
      <h2>Experience</h2>
      <p><strong>Lead Frontend Architect</strong> &mdash; CloudScale Systems (2022 &ndash; Present)</p>
      <ul>
        <li>Architected real-time collaboration engines serving 1M+ active daily documents.</li>
        <li>Optimized DOM rendering performance and virtualized canvas layouts.</li>
      </ul>
      <h2>Skills</h2>
      <p>TypeScript, React 19, Next.js, Yjs, Tiptap, WebRTC, Tailwind CSS</p>
    `,
  },
  {
    id: "notes",
    title: "Meeting notes",
    category: "notes",
    badge: "Meeting",
    content: `
      <h1>Weekly Team Sync</h1>
      <p><em>Date: August 20, 2026 | Attendees: Alice, Bob, Charlie, Dana</em></p>
      <hr />
      <h2>Agenda</h2>
      <ol>
        <li>Product Roadmap Review</li>
        <li>Realtime CRDT Synchronizer Benchmarks</li>
        <li>Design System and Accessibility Checklist</li>
      </ol>
      <h2>Action Items</h2>
      <ul>
        <li><strong>Bob:</strong> Benchmark Yjs state vectors under heavy latency.</li>
        <li><strong>Alice:</strong> Finalize Google Docs navigation and outline integration.</li>
      </ul>
    `,
  },
];

const INITIAL_DOCS: DocumentItem[] = [
  {
    id: "getting-started",
    title: "Welcome to Google Docs Clone",
    owner: "me",
    ownerEmail: "user@example.com",
    updatedAt: Date.now() - 1000 * 60 * 15,
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
    isStarred: true,
    role: "owner",
    lastModifiedBy: "me",
    category: "blank",
    content: `
      <h1>Welcome to the Real-Time Google Docs Clone! 🚀</h1>
      <p>This application gives you full Google Docs editing and collaboration power built right into your browser.</p>
      <h2>Features Included:</h2>
      <ul>
        <li><strong>Real-Time Multi-User Collaboration</strong>: Powered by Yjs CRDT synchronization.</li>
        <li><strong>Presence & Remote Cursors</strong>: See team members typing live with distinct color carets and tags.</li>
        <li><strong>Outline & Headings</strong>: Navigate large documents effortlessly via the collapsible outline sidebar.</li>
        <li><strong>Threaded Comments</strong>: Add discussions and resolve comment threads.</li>
        <li><strong>Role-Based Access</strong>: Viewer mode with interactive <em>"Request Edit Access"</em> permission escalation.</li>
      </ul>
      <p>Start typing or invite collaborators using the Share button above!</p>
    `,
  },
  {
    id: "q3-planning-doc",
    title: "Q3 Strategic Engineering Roadmap",
    owner: "Sarah Connor",
    ownerEmail: "sarah.c@techcorp.io",
    updatedAt: Date.now() - 1000 * 60 * 60 * 3,
    createdAt: Date.now() - 1000 * 60 * 60 * 72,
    isStarred: false,
    role: "editor",
    lastModifiedBy: "Sarah Connor",
    category: "proposal",
    content: `
      <h1>Q3 Strategic Engineering Roadmap</h1>
      <h2>Infrastructure & Scaling</h2>
      <p>Targeting 99.99% availability and regional edge document replication across multi-region clusters.</p>
    `,
  },
  {
    id: "design-system-spec",
    title: "Design System Guidelines v2.4",
    owner: "Design Team",
    ownerEmail: "design@techcorp.io",
    updatedAt: Date.now() - 1000 * 60 * 60 * 28,
    createdAt: Date.now() - 1000 * 60 * 60 * 120,
    isStarred: true,
    role: "viewer",
    lastModifiedBy: "David Kim",
    category: "blank",
    content: `
      <h1>Design System Guidelines v2.4</h1>
      <p>Official Google Material & Docs typography scales, elevation standards, and accessibility contrast tokens.</p>
    `,
  },
];

export function getLocalDocuments(): DocumentItem[] {
  if (typeof window === "undefined") return INITIAL_DOCS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DOCS));
      return INITIAL_DOCS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_DOCS;
  }
}

export function saveLocalDocuments(docs: DocumentItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
  } catch (err) {
    console.error("Failed to save documents to localStorage", err);
  }
}

export function getLocalDocument(id: string): DocumentItem | null {
  const docs = getLocalDocuments();
  const found = docs.find((d) => d.id === id);
  if (found) return found;

  // Check if template match
  const template = INITIAL_TEMPLATES.find((t) => t.id === id);
  if (template) {
    return {
      id: template.id,
      title: template.title,
      content: template.content,
      owner: "me",
      ownerEmail: "user@example.com",
      updatedAt: Date.now(),
      createdAt: Date.now(),
      isStarred: false,
      role: "owner",
      category: template.category,
    };
  }

  return null;
}

export function saveLocalDocument(doc: DocumentItem): void {
  const docs = getLocalDocuments();
  const idx = docs.findIndex((d) => d.id === doc.id);
  if (idx >= 0) {
    docs[idx] = { ...docs[idx], ...doc, updatedAt: Date.now() };
  } else {
    docs.unshift({ ...doc, updatedAt: Date.now(), createdAt: doc.createdAt || Date.now() });
  }
  saveLocalDocuments(docs);
}

export function deleteLocalDocument(id: string): void {
  const docs = getLocalDocuments();
  const filtered = docs.filter((d) => d.id !== id);
  saveLocalDocuments(filtered);
}

export function toggleStarDocument(id: string): boolean {
  const docs = getLocalDocuments();
  const doc = docs.find((d) => d.id === id);
  if (!doc) return false;
  doc.isStarred = !doc.isStarred;
  saveLocalDocuments(docs);
  return doc.isStarred;
}

export function renameDocument(id: string, newTitle: string): void {
  const docs = getLocalDocuments();
  const doc = docs.find((d) => d.id === id);
  if (doc) {
    doc.title = newTitle.trim() || "Untitled document";
    doc.updatedAt = Date.now();
    saveLocalDocuments(docs);
  }
}
