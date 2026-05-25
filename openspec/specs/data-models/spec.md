# data-models Specification

## Purpose
Canonical TypeScript entities (CodeReview, Comment, Iteration, FileVersion, …) referenced by every other capability. Defines the shape and invariants of every domain object the UI manipulates.

## Requirements
### Requirement: Status Enumerations
The system SHALL define a fixed set of enumerations that represent the lifecycle and classification states for code reviews, participants, iterations, comment threads, comments, and code packages. All status-bearing entities MUST use these enumerations rather than free-form strings.

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

#### Scenario: Status value assigned to entity
- **WHEN** a status field is assigned on any domain entity
- **THEN** its value MUST be a member of the corresponding enumeration above and never an arbitrary string

---

### Requirement: CodeReview Entity
The system SHALL model a code review as the root aggregate that owns participants, iterations, comment threads, code packages, related work items, version metadata, and audit information. Derived properties (such as `latestIteration`, `allComments`, `requiredReviewers`, `optionalReviewers`) MUST be computed from the underlying collections rather than persisted independently.

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
```

#### Scenario: Valid CodeReview instance
- **WHEN** a CodeReview is constructed
- **THEN** it conforms to the CodeReview interface above with required fields (`key`, `name`, `projectShortName`, `author`, `status`, `version`) populated and `iterations` sorted by revision ascending

#### Scenario: Derived properties computed from collections
- **WHEN** `allComments`, `latestIteration`, `requiredReviewers`, or `optionalReviewers` are read
- **THEN** their values MUST be derived from `threads`, `iterations`, and `reviewers` rather than maintained as independent state

---

### Requirement: CodeReviewSummary Entity
The system SHALL provide a lightweight summary projection of a CodeReview suitable for list views and dashboards, exposing identifiers, participants, status, key timestamps, work items, and iteration count without the full content payload.

```typescript
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

#### Scenario: Valid CodeReviewSummary instance
- **WHEN** a CodeReviewSummary is produced for list/dashboard display
- **THEN** it conforms to the CodeReviewSummary interface above, omitting full code packages, threads, and iteration content

---

### Requirement: ReviewIteration Entity
The system SHALL model each code update/revision of a review as a `ReviewIteration`. Iterations MUST be sequentially numbered (1-based) per review and ordered ascending by `revision`. The system SHALL enforce a maximum of approximately 20 attachments per iteration and approximately 30 MB per attachment.

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

#### Scenario: Valid ReviewIteration instance
- **WHEN** a ReviewIteration is appended to a CodeReview
- **THEN** its `revision` is strictly greater than every preceding iteration's revision and its attachments respect the ~20 count and ~30 MB size limits

---

### Requirement: Comment Entity
The system SHALL model individual review comments as nodes in a tree, where each comment has a stable per-review `id`, a `parentId` (0 for root comments), a `threadId` linking it to a `CommentThread`, and a recursive `children` collection. Comments MUST be auto-incremented per review and MUST NOT be created in a withdrawn state.

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
```

#### Scenario: Valid comment instance
- **WHEN** a Comment is created
- **THEN** `id >= 0`, `threadId >= 0`, `text` is non-empty, `reviewer` is non-empty, and `withdrawn` is `false`

#### Scenario: Root vs child comment
- **WHEN** a comment is the root of its thread
- **THEN** its `parentId` MUST be `0`; otherwise `parentId` MUST equal the `id` of an existing comment in the same thread

---

### Requirement: CommentThread Entity
The system SHALL group related comments into a `CommentThread` anchored to a single `DiffContext` and either a file scope or global scope. A thread's `isActive` property MUST be computed as `status == Active && !withdrawn`, and `allComments` and `postCount` MUST be derived from the recursive tree rooted at `root`.

```typescript
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

#### Scenario: Valid CommentThread instance
- **WHEN** a CommentThread is created
- **THEN** it has a valid `DiffContext`, a non-null `root` Comment, `createdOn` equal to `root.createdOn`, and `isActive` equal to `status == Active && !withdrawn`

---

### Requirement: Reviewer Entity
The system SHALL represent each reviewer of a code review with identity, status, requiredness flag, and last-updated metadata. `id`, `displayName`, and `emailAddress` MUST be non-empty, and `emailAddress` MUST be a valid email format.

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
```

#### Scenario: Valid Reviewer instance
- **WHEN** a Reviewer is added to a CodeReview
- **THEN** all of `id`, `displayName`, and `emailAddress` are non-empty, `emailAddress` is a valid email, and `status` is a member of `ReviewerStatus`

---

### Requirement: Author Entity
The system SHALL represent the originating author of a code review with identity, status, and last-updated metadata. `id`, `displayName`, and `emailAddress` MUST be non-empty, and `emailAddress` MUST be a valid email format.

```typescript
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
```

#### Scenario: Valid Author instance
- **WHEN** a CodeReview is created
- **THEN** its `author` conforms to the Author interface with non-empty identity fields, a valid email, and a `status` from `AuthorStatus`

---

### Requirement: User Entity
The system SHALL represent application users independently from per-review participant roles, exposing identity, settings, and lifecycle timestamps.

```typescript
interface User {
  id: string;
  displayName: string;
  email: string;
  createdOn: Date;
  lastUpdatedOn: Date;
  settings: Record<string, string>;
}
```

#### Scenario: Valid User instance
- **WHEN** a User is persisted
- **THEN** it conforms to the User interface above with non-empty `id`, `displayName`, and `email`

---

### Requirement: DiffContext and FileRegion
The system SHALL anchor comment threads in a diff via a `DiffContext` that references two iteration revisions, a `FileRegion`, a view perspective (`Both` / `LeftOnly` / `RightOnly`), and optional correlation/legacy code-package references. `FileRegion` MUST use 1-based line numbers and 0-based character positions.

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

#### Scenario: Valid DiffContext instance
- **WHEN** a CommentThread is created
- **THEN** its `context` conforms to DiffContext, `leftIteration` and `rightIteration` refer to existing `ReviewIteration.revision` values, and `region` uses 1-based line numbers and 0-based character positions

---

### Requirement: CodePackage Entity
The system SHALL represent each delivered set of code changes as a `CodePackage` with name, revision, author, description, format, status, location URI, optional source-control metadata, file changes, layers, and optional folder tags.

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
```

#### Scenario: Valid CodePackage instance
- **WHEN** a CodePackage is attached to a CodeReview
- **THEN** it conforms to the CodePackage interface above, with `format` from `CodePackageFormat`, `status` from `CodePackageStatus`, and a `location` URI populated

---

### Requirement: Layer and Tag Entities
The system SHALL support attaching auxiliary content (layers) and labels (tags) to code packages and iterations. Each `Layer` MUST have a GUID `id`, a type, a display name, and a location URI.

```typescript
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

#### Scenario: Valid Layer instance
- **WHEN** a Layer is added to a CodePackage or ReviewIteration
- **THEN** its `id` is a GUID and its `location` is a populated URI

---

### Requirement: Interaction Entities
The system SHALL model lightweight comment interactions via `Like` and `CommentFeedback`. Likes MUST record the creating user and timestamp; feedbacks MUST additionally record a `CommentFeedbackType`.

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
```

#### Scenario: Valid Like and CommentFeedback instances
- **WHEN** a user likes a comment or submits feedback
- **THEN** the resulting `Like` or `CommentFeedback` conforms to the respective interface, with `user` non-empty and (for feedback) `type` drawn from `CommentFeedbackType`

---

### Requirement: ReviewAttachment Entity
The system SHALL model files attached to a review iteration with identity, display name, author, location URI, submission timestamp, revision tracking, and byte size. Attachment size and per-iteration count MUST respect the limits enforced by `ReviewIteration` (≤30 MB per attachment, ≤20 per iteration).

```typescript
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
```

#### Scenario: Valid ReviewAttachment instance
- **WHEN** a ReviewAttachment is added to a ReviewIteration
- **THEN** it conforms to the ReviewAttachment interface above and its `size` does not exceed 30 MB

---

### Requirement: WorkItem Entity
The system SHALL link external tracking artifacts (bugs, features, tasks, etc.) to a CodeReview via `WorkItem` references containing an id, title, type, and optional URI.

```typescript
interface WorkItem {
  id: string;
  title: string;
  type: string;               // Bug, Feature, Task, etc.
  uri?: string;
}
```

#### Scenario: Valid WorkItem instance
- **WHEN** a WorkItem is attached to a CodeReview
- **THEN** it conforms to the WorkItem interface above with non-empty `id`, `title`, and `type`

---

### Requirement: Entity Relationships and Aggregate Boundaries
The system SHALL preserve the following ownership/cardinality relationships, with `CodeReview` as the single aggregate root for all owned collections.

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

#### Scenario: Aggregate invariants enforced
- **WHEN** any owned child entity (CodePackage, ReviewIteration, CommentThread, etc.) is added, mutated, or removed
- **THEN** the change MUST go through the owning `CodeReview` so aggregate-level invariants (revision ordering, ID auto-increment via `lastCommentId` / `lastCommentThreadId`, attachment limits, valid DiffContext for threads) are preserved

