export interface DocumentItem { id: string; title: string; updatedAt: number; isStarred?: boolean; category?: string; content?: any; owner: string; }

export const INITIAL_TEMPLATES = [
    { id: 'blank', title: 'Blank document', category: 'General', content: '<p></p>' },
    { id: 'resume', title: 'Modern Resume', category: 'Personal', content: '<h1>[Your Name]</h1><p>Email | Phone | Location</p><h2>Experience</h2><p>Senior Developer</p>' },
    { id: 'project-proposal', title: 'Project Proposal', category: 'Work', content: '<h1>Project Proposal</h1><h2>Executive Summary</h2><p>Objectives and goals.</p>' },
    { id: 'meeting-notes', title: 'Meeting Notes', category: 'Work', content: '<h1>Meeting Notes</h1><p><strong>Date:</strong> Today</p><h2>Action Items</h2>' },
];

const STORAGE_KEY = 'docsie_documents';
function read(): Record<string, DocumentItem> { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; } }
function write(map: Record<string, DocumentItem>) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch { } }

export function getLocalDocuments(): DocumentItem[] {
    const map = read();
    if (!Object.keys(map).length && typeof window !== 'undefined') {
        INITIAL_TEMPLATES.slice(1).forEach((t, i) => {
            map[`template_${t.id}`] = { id: `template_${t.id}`, title: t.title, updatedAt: Date.now() - i * 3600000, category: t.category, content: t.content, owner: 'You' };
        });
        write(map);
    }
    return Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getLocalDocument(id: string): DocumentItem | null { return read()[id] || null; }
export function saveLocalDocument(doc: Partial<DocumentItem> & { id: string }) {
    const map = read(), prev = map[doc.id] || { id: doc.id, title: 'Untitled document', updatedAt: Date.now(), owner: 'You' };
    map[doc.id] = { ...prev, ...doc, updatedAt: Date.now() };
    write(map);
    return map[doc.id];
}
export function deleteLocalDocument(id: string) { const map = read(); delete map[id]; write(map); }
export function renameLocalDocument(id: string, title: string) { return saveLocalDocument({ id, title }); }
export function toggleStarLocalDocument(id: string) { const map = read(), doc = map[id]; if (doc) { doc.isStarred = !doc.isStarred; write(map); return doc.isStarred; } return false; }
