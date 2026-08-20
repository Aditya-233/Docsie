/**
 * Core TypeScript definitions for Next.js Google Docs Clone
 */

export type UserRole = 'owner' | 'editor' | 'viewer' | 'commenter';

export type PageFormat = 'letter' | 'a4' | 'legal' | 'tabloid';

export interface PageFormatDimensions {
  width: string;
  minHeight: string;
  padding: string;
}

export const PAGE_FORMATS: Record<PageFormat, PageFormatDimensions> = {
  letter: {
    width: '816px', // 8.5in at 96 DPI
    minHeight: '1056px', // 11in at 96 DPI
    padding: '96px', // 1in margin
  },
  a4: {
    width: '794px', // 210mm at 96 DPI
    minHeight: '1123px', // 297mm at 96 DPI
    padding: '96px',
  },
  legal: {
    width: '816px', // 8.5in at 96 DPI
    minHeight: '1344px', // 14in at 96 DPI
    padding: '96px',
  },
  tabloid: {
    width: '1056px', // 11in at 96 DPI
    minHeight: '1632px', // 17in at 96 DPI
    padding: '96px',
  },
};

export interface UserProfile {
  id: string;
  email?: string;
  name?: string;
  full_name?: string;
  avatar_url?: string;
  color?: string;
  role?: UserRole;
}

export interface DocumentMetadata {
  id: string;
  title: string;
  owner_id: string | null;
  page_format: PageFormat;
  created_at: string;
  updated_at: string;
  is_public?: boolean;
}

export interface DocumentCollaborator {
  document_id: string;
  user_id: string;
  role: UserRole;
  created_at?: string;
  user?: UserProfile;
}

export interface CursorPosition {
  anchor: number;
  head: number;
}

export interface CollaboratorPeer {
  clientId: number;
  user: UserProfile;
  cursor?: CursorPosition | null;
  selection?: {
    anchor: number;
    head: number;
  } | null;
  color?: string;
  lastUpdated?: number;
}

export interface CommentReply {
  id: string;
  comment_id: string;
  author_id: string | null;
  content: string;
  created_at: string;
  updated_at?: string;
  author?: UserProfile;
}

export interface CommentThread {
  id: string;
  document_id: string;
  author_id: string | null;
  mark_id: string;
  content: string;
  resolved: boolean;
  created_at: string;
  updated_at: string;
  author?: UserProfile;
  replies?: CommentReply[];
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  state: Uint8Array | string | number[];
  version_name: string;
  created_by: string | null;
  created_at: string;
  creator?: UserProfile;
}

export interface YjsDocumentRecord {
  room: string;
  state: Uint8Array | string;
  updated_at: string;
}
