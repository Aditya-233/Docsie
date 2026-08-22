# Docsie

A high-performance, real-time collaborative document platform built with **SvelteKit 2**, **Svelte 5 Runes**, **Tiptap**, **Yjs CRDTs**, and **Supabase**.

## Features

- **Svelte 5 Reactivity**: Universal reactive state powered by Svelte 5 runes (`$state`, `$derived`).
- **Real-Time Collaboration**: Peer-to-peer and multi-user synchronized document editing using Yjs CRDTs and Supabase Realtime broadcast channels.
- **Rich Document Editor**: Headings, font family, font size, formatting, colors, task lists, and full table support.
- **Client-Side Export**: Export documents to **DOCX**, **Markdown**, **HTML**, **Plain Text**, and **PDF** directly in the browser.
- **Role-Based Access**: Granular permissions (Owner, Editor, Commenter, Viewer) with share links and token authorization.
- **Integrated Drawer & Outlines**: Automatic document outline generation, word/character statistics, comments, and version history.

## Tech Stack

- **Framework**: SvelteKit 2 + Svelte 5
- **Editor**: Tiptap 2 + ProseMirror
- **Realtime / CRDT**: Yjs + y-protocols + Supabase
- **Styling**: Tailwind CSS v4 + Lucide Icons
- **Build Tool**: Vite 6

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm or pnpm

### Installation & Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run type checks
npm run check

# Run full test suite
npm test

# Build for production
npm run build
```

## License

MIT
