/**
 * Core Type Definitions for Docsie (Google Docs Clone).
 */

export type UserRole = 'owner' | 'editor' | 'commenter' | 'viewer';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  color: string;
  avatar: string | null;
  role?: UserRole;
  isGuest?: boolean;
  isAuthenticated?: boolean;
}

export interface DocumentMetadata {
  id: string;
  title: string;
  snippet?: string;
  authorId?: string;
  authorName?: string;
  role?: UserRole;
  lastModified: number;
  starred?: boolean;
  generalAccess?: 'restricted' | 'anyoneWithLink' | 'anyone';
  generalRole?: UserRole;
}

export interface CommentReply {
  id: string;
  author: any;
  authorColor: string;
  text: string;
  createdAt: number;
}

export interface DocumentComment {
  id: string;
  author: any;
  authorColor: string;
  text: string;
  range: { index: number; length: number };
  createdAt: number;
  resolved: boolean;
  replies: CommentReply[];
}

export interface AccessRequest {
  id: string;
  userId: string;
  user: UserProfile;
  requestedRole: UserRole;
  timestamp: number;
  status: 'pending' | 'approved' | 'denied';
}

export interface RulerMargins {
  top?: number;
  bottom?: number;
  left: number;
  right: number;
  firstLineIndent: number;
}

export interface HeadingItem {
  id: string;
  text: string;
  level: number;
  index: number;
  slug: string;
}

export interface DocumentStats {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  paragraphs: number;
  readingTimeMinutes: number;
}
