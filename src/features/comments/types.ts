export type CommentSide = "LEFT" | "RIGHT";

export interface CommentAuthor {
  id: string;
  login: string;
  avatarUrl: string;
}

export interface Comment {
  id: string;
  body: string;
  author: CommentAuthor;
  createdAt: Date;
  updatedAt: Date;
  path: string;
  /** Line number, or null if comment is outdated/unmappable */
  line: number | null;
  side: CommentSide;
  position: number | null;
  inReplyTo?: string;
  isPending?: boolean;
}

export interface ReviewThread {
  id: string;
  path: string;
  /** Line number, or null if thread is outdated/unmappable */
  line: number | null;
  side: CommentSide;
  comments: Comment[];
  isResolved: boolean;
}
