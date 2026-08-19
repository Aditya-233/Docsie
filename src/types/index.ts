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

export interface CommentAuthor {
  id?: string;
  name: string;
  color?: string;
  avatar?: string | null;
}

export interface CommentReply {
  id: string;
  author: CommentAuthor | string;
  authorColor: string;
  text: string;
  createdAt: number;
}

export interface DocumentComment {
  id: string;
  author: CommentAuthor | string;
  authorColor: string;
  text: string;
  range: { index: number; length: number };
  createdAt: number;
  resolved: boolean;
  replies: CommentReply[];
  status?: 'open' | 'resolved';
  anchorRange?: { index: number; length: number };
  anchorText?: string;
}

export interface AccessRequestItem {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  avatarColor?: string;
  user?: UserProfile;
  requestedRole?: UserRole;
  timestamp: string | number;
  status: 'pending' | 'approved' | 'denied';
}

export interface CollaboratorPeer extends UserProfile {
  isSelf?: boolean;
  lastSeen?: number;
  selection?: { index: number; length: number };
  cursorRange?: { index: number; length: number };
  cursorCoords?: { top: number; left: number; height: number };
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
