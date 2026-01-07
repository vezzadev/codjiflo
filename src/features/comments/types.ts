export type CommentSide = "LEFT" | "RIGHT";

export interface CommentAuthor {
  id: string;
  login: string;
  avatarUrl: string;
}

export interface Comment {
  id: string;
  body: string;
  /** Pre-rendered HTML from SQLite artifact (preferred over runtime markdown parsing) */
  renderedHtml?: string;
  author: CommentAuthor;
  createdAt: Date;
  updatedAt: Date;
  path: string;
  line: number;
  side: CommentSide;
  position: number | null;
  inReplyTo?: string;
  isPending?: boolean;
}

export interface ReviewThread {
  id: string;
  path: string;
  line: number;
  side: CommentSide;
  comments: Comment[];
  isResolved: boolean;
}
