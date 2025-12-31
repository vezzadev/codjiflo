# CodjiFlo Data Models Specification

This document defines the core domain entities for a clean-room reimplementation of CodjiFlo.

## Implementation Status

> **Note**: This specification represents the **aspirational** data model inspired by Microsoft's CodeFlow. The actual implementation (as of Milestone 1-3) uses a **simplified subset** focused on GitHub integration. See `src/api/types.ts` and `src/features/*/types.ts` for current implementation.
>
> **Key Simplifications**:
> - Comment threads use `isResolved: boolean` instead of full `CommentThreadStatus` enum
> - No `Like`, `CommentFeedback`, or `WorkItem` entities yet
> - `Review` interface is platform-agnostic but simpler than `CodeReview`
> - `CodePackage` and `Layer` concepts are deferred to future Azure DevOps support
> - Character-level comment precision (FileRegion) is specified but line-level is currently implemented
>
> See [spec/questions/2025-12-31.md](../questions/2025-12-31.md) for detailed analysis of spec vs. implementation gaps.

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
// ✅ IMPLEMENTED: See src/features/iterations/types.ts

// Comment Thread Status
enum CommentThreadStatus {
  Active,
  Pending,
  Resolved,
  WontFix,
  Closed,
  ByDesign
}
// ⚠️ NOT IMPLEMENTED: Current implementation uses `isResolved: boolean` on ReviewThread
// See src/features/comments/types.ts

// Comment Scope (Global vs File-specific)
enum CommentScope {
  File,
  Global
}
// ⚠️ NOT IMPLEMENTED: All comments are currently file-scoped

// Comment View Context (diff view perspective)
enum CommentViewContext {
  Both,
  LeftOnly,
  RightOnly
}
// ⚠️ NOT IMPLEMENTED: Comments use CommentSide = "LEFT" | "RIGHT" instead

// Comment Feedback Type
enum CommentFeedbackType {
  NotUseful,
  Useful,
  DontUnderstand
}
// ⚠️ NOT IMPLEMENTED: No feedback system yet

// Code Package Format (platform-specific)
enum CodePackageFormat {
  ShelveSet,    // TFS/Azure DevOps
  PackFile      // Other VCS
}
// ⚠️ NOT IMPLEMENTED: Deferred to Azure DevOps support milestone

// Code Package Status
enum CodePackageStatus {
  Submitted,
  Revoked
}
// ⚠️ NOT IMPLEMENTED: Deferred to Azure DevOps support milestone
```

---

## Core Domain Models

### CodeReview (Main Aggregate Root)

> ⚠️ **NOT FULLY IMPLEMENTED**: The current implementation uses a simplified `Review` interface (see `src/api/types.ts`) focused on GitHub PRs. This model represents the aspirational CodeFlow-compatible design for future platform abstraction.
>
> **Current Implementation**: See `Review` interface which includes: `id`, `number`, `title`, `description`, `state`, `author`, `sourceBranch`, `targetBranch`, `baseSha`, `headSha`, `htmlUrl`, `createdAt`, `updatedAt`.
>
> **Missing from Implementation**: `reviewers[]`, `codePackages[]`, `threads[]`, `workItems[]`, `auditLog`, `customData`, permission flags, status enums.

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

> ✅ **PARTIALLY IMPLEMENTED**: See `src/features/iterations/types.ts` for the Milestone 4 implementation.
>
> **Current Implementation**: `Iteration` interface includes: `id`, `revision`, `headSha`, `baseSha`, `beforeSha`, `author`, `createdAt`.
>
> **Differences**: 
> - Uses Git SHAs instead of `CodePackage` references
> - No `layers[]` or `reviewAttachments[]` yet
> - No `description` or `comment` fields (pulled from commit messages)

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

> ✅ **PARTIALLY IMPLEMENTED**: See `src/features/comments/types.ts` for the GitHub-focused implementation.
>
> **Current Implementation**:
> - `Comment`: `id`, `body`, `author`, `createdAt`, `updatedAt`, `path`, `line`, `side`, `position`, `inReplyTo`, `isPending`
> - `ReviewThread`: `id`, `path`, `line`, `side`, `comments[]`, `isResolved`
>
> **Notable Differences**:
> - Thread status is `isResolved: boolean` instead of `CommentThreadStatus` enum
> - No `likes[]`, `feedbacks[]`, or `customData` fields
> - Comments use flat `inReplyTo` reference instead of hierarchical `children[]` array
> - No `DiffContext` or `FileRegion` for character-level precision (line-level only)
> - No distinction between file-scoped and global comments

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

> ⚠️ **NOT IMPLEMENTED**: The current implementation uses simpler `Author` and `CommentAuthor` types without status tracking or detailed metadata.
>
> **Current Implementation**:
> - `Author` (in `src/api/types.ts`): `id`, `displayName`, `avatarUrl`
> - `CommentAuthor` (in `src/features/comments/types.ts`): `id`, `login`, `avatarUrl`
>
> **Missing**: `Reviewer` role, status enums, `emailAddress`, `required` flag, `lastUpdatedOn`, `User` entity, settings.

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

> ⚠️ **NOT IMPLEMENTED**: These models support character-level precision and cross-iteration comment tracking. Current implementation uses line-level positioning only.
>
> **Current Implementation**: Comments track `path`, `line`, `side` ("LEFT"|"RIGHT"), and `position` (GitHub diff position).
>
> **Missing Features**:
> - Character-level precision (`startCharPos`, `endCharPos`)
> - Explicit iteration references for cross-iteration comments
> - `CommentViewContext` (Both/LeftOnly/RightOnly) - currently using `CommentSide`
> - Multi-line region spanning

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

> ⚠️ **NOT IMPLEMENTED**: These are Azure DevOps-specific concepts (ShelveSet, Layer). GitHub integration uses native Git concepts instead.
>
> **Current Implementation**: 
> - `FileChange` (in `src/api/types.ts`): `filename`, `status`, `additions`, `deletions`, `changes`, `patch`, `previousFilename`
> - `ReviewFileArtifact` (in `src/features/iterations/types.ts`): Tracks file lineage across iterations
>
> **Missing**: `CodePackage`, `Layer`, `Tag`, Azure DevOps source control metadata

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

> ⚠️ **NOT IMPLEMENTED**: These social and workflow features are deferred to future milestones.
>
> **Missing Features**:
> - Comment likes/reactions
> - Comment feedback system (Useful/NotUseful/DontUnderstand)
> - Review attachments (file uploads)
> - Work item integration (issue tracking links)

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

---

## Current Implementation (Milestones 1-4)

This section documents the **actual implemented models** as of December 2025. These types can be found in:
- `src/api/types.ts` - Platform-agnostic core types
- `src/features/*/types.ts` - Feature-specific types

### Implemented Review Model

**Location**: `src/api/types.ts`

```typescript
interface Review {
  id: number;
  number: number;              // PR number
  title: string;
  description: string;
  state: ReviewState;          // 'open' | 'closed' | 'merged' | 'draft'
  author: Author;
  sourceBranch: string;
  targetBranch: string;
  baseSha: string;            // Base commit SHA
  headSha: string;            // Head commit SHA
  htmlUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Author {
  id: string;
  displayName: string;
  avatarUrl: string;
}

interface FileChange {
  filename: string;
  status: FileChangeStatus;   // 'added' | 'modified' | 'removed' | 'renamed'
  additions: number;
  deletions: number;
  changes: number;
  patch: string;              // Unified diff format
  previousFilename?: string;
}
```

**Key Differences from Spec**:
- No `Reviewer[]` or `CodeReview.status` enum
- Uses Git SHAs instead of `CodePackage` abstraction
- No permission flags (`canWithdraw`, `canComplete`)
- No `WorkItem[]` integration
- No `auditLog` or `customData`

### Implemented Comment Model

**Location**: `src/features/comments/types.ts`

```typescript
interface Comment {
  id: string;                 // Local UUID or GitHub comment ID
  body: string;
  author: CommentAuthor;
  createdAt: Date;
  updatedAt: Date;
  path: string;               // File path
  line: number;               // Line number (1-based)
  side: CommentSide;          // "LEFT" | "RIGHT"
  position: number | null;    // GitHub diff position
  inReplyTo?: string;         // Parent comment ID for threading
  isPending?: boolean;        // Local draft, not yet posted
}

interface CommentAuthor {
  id: string;
  login: string;             // GitHub username
  avatarUrl: string;
}

interface ReviewThread {
  id: string;
  path: string;
  line: number;
  side: CommentSide;
  comments: Comment[];       // Flat list, sorted by createdAt
  isResolved: boolean;       // Simple resolved flag
}
```

**Key Differences from Spec**:
- Thread status is `boolean` instead of `CommentThreadStatus` enum
- No `likes[]`, `feedbacks[]`, or `customData`
- No hierarchical `children[]` - uses flat `inReplyTo` instead
- Line-level precision only (no `FileRegion` with character positions)
- No `DiffContext` - comments don't reference iterations explicitly

### Implemented Iteration Model

**Location**: `src/features/iterations/types.ts`

```typescript
interface Iteration {
  id: number;
  revision: number;          // Sequential 1-based
  headSha: string;           // Commit SHA after this iteration
  baseSha: string;           // Base commit SHA
  beforeSha: string | null;  // Previous head SHA (for force-push detection)
  author: string;
  createdAt: Date;
}

interface ReviewFileArtifact {
  id: number;
  changeTrackingId: string;  // Stable ID across renames
  repoPaths: (string | null)[];  // Path at each snapshot (null if deleted)
  firstSnapshotIndex: number;
  lastSnapshotIndex: number;
}

interface FileContent {
  artifactId: number;
  snapshotIndex: number;
  content: string | null;    // null if binary or too large
  contentHash: string;
  sizeBytes: number;
}

// Helper: Each iteration has 2 snapshots (left=before, right=after)
// Iteration 1: Snapshot 0 <-> Snapshot 1
// Iteration 2: Snapshot 2 <-> Snapshot 3
function iterationToRightSnapshot(revision: number): number {
  return (revision - 1) * 2 + 1;
}
```

**Key Differences from Spec**:
- Uses Git SHAs instead of `CodePackage` references
- No `Layer[]` or `ReviewAttachment[]`
- No `description` or `comment` fields (uses commit messages)
- Snapshot-based model optimized for GitHub Actions artifact storage

### Backend Abstraction

**Location**: `src/api/types.ts`

```typescript
interface IReviewBackend {
  getReview(owner: string, repo: string, number: number): Promise<Review>;
}

interface IFileBackend {
  getFiles(owner: string, repo: string, number: number): Promise<FileChange[]>;
  getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref: string
  ): Promise<RawFileContent>;
}

interface BackendFactory {
  review: IReviewBackend;
  file: IFileBackend;
}
```

**Current Implementations**:
- `GitHubReviewBackend` - Maps GitHub API to `Review`
- `GitHubFileBackend` - Fetches file changes and content

**Future**: Azure DevOps and GitLab backends will implement these same interfaces.

### Implementation Checklist

✅ **Fully Implemented**:
- Review (PR) metadata and state
- File changes with diff patches
- Comment threading with line-level positioning
- Iteration tracking with snapshot system
- Backend abstraction layer

⚠️ **Partially Implemented**:
- Comment status (boolean instead of enum)
- Author/Reviewer (no status tracking)
- File regions (line-level, not character-level)

❌ **Not Implemented** (Deferred to Future Milestones):
- `CodePackage`, `Layer` (Azure DevOps concepts)
- `Like`, `CommentFeedback` (social features)
- `WorkItem` integration
- `AuditLog`, `customData` metadata
- Permission flags (`canWithdraw`, etc.)
- Global (non-file) comments
- Character-level comment precision
- `ReviewAttachment` (file uploads)

---

## Migration Path

When adding Azure DevOps support:

1. **Create platform-specific types**: `AzureDevOpsCodeReview` with `CodePackage[]` and `Layer[]`
2. **Extend backend interfaces**: Add `IIterationBackend` for Azure DevOps-specific APIs
3. **Map to common types**: Transform both GitHub and Azure DevOps data to shared `Review` interface
4. **Feature flags**: Enable richer features (character-level precision, feedback) per platform

When adding social features:

1. **Extend Comment**: Add optional `likes[]` and `feedbacks[]` fields
2. **Update CommentThread**: Replace `isResolved` with `status: CommentThreadStatus`
3. **Backend support**: Implement storage for likes/feedback in GitHub Discussions or separate DB
