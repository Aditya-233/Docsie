export type UserRole = "owner" | "editor" | "commenter" | "viewer";
export interface UserProfile { id: string; name?: string; email?: string; color?: string; avatar?: string; }
export interface CollaboratorPeer { clientId: number; user: UserProfile; cursor?: any; selection?: any; color: string; lastUpdated: number; }
export interface CommentReply { id: string; author: UserProfile; content: string; created_at: number | string; }
export interface CommentThread { id: string; author: UserProfile; authorEmail?: string; content: string; quotedText?: string; resolved: boolean; replies: CommentReply[]; created_at: number | string; }
export interface DocumentVersion { id: string; document_id?: string; name?: string; version_name?: string; snapshot_state?: Uint8Array | string; created_by?: string; createdBy?: string; created_at: number | string; }
export interface ShareTokenPayload { docId: string; role: UserRole; exp: number; }
