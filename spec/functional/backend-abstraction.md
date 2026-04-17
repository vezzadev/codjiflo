# Backend Abstraction Layer Specification

This document defines the platform-agnostic interface contracts that enable CodjiFlo to work with Azure DevOps, GitHub, GitLab, and other backends.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    UI / Presentation Layer                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Abstract Manager Layer                     │
│  ReviewManager │ CommentManager │ ParticipantManager │ ...  │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  AzDOReviewMgr  │ │ GitHubReviewMgr │ │ GitLabReviewMgr │
│  AzDOCommentMgr │ │ GitHubCommentMgr│ │ GitLabCommentMgr│
│       ...       │ │       ...       │ │       ...       │
└─────────────────┘ └─────────────────┘ └─────────────────┘
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Azure DevOps   │ │   GitHub API    │ │   GitLab API    │
│    REST API     │ │                 │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## Backend Interfaces

### IReviewBackend

Core operations for managing code reviews/pull requests.

```typescript
interface IReviewBackend {
  // Review lifecycle
  getReview(reviewId: string): Promise<Review>;
  listReviews(query: ReviewQuery): Promise<ReviewSummary[]>;
  updateReview(reviewId: string, updates: ReviewUpdates): Promise<Review>;

  // Review state transitions
  publishReview(reviewId: string, message?: string): Promise<Review>;
  completeReview(reviewId: string, message?: string): Promise<Review>;
  abandonReview(reviewId: string, message?: string): Promise<Review>;
  reactivateReview(reviewId: string): Promise<Review>;

  // Real-time updates
  subscribeToReview(reviewId: string, handler: ReviewEventHandler): Subscription;
}

interface CreateReviewParams {
  title: string;
  description?: string;
  projectId: string;
  targetBranch: string;
  sourceBranch: string;
  reviewers?: ReviewerParams[];
  workItemIds?: string[];
  isDraft?: boolean;
}

interface ReviewQuery {
  projectId?: string;
  authorId?: string;
  reviewerId?: string;
  status?: ReviewStatus[];
  createdAfter?: Date;
  modifiedAfter?: Date;
  pageSize?: number;
  pageToken?: string;
}
```

### ICommentBackend

Operations for managing comments and discussion threads.

```typescript
interface ICommentBackend {
  // Capability flags
  readonly supportsLikes: boolean;          // AzDO: true, GitHub: false
  readonly supportsFeedback: boolean;       // AzDO: true, GitHub: false
  readonly supportsMetadataComments: boolean;
  readonly supportsMarkdown: boolean;
  readonly selectableThreadStatuses: CommentThreadStatus[];

  // Thread operations
  getThreads(reviewId: string): Promise<CommentThread[]>;
  getThreadsForFile(reviewId: string, filePath: string): Promise<CommentThread[]>;
  createThread(reviewId: string, params: CreateThreadParams): Promise<CommentThread>;
  updateThreadStatus(reviewId: string, threadId: string, status: CommentThreadStatus): Promise<void>;
  deleteThread(reviewId: string, threadId: string): Promise<void>;

  // Comment operations
  addComment(reviewId: string, threadId: string, params: CreateCommentParams): Promise<Comment>;
  updateComment(reviewId: string, commentId: string, text: string): Promise<Comment>;
  deleteComment(reviewId: string, commentId: string): Promise<void>;

  // Interactions (optional based on capabilities)
  likeComment?(reviewId: string, commentId: string): Promise<void>;
  unlikeComment?(reviewId: string, commentId: string): Promise<void>;
  addFeedback?(reviewId: string, commentId: string, type: FeedbackType): Promise<void>;
}

interface CreateThreadParams {
  // Location
  filePath?: string;          // null for review-level comments
  iterationId?: number;
  location?: CommentLocation;

  // Content
  text: string;
  status?: CommentThreadStatus;

  // Context
  viewContext?: CommentViewContext;  // Both, LeftOnly, RightOnly
}

interface CommentLocation {
  // Character-precise positioning
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;

  // For tracking across iterations
  leftIteration?: number;
  rightIteration?: number;
}
```

### IIterationBackend

Operations for managing review iterations (code versions).

```typescript
interface IIterationBackend {
  // Capability flags
  readonly canCreateIterations: boolean;    // AzDO: true, GitHub: false
  readonly supportsIterationComparison: boolean;
  readonly supportsDpkExport: boolean;      // AzDO only
  readonly supportsCodeCoverage: boolean;   // AzDO only

  // Iteration operations
  getIterations(reviewId: string): Promise<Iteration[]>;
  getIteration(reviewId: string, iterationId: number): Promise<Iteration>;
  createIteration?(reviewId: string, params: CreateIterationParams): Promise<Iteration>;

  // File comparison
  getIterationChanges(reviewId: string, iterationId: number): Promise<FileChange[]>;
  compareIterations(
    reviewId: string,
    baseIteration: number,
    targetIteration: number
  ): Promise<IterationComparison>;

  // File content
  getFileContent(
    reviewId: string,
    iterationId: number,
    filePath: string,
    side: 'left' | 'right'
  ): Promise<FileContent>;
}

interface Iteration {
  id: number;
  number: number;          // Display number (1-based)
  description: string;
  author: Participant;
  createdDate: Date;
  changeCount: number;

  // For Pull Requests
  sourceCommitId?: string;
  targetCommitId?: string;

  // Properties (platform-specific)
  properties?: Record<string, unknown>;
}

interface IterationComparison {
  baseIteration: number;
  targetIteration: number;
  changedFiles: FileChange[];

  // For comment tracking
  spanMappings: SpanMapping[];
}
```

### IParticipantBackend

Operations for managing reviewers and participants.

```typescript
interface IParticipantBackend {
  // Capability flags
  readonly supportsReviewerVoting: boolean;  // AzDO: true, GitHub: false
  readonly supportsGroups: boolean;          // AzDO: true, GitHub: false
  readonly selectableReviewerStatuses: ReviewerStatus[];

  // Participant operations
  getParticipants(reviewId: string): Promise<Participant[]>;
  addReviewers(reviewId: string, reviewers: AddReviewerParams[]): Promise<void>;
  removeReviewer(reviewId: string, reviewerId: string): Promise<void>;

  // Status updates
  updateReviewerStatus(
    reviewId: string,
    reviewerId: string,
    status: ReviewerStatus
  ): Promise<void>;

  updateReviewerKind(
    reviewId: string,
    reviewerId: string,
    kind: ReviewerKind  // Required, Optional
  ): Promise<void>;

  // Identity resolution
  searchUsers(query: string): Promise<UserIdentity[]>;
  resolveUser(userId: string): Promise<UserIdentity>;
  getCurrentUser(): Promise<UserIdentity>;
}

interface Participant {
  id: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;

  role: ParticipantRole;      // Author, Reviewer, AuthorAndReviewer
  status: ReviewerStatus;
  kind: ReviewerKind;         // Required, Optional

  // AzDO-specific
  votedIterationId?: number;
  isGroup?: boolean;
}
```

### IAuthBackend

Authentication abstraction.

```typescript
interface IAuthBackend {
  readonly authType: AuthType;  // PAT, OAuth, Windows

  // Connection
  connect(config: AuthConfig): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Token management
  getAccessToken(): Promise<string>;
  refreshToken?(): Promise<string>;

  // Events
  onConnectionExpired: Event<void>;
  onTokenRefreshed: Event<string>;
}

interface AuthConfig {
  serverUrl: string;

  // Option 1: Personal Access Token
  personalAccessToken?: string;

  // Option 2: OAuth
  oauthClientId?: string;
  oauthScopes?: string[];

  // Option 3: Credential Backend (VS integration)
  credentialBackend?: CredentialBackend;
}
```

### IRealTimeBackend

Real-time update notifications.

```typescript
interface IRealTimeBackend {
  readonly supportsRealTime: boolean;
  readonly connectionType: 'websocket' | 'polling' | 'sse';

  // Connection
  connect(reviewId: string): Promise<void>;
  disconnect(): Promise<void>;

  // Subscriptions
  onReviewUpdated: Event<ReviewUpdateEvent>;
  onIterationAdded: Event<IterationEvent>;
  onCommentAdded: Event<CommentEvent>;
  onCommentUpdated: Event<CommentEvent>;
  onParticipantChanged: Event<ParticipantEvent>;
  onStatusChanged: Event<StatusEvent>;
}

// AzDO uses SignalR, GitHub uses webhooks/polling
```

---

## Unified Enumerations

### ReviewStatus

```typescript
enum ReviewStatus {
  Draft = 'draft',
  Active = 'active',
  Completed = 'completed',
  Abandoned = 'abandoned',
  Expired = 'expired'
}

// Platform mappings:
// AzDO Code Review: Created→Draft, Active→Active, Completed→Completed, Aborted→Abandoned, Expired→Expired
// AzDO Pull Request: Draft→Draft, Active→Active, Completed→Completed, Abandoned→Abandoned
// GitHub: Draft→Draft, Open→Active, Merged→Completed, Closed→Abandoned
// GitLab: Draft→Draft, Open→Active, Merged→Completed, Closed→Abandoned
```

### CommentThreadStatus

```typescript
enum CommentThreadStatus {
  Active = 'active',
  Pending = 'pending',
  Resolved = 'resolved',
  WontFix = 'wontfix',
  ByDesign = 'bydesign',  // AzDO only
  Closed = 'closed'
}

// Platform support:
// AzDO: All statuses
// GitHub: Active, Resolved, Pending, WontFix, Closed (no ByDesign)
// GitLab: Active, Resolved (maps to resolved/unresolved)
```

### ReviewerStatus

```typescript
enum ReviewerStatus {
  NotStarted = 'not_started',
  Reviewing = 'reviewing',
  Waiting = 'waiting',
  Approved = 'approved',
  ApprovedWithComments = 'approved_with_comments',
  Rejected = 'rejected',
  Declined = 'declined'
}

// Platform support:
// AzDO: All statuses + Started, InviteOnly
// GitHub: NotStarted, Reviewing (implicit), Approved, Rejected
// GitLab: NotStarted, Approved, Rejected
```

### ReviewerKind

```typescript
enum ReviewerKind {
  Optional = 'optional',
  Required = 'required'
}
```

### ParticipantRole

```typescript
enum ParticipantRole {
  Author = 'author',
  Reviewer = 'reviewer',
  AuthorAndReviewer = 'author_and_reviewer'
}
```

### CommentViewContext

```typescript
enum CommentViewContext {
  Both = 'both',           // Comment applies to both sides
  LeftOnly = 'left_only',  // Comment on deleted/old code
  RightOnly = 'right_only' // Comment on added/new code
}
```

---

## Capability Matrix

| Feature | Azure DevOps | GitHub | GitLab |
|---------|--------------|--------|--------|
| **Reviews** |
| Create review | ✓ | ✓ | ✓ |
| Draft mode | ✓ | ✓ | ✓ |
| Complete/merge | ✓ | ✓ | ✓ |
| Abandon/close | ✓ | ✓ | ✓ |
| Expire | ✓ | ✗ | ✗ |
| **Comments** |
| File comments | ✓ | ✓ | ✓ |
| Review-level comments | ✓ | ✓ | ✓ |
| Character-level spans | ✓ | Partial | Partial |
| Thread status | 6 statuses | 5 statuses | 2 statuses |
| Likes | ✓ | ✗ | ✗ |
| Feedback | ✓ | ✗ | ✗ |
| Markdown | ✓ | ✓ | ✓ |
| **Iterations** |
| Create iteration | ✓ | ✗ | ✗ |
| Compare iterations | ✓ | ✓ | ✓ |
| Code coverage | ✓ | ✗ | ✗ |
| **Participants** |
| Add reviewers | ✓ | ✓ | ✓ |
| Required reviewers | ✓ | ✓ | ✓ |
| Reviewer voting | ✓ | ✗ | ✗ |
| Group reviewers | ✓ | ✗ | ✓ |
| Status granularity | 9 statuses | 4 statuses | 3 statuses |
| **Real-time** |
| Push notifications | SignalR | Webhooks | Webhooks |
| Live updates | ✓ | Polling | Polling |

---

## Backend Factory

```typescript
interface BackendConfig {
  type: 'azure-devops' | 'github' | 'gitlab';
  serverUrl: string;
  auth: AuthConfig;
  projectId?: string;
  repositoryId?: string;
}

interface BackendFactory {
  review: IReviewBackend;
  comment: ICommentBackend;
  iteration: IIterationBackend;
  participant: IParticipantBackend;
  auth: IAuthBackend;
  realtime: IRealTimeBackend;
}
```

A factory creates all Backends from a single configuration. The application uses Backend interfaces without knowing the backend type.

---

## Graceful Degradation Pattern

Features vary by platform. The UI should:
- Check capability flags (e.g., `supportsLikes`, `canCreateIterations`) before showing controls
- Use `selectableThreadStatuses` and `selectableReviewerStatuses` to populate dropdowns
- Hide unavailable features rather than showing errors

---

## Azure DevOps API Mappings

| Backend Method | Azure DevOps API |
|-----------------|------------------|
| `getReview` | `GET /git/pullrequests/{id}` or `GET /codereview/reviews/{id}` |
| `createThread` | `POST /git/pullrequests/{id}/threads` |
| `addComment` | `POST /git/pullrequests/{id}/threads/{threadId}/comments` |
| `updateThreadStatus` | `PATCH /git/pullrequests/{id}/threads/{threadId}` |
| `getIterations` | `GET /git/pullrequests/{id}/iterations` |
| `addReviewers` | `POST /git/pullrequests/{id}/reviewers` |
| Real-time | SignalR to `/_signalr` endpoint |

**Required OAuth Scopes:** `vso.code_write`, `vso.work_write`, `vso.identity`, `vso.profile`, `vso.live_updates`, `vso.code_status`, `vso.notification_write`

---

## GitHub API Mappings

| Backend Method | GitHub API |
|-----------------|------------|
| `getReview` | `GET /repos/{owner}/{repo}/pulls/{number}` |
| `createThread` | `POST /repos/{owner}/{repo}/pulls/{number}/reviews/{id}/comments` |
| `addComment` | `POST /repos/{owner}/{repo}/pulls/{number}/comments` |
| `updateThreadStatus` | N/A (use resolve conversation mutation) |
| `getIterations` | `GET /repos/{owner}/{repo}/pulls/{number}/commits` |
| `addReviewers` | `POST /repos/{owner}/{repo}/pulls/{number}/requested_reviewers` |
| Real-time | Webhooks or polling |

**GitHub Limitations:**
- No native thread status API (resolved via GraphQL)
- Comments don't have like/feedback
- Reviewer status is implicit in review state
- Iterations are commits (cannot create)

---

## Implementation Notes

### Span Tracking (All platforms)

Comments reference code positions that may move as iterations are added. The `IterationComparison.spanMappings` provides translation:

```typescript
interface SpanMapping {
  originalSpan: TextSpan;    // Position in base iteration
  mappedSpan: TextSpan;      // Position in target iteration
  changeType: 'unchanged' | 'modified' | 'deleted' | 'added';
}
```

