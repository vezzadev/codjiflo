# CodjiFlo Data Models Specification

This document defines the core domain entities for a clean-room reimplementation of CodjiFlo.

---

## Enums & Constants

```typescript
// Code Review Status
enum CodeReviewStatus {
  Created,
  Active,
  Completed,
  Aborted,
  Expired
}

// Reviewer Status
enum ReviewerStatus {
  NotStarted,
  Started,
  Reviewing,
  Waiting,
  SignedOff,
  InviteOnly,
  Declined
}

// Author Status
enum AuthorStatus {
  Preparing,
  Waiting,
  Working,
  Completed
}

// Iteration Status
enum IterationStatus {
  Submitted,
  Deleted
}

// Comment Thread Status
enum CommentThreadStatus {
  Active,
  Pending,
  Resolved,
  WontFix,
  Closed,
  ByDesign
}

// Comment Scope (Global vs File-specific)
enum CommentScope {
  File,
  Global
}

// Comment View Context (diff view perspective)
enum CommentViewContext {
  Both,
  LeftOnly,
  RightOnly
}

// Comment Feedback Type
enum CommentFeedbackType {
  NotUseful,
  Useful,
  DontUnderstand
}

// Code Package Format (platform-specific)
enum CodePackageFormat {
  ShelveSet,    // TFS/Azure DevOps
  PackFile      // Other VCS
}

// Code Package Status
enum CodePackageStatus {
  Submitted,
  Revoked
}
```

---

## Core Domain Models

### CodeReview (Main Aggregate Root)

```typescript
interface CodeReview {
  // Identifiers & Metadata
  key: string;
  name: string;
  projectShortName: string;

  // Participants
  author: Author;
  reviewers: Reviewer[];
  createdBy: string;

  // Status & Control
  status: CodeReviewStatus;
  isReadOnly: boolean;
  isActive: boolean;
  canWithdraw: boolean;
  canComplete: boolean;
  canExpire: boolean;
  displayStatus: string;

  // Versioning
  version: CodjiFloVersion;
  clientBuildVersion?: Version;

  // Content
  codePackages: CodePackage[];
  iterations: ReviewIteration[];
  threads: CommentThread[];
  relatedWorkItems: WorkItem[];

  // Derived Properties (computed)
  latestCodePackage?: CodePackage;
  latestIteration?: ReviewIteration;
  latestDescription?: string;
  allComments: Comment[];        // Flattened from all threads
  requiredReviewers: Reviewer[];
  optionalReviewers: Reviewer[];

  // Metadata
  customData: Record<string, string>;
  auditLog?: AuditLog;
  completionMessage?: string;

  // Tracking
  lastCommentId: number;
  lastCommentThreadId: number;
}

interface CodeReviewSummary {
  key: string;
  name: string;
  projectShortName: string;
  author: Author;
  authorId: string;
  reviewers: Reviewer[];
  status: CodeReviewStatus;
  revision: number;
  createdOn: Date;
  lastUpdatedOn: Date;
  completedOn: Date;
  workItems: WorkItem[];
  iterationCount: number;
  isActive: boolean;
  canRecall: boolean;
}
```

---

### ReviewIteration (Code Updates/Revisions)

```typescript
interface ReviewIteration {
  // Identifiers
  revision: number;                    // Sequential revision number (1-based)
  firstCodePackageIndex: number;       // Position in CodeReview.codePackages
  codePackageCount: number;

  // Metadata
  authorId: string;
  description: string;
  comment: string;
  submittedOn: Date;
  status: IterationStatus;

  // Content
  layers: Layer[];
  reviewAttachments: ReviewAttachment[];
}

```

**Suggested Limits:** Maximum ~20 attachments per iteration, ~30 MB per attachment.

---

### Comment & CommentThread (Discussion System)

```typescript
interface Comment {
  // Identifiers
  id: number;
  threadId: number;
  parentId: number;           // 0 for root comments

  // Content
  text: string;
  reviewer: string;

  // Metadata
  createdOn: Date;
  lastUpdatedOn: Date;

  // Flags
  withdrawn: boolean;
  isMachineGenerated: boolean;
  enableFeedback: boolean;
  enableMarkdown: boolean;

  // Interactions
  likes: Like[];
  feedbacks: CommentFeedback[];

  // Nesting
  children: Comment[];

  // Custom Data
  customData: Record<string, string>;
}

interface CommentThread {
  // Identifiers
  id: number;

  // Content
  root: Comment;              // Root comment of thread

  // Context (Where the thread applies)
  context: DiffContext;
  level: CommentScope;        // File or Global

  // Status
  status: CommentThreadStatus;
  withdrawn: boolean;
  isActive: boolean;          // Computed: status == Active && !withdrawn

  // Metadata
  createdOn: Date;            // Derived from root.createdOn
  lastUpdatedOn: Date;

  // Derived Properties
  allComments: Comment[];     // All comments in tree (flattened)
  postCount: number;          // Total comment count
}
```

---

### Participants

```typescript
interface Reviewer {
  // Identity
  id: string;               // Unique identity string
  displayName: string;
  emailAddress: string;

  // Status & Control
  status: ReviewerStatus;
  required: boolean;

  // Metadata
  lastUpdatedOn: Date;
}

interface Author {
  // Identity
  id: string;
  displayName: string;
  emailAddress: string;

  // Status
  status: AuthorStatus;

  // Metadata
  lastUpdatedOn: Date;
}

interface User {
  id: string;
  displayName: string;
  email: string;
  createdOn: Date;
  lastUpdatedOn: Date;
  settings: Record<string, string>;
}
```

---

### Diff & Context Models

```typescript
interface DiffContext {
  // Iteration References
  leftIteration: number;      // Iteration revision number
  rightIteration: number;

  // Spatial Reference
  region: FileRegion;

  // Presentation
  view: CommentViewContext;   // Both/LeftOnly/RightOnly

  // Tracking
  correlationData: string;

  // Legacy (Code Package References)
  leftCodePackageName?: string;
  rightCodePackageName?: string;
}

interface FileRegion {
  // File Reference
  fileName: string;

  // Position (1-based line numbers, 0-based character positions)
  startLine: number;
  startCharPos: number;
  endLine: number;
  endCharPos: number;
}
```

---

### Code Content Models

```typescript
interface CodePackage {
  // Identifiers
  name: string;
  revision: number;

  // Metadata
  author: string;
  description: string;
  format: CodePackageFormat;
  status: CodePackageStatus;
  location: string;           // URI
  submittedOn: Date;

  // Source Control Info
  sourceInfo?: CodePackageSourceInfo;

  // Content
  fileChanges: CodePackageFileChange[];
  layers: Layer[];
  folderTags?: Record<string, Tag[]>;
}

interface CodePackageSourceInfo {
  sourceName: string;
  serverUri: string;
  sourceControlSystem: string;
  clientName: string;
  reviewOption?: string;
  targetBranch?: string;
}

interface CodePackageFileChange {
  depotFilePath: string;
  changeType: string;         // "Add", "Edit", "Delete", "Rename", etc.
  tags?: Tag[];
}

interface Layer {
  id: string;                 // GUID
  type: string;
  displayName: string;
  description?: string;
  location: string;           // URI
  submittedBy?: string;
  submittedOn?: Date;
}

interface Tag {
  content: string;
  type?: string;
}
```

---

### Interactions & Feedback

```typescript
interface Like {
  createdOn: Date;
  user: string;
}

interface CommentFeedback {
  createdOn: Date;
  user: string;
  type: CommentFeedbackType;
}

interface ReviewAttachment {
  id?: string;                // GUID with optional extension
  displayName: string;
  authorId: string;
  location: string;           // URI
  submittedOn: Date;
  revision: number;
  initialRevision: number;
  size: number;               // Bytes
}

interface WorkItem {
  id: string;
  title: string;
  type: string;               // Bug, Feature, Task, etc.
  uri?: string;
}
```

---

## Entity Relationships

```
CodeReview (root aggregate)
├── 1:1 Author
├── 0:N Reviewer[]
├── 0:N CodePackage[]
│   ├── 1:1 CodePackageSourceInfo?
│   ├── 0:N CodePackageFileChange[]
│   │   └── 0:N Tag[]
│   └── 0:N Layer[]
├── 0:N ReviewIteration[]
│   ├── 0:N Layer[]
│   └── 0:N ReviewAttachment[]
├── 0:N CommentThread[]
│   ├── 1:1 Comment (root)
│   │   ├── 0:N Like[]
│   │   ├── 0:N CommentFeedback[]
│   │   └── 0:N Comment[] (children, recursive)
│   └── 1:1 DiffContext
│       └── 1:1 FileRegion
├── 1:1 CodjiFloVersion
├── 0:N WorkItem[]
└── Record<string, string> customData
```

---

## Key Constraints

| Entity | Constraint |
|--------|------------|
| ReviewIteration.revision | Auto-incremented per review, 1-based |
| Comment.id | Auto-incremented per review |
| CommentThread.id | Auto-incremented per review |
| ReviewAttachment.size | Max: 30 MB per iteration |
| ReviewAttachment count | Max: 20 per iteration |
| Iterations | Must be sorted by revision (ascending) |
| CommentThread | Requires valid DiffContext |

---

## Validation Rules

### CodeReview
- `name`: Required, non-empty
- `projectShortName`: Required
- `author`: Required, valid Author
- `iterations`: Sorted by revision ascending

### Comment
- `id >= 0`
- `threadId >= 0`
- `text`: Required, non-empty
- `reviewerId`: Required, non-empty
- Cannot be withdrawn during creation

### Reviewer/Author
- `id`: Required, non-empty
- `displayName`: Required, non-empty
- `emailAddress`: Required, valid email format
