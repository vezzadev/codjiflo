## ADDED Requirements

### Requirement: Layered Backend Architecture

The system SHALL isolate platform-specific logic behind an Abstract Manager Layer so that the UI/Presentation Layer interacts only with platform-agnostic interfaces, never directly with Azure DevOps, GitHub, or GitLab REST APIs.

#### Scenario: UI consumes abstract managers

- **WHEN** a UI component needs review, comment, iteration, or participant data
- **THEN** it SHALL call an abstract manager (e.g., `ReviewManager`, `CommentManager`, `ParticipantManager`) rather than invoking a platform SDK directly

#### Scenario: Platform-specific managers implement the abstractions

- **WHEN** a backend is selected (Azure DevOps, GitHub, or GitLab)
- **THEN** the corresponding platform-specific managers (e.g., `GitHubReviewMgr`, `AzDOCommentMgr`) SHALL be the only components that talk to the underlying REST/API

### Requirement: IReviewBackend Contract

The system SHALL expose review lifecycle operations through an `IReviewBackend` interface that every platform adapter MUST implement.

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
```

#### Scenario: Fetching a review by ID

- **WHEN** the application calls `getReview(reviewId)` on any platform adapter
- **THEN** the adapter SHALL return a `Review` object whose shape matches the unified `Review` contract regardless of the underlying platform

#### Scenario: Listing reviews with a query

- **WHEN** the application calls `listReviews(query)` with a `ReviewQuery` containing `projectId`, `authorId`, `reviewerId`, `status`, `createdAfter`, `modifiedAfter`, `pageSize`, or `pageToken`
- **THEN** the adapter SHALL return `ReviewSummary[]` filtered according to the supplied query fields

#### Scenario: Driving review state transitions

- **WHEN** the application invokes `publishReview`, `completeReview`, `abandonReview`, or `reactivateReview`
- **THEN** the adapter SHALL translate the call into the platform-native state transition and return the updated `Review`

### Requirement: ICommentBackend Contract

The system SHALL expose comment and thread management through an `ICommentBackend` interface, including capability flags that declare which optional comment behaviors the platform supports.

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
```

#### Scenario: Listing all threads for a review

- **WHEN** the application calls `getThreads(reviewId)`
- **THEN** the adapter SHALL return every `CommentThread` attached to the review, including review-level threads (those without a `filePath`)

#### Scenario: Creating a thread with character-precise location

- **WHEN** the application calls `createThread(reviewId, params)` with a `CommentLocation` containing `startLine`, `startColumn`, `endLine`, `endColumn` and optional `leftIteration`/`rightIteration`
- **THEN** the adapter SHALL persist a thread anchored to that location and return the created `CommentThread`

#### Scenario: Updating thread status

- **WHEN** the application calls `updateThreadStatus(reviewId, threadId, status)` with a status from `selectableThreadStatuses`
- **THEN** the adapter SHALL apply the platform-native status change and resolve successfully

#### Scenario: Optional likeComment is absent on platforms without support

- **WHEN** an adapter sets `supportsLikes` to `false`
- **THEN** the adapter MAY omit `likeComment`/`unlikeComment` from its implementation, and callers MUST gate invocation on the capability flag

### Requirement: IIterationBackend Contract

The system SHALL expose iteration browsing, comparison, and file-content retrieval through an `IIterationBackend` interface with capability flags describing iteration-specific platform features.

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
```

#### Scenario: Listing iterations for a review

- **WHEN** the application calls `getIterations(reviewId)`
- **THEN** the adapter SHALL return an `Iteration[]` ordered such that each iteration exposes `id`, `number`, `description`, `author`, `createdDate`, and `changeCount`

#### Scenario: Creating iterations is gated by capability

- **WHEN** an adapter sets `canCreateIterations` to `false`
- **THEN** the adapter MAY omit `createIteration`, and callers MUST NOT invoke it without checking the flag

#### Scenario: Comparing two iterations returns span mappings

- **WHEN** the application calls `compareIterations(reviewId, base, target)`
- **THEN** the adapter SHALL return an `IterationComparison` containing `changedFiles` and `spanMappings` usable for comment tracking (see `iterations` capability)

### Requirement: IParticipantBackend Contract

The system SHALL expose reviewer and participant management through an `IParticipantBackend` interface with capability flags for voting, groups, and status granularity.

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
```

#### Scenario: Adding and removing reviewers

- **WHEN** the application calls `addReviewers(reviewId, reviewers)` or `removeReviewer(reviewId, reviewerId)`
- **THEN** the adapter SHALL update the review's participant list using the platform-native reviewer API

#### Scenario: Status changes restricted to selectable statuses

- **WHEN** the application calls `updateReviewerStatus(reviewId, reviewerId, status)`
- **THEN** the supplied `status` MUST be a member of `selectableReviewerStatuses`, otherwise the adapter SHALL reject the call

#### Scenario: Identity resolution

- **WHEN** the application calls `searchUsers(query)`, `resolveUser(userId)`, or `getCurrentUser()`
- **THEN** the adapter SHALL return a normalized `UserIdentity` so the UI does not need platform-specific user shapes

### Requirement: IAuthBackend Contract

The system SHALL expose authentication through an `IAuthBackend` interface that supports multiple auth types and notifies subscribers of connection-lifecycle events.

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
```

#### Scenario: Connecting with a Personal Access Token

- **WHEN** the application calls `connect(config)` with `AuthConfig.personalAccessToken` populated
- **THEN** the adapter SHALL establish a session and subsequent `isConnected()` calls SHALL return `true`

#### Scenario: Connecting with OAuth

- **WHEN** the application calls `connect(config)` with `oauthClientId` and `oauthScopes`
- **THEN** the adapter SHALL perform an OAuth flow and expose tokens through `getAccessToken()`

#### Scenario: Notifying subscribers when the connection expires

- **WHEN** the adapter detects an expired or invalidated session
- **THEN** it SHALL emit `onConnectionExpired` so the UI can prompt re-authentication (see `unauthenticated-access`)

#### Scenario: Notifying subscribers of refreshed tokens

- **WHEN** the adapter successfully refreshes its access token
- **THEN** it SHALL emit `onTokenRefreshed` with the new token string

### Requirement: IRealTimeBackend Contract

The system SHALL expose real-time review updates through an `IRealTimeBackend` interface that declares both its capability and its transport mechanism.

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
```

#### Scenario: Subscribing to live review events

- **WHEN** the application calls `connect(reviewId)` on a backend whose `supportsRealTime` is `true`
- **THEN** the adapter SHALL begin emitting `onReviewUpdated`, `onIterationAdded`, `onCommentAdded`, `onCommentUpdated`, `onParticipantChanged`, and `onStatusChanged` events as the underlying platform reports them (see `realtime-updates`)

#### Scenario: Transport declaration

- **WHEN** a consumer inspects `connectionType`
- **THEN** it SHALL receive exactly one of `'websocket'`, `'polling'`, or `'sse'` so it can reason about latency and reconnect behavior

### Requirement: Unified Review Status Enumeration

The system SHALL normalize review state across platforms using a single `ReviewStatus` enumeration.

```typescript
enum ReviewStatus {
  Draft = 'draft',
  Active = 'active',
  Completed = 'completed',
  Abandoned = 'abandoned',
  Expired = 'expired'
}
```

#### Scenario: Mapping platform state to ReviewStatus

- **WHEN** an adapter receives a native review state
- **THEN** it SHALL map it to a `ReviewStatus` value using these correspondences:
  - Azure DevOps Code Review: `Created→Draft`, `Active→Active`, `Completed→Completed`, `Aborted→Abandoned`, `Expired→Expired`
  - Azure DevOps Pull Request: `Draft→Draft`, `Active→Active`, `Completed→Completed`, `Abandoned→Abandoned`
  - GitHub: `Draft→Draft`, `Open→Active`, `Merged→Completed`, `Closed→Abandoned`
  - GitLab: `Draft→Draft`, `Open→Active`, `Merged→Completed`, `Closed→Abandoned`

#### Scenario: Expired status only on Azure DevOps

- **WHEN** the platform is GitHub or GitLab
- **THEN** the adapter SHALL NOT emit `ReviewStatus.Expired` because the underlying platform has no equivalent state

### Requirement: Unified Comment Thread Status Enumeration

The system SHALL normalize comment thread state across platforms using a single `CommentThreadStatus` enumeration, with the per-platform supported subset advertised via `selectableThreadStatuses`.

```typescript
enum CommentThreadStatus {
  Active = 'active',
  Pending = 'pending',
  Resolved = 'resolved',
  WontFix = 'wontfix',
  ByDesign = 'bydesign',  // AzDO only
  Closed = 'closed'
}
```

#### Scenario: Platform thread status subsets

- **WHEN** a UI populates a thread-status dropdown
- **THEN** it SHALL use `ICommentBackend.selectableThreadStatuses`, which SHALL contain:
  - Azure DevOps: all six statuses (`Active`, `Pending`, `Resolved`, `WontFix`, `ByDesign`, `Closed`)
  - GitHub: `Active`, `Resolved`, `Pending`, `WontFix`, `Closed` (no `ByDesign`)
  - GitLab: `Active`, `Resolved`

#### Scenario: ByDesign rejected on non-AzDO

- **WHEN** the application calls `updateThreadStatus` with `ByDesign` on a GitHub or GitLab adapter
- **THEN** the adapter SHALL reject the call because `ByDesign` is not in its `selectableThreadStatuses`

### Requirement: Unified Reviewer Status Enumeration

The system SHALL normalize reviewer vote/status across platforms using a single `ReviewerStatus` enumeration, with the per-platform supported subset advertised via `selectableReviewerStatuses`.

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
```

#### Scenario: Platform reviewer status subsets

- **WHEN** a UI populates a reviewer-status control
- **THEN** it SHALL use `IParticipantBackend.selectableReviewerStatuses`, which SHALL contain:
  - Azure DevOps: all values plus the platform-native `Started` and `InviteOnly` extensions
  - GitHub: `NotStarted`, `Reviewing` (implicit), `Approved`, `Rejected`
  - GitLab: `NotStarted`, `Approved`, `Rejected`

### Requirement: Supporting Enumerations

The system SHALL define `ReviewerKind`, `ParticipantRole`, and `CommentViewContext` enumerations so adapters can describe reviewer requirements, participant roles, and which diff side a comment applies to.

```typescript
enum ReviewerKind {
  Optional = 'optional',
  Required = 'required'
}

enum ParticipantRole {
  Author = 'author',
  Reviewer = 'reviewer',
  AuthorAndReviewer = 'author_and_reviewer'
}

enum CommentViewContext {
  Both = 'both',           // Comment applies to both sides
  LeftOnly = 'left_only',  // Comment on deleted/old code
  RightOnly = 'right_only' // Comment on added/new code
}
```

#### Scenario: Adapter exposes ReviewerKind on every participant

- **WHEN** an adapter returns a `Participant`
- **THEN** the participant SHALL carry both a `role` (`ParticipantRole`) and a `kind` (`ReviewerKind`)

#### Scenario: Comment view context drives diff rendering

- **WHEN** a comment thread carries a `viewContext` of `LeftOnly`, `RightOnly`, or `Both`
- **THEN** the diff renderer SHALL display the comment only on the matching side(s) (see `comments`)

### Requirement: Capability Matrix Disclosure

The system SHALL allow callers to discover, at runtime, which features each backend supports by reading the capability flags exposed on the individual backend interfaces, conforming to the following matrix:

| Feature | Azure DevOps | GitHub | GitLab |
|---------|--------------|--------|--------|
| **Reviews** | | | |
| Create review | yes | yes | yes |
| Draft mode | yes | yes | yes |
| Complete/merge | yes | yes | yes |
| Abandon/close | yes | yes | yes |
| Expire | yes | no | no |
| **Comments** | | | |
| File comments | yes | yes | yes |
| Review-level comments | yes | yes | yes |
| Character-level spans | yes | partial | partial |
| Thread status | 6 statuses | 5 statuses | 2 statuses |
| Likes | yes | no | no |
| Feedback | yes | no | no |
| Markdown | yes | yes | yes |
| **Iterations** | | | |
| Create iteration | yes | no | no |
| Compare iterations | yes | yes | yes |
| Code coverage | yes | no | no |
| **Participants** | | | |
| Add reviewers | yes | yes | yes |
| Required reviewers | yes | yes | yes |
| Reviewer voting | yes | no | no |
| Group reviewers | yes | no | yes |
| Status granularity | 9 statuses | 4 statuses | 3 statuses |
| **Real-time** | | | |
| Push notifications | SignalR | Webhooks | Webhooks |
| Live updates | yes | polling | polling |

#### Scenario: Azure DevOps adapter advertises full capability set

- **WHEN** the Azure DevOps factory produces its backends
- **THEN** `supportsLikes`, `supportsFeedback`, `canCreateIterations`, `supportsCodeCoverage`, `supportsDpkExport`, `supportsReviewerVoting`, `supportsGroups`, and `supportsRealTime` SHALL all be `true`

#### Scenario: GitHub adapter advertises its constrained capability set

- **WHEN** the GitHub factory produces its backends
- **THEN** `supportsLikes`, `supportsFeedback`, `canCreateIterations`, `supportsCodeCoverage`, `supportsDpkExport`, and `supportsReviewerVoting` SHALL all be `false`, and `IRealTimeBackend.connectionType` SHALL be `'polling'` (or webhook-driven equivalent)

#### Scenario: GitLab adapter advertises its constrained capability set

- **WHEN** the GitLab factory produces its backends
- **THEN** `canCreateIterations`, `supportsCodeCoverage`, `supportsDpkExport`, `supportsLikes`, `supportsFeedback`, and `supportsReviewerVoting` SHALL be `false`, while `supportsGroups` SHALL be `true`

### Requirement: Backend Factory

The system SHALL provide a `BackendFactory` that constructs the full set of backend interfaces from a single `BackendConfig`, so the application can switch platforms without touching consumer code.

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

#### Scenario: Factory yields all six backends

- **WHEN** the application invokes the factory with a valid `BackendConfig`
- **THEN** the returned `BackendFactory` SHALL expose non-null `review`, `comment`, `iteration`, `participant`, `auth`, and `realtime` instances, all wired to the same platform and authentication context

#### Scenario: Application code is platform-agnostic

- **WHEN** application code holds a `BackendFactory`
- **THEN** it SHALL NOT need to know the value of `BackendConfig.type` to call any backend method

### Requirement: Graceful Degradation by Capability Flag

The system SHALL hide or disable UI controls whose underlying feature is unsupported by the current backend, using capability flags rather than try/catch on API errors.

#### Scenario: Hide like control when supportsLikes is false

- **WHEN** `ICommentBackend.supportsLikes` is `false`
- **THEN** the UI SHALL NOT render like/unlike controls for comments

#### Scenario: Hide create-iteration affordance when canCreateIterations is false

- **WHEN** `IIterationBackend.canCreateIterations` is `false`
- **THEN** the UI SHALL NOT expose a "create iteration" action

#### Scenario: Populate status dropdowns from selectable lists

- **WHEN** rendering a comment-thread status dropdown or a reviewer status dropdown
- **THEN** the UI SHALL populate options from `selectableThreadStatuses` and `selectableReviewerStatuses` respectively, never from the full enum

#### Scenario: Prefer hiding over erroring

- **WHEN** a feature is unsupported by the current backend
- **THEN** the UI SHALL hide the corresponding control instead of allowing the user to invoke it and surfacing a platform error

### Requirement: Authentication Integration Points

The system SHALL allow `IAuthBackend` to integrate with multiple credential sources via `AuthConfig` and SHALL feed its connection events into the broader authentication state (see `unauthenticated-access`).

```typescript
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

#### Scenario: Multiple credential sources supported

- **WHEN** an `AuthConfig` is constructed
- **THEN** it MAY populate exactly one of `personalAccessToken`, OAuth fields (`oauthClientId` + `oauthScopes`), or `credentialBackend`, and the adapter SHALL choose the matching connection strategy

#### Scenario: Access token surfaced to other backends

- **WHEN** another backend (review/comment/iteration/participant/realtime) needs to call the platform API
- **THEN** it SHALL acquire its credentials via `IAuthBackend.getAccessToken()` rather than reading credentials from configuration directly

### Requirement: Error Normalization Across Backends

The system SHALL ensure that the abstract interfaces present a single set of failure modes (rejected Promises with normalized errors and explicit capability checks) so the UI does not branch on platform-specific error shapes.

#### Scenario: Unsupported capability invocation rejects predictably

- **WHEN** an optional method (e.g., `likeComment`, `createIteration`) is called on an adapter whose capability flag is `false`
- **THEN** the call SHALL reject with an error indicating the feature is unsupported, rather than producing a platform-specific HTTP error

#### Scenario: Connection loss surfaces via onConnectionExpired

- **WHEN** any backend operation fails due to an expired or revoked credential
- **THEN** the corresponding `IAuthBackend.onConnectionExpired` event SHALL fire so the UI can transition to a re-auth flow uniformly across platforms

#### Scenario: Promise rejection is the failure channel

- **WHEN** any backend method fails (network error, validation error, authorization error, etc.)
- **THEN** it SHALL signal failure by rejecting its returned `Promise`; backends SHALL NOT return sentinel values or partial successes

### Requirement: Span Tracking Across Iterations

The system SHALL provide span-mapping data from `IIterationBackend.compareIterations` so comments anchored in one iteration can be projected onto another iteration on all platforms.

```typescript
interface SpanMapping {
  originalSpan: TextSpan;    // Position in base iteration
  mappedSpan: TextSpan;      // Position in target iteration
  changeType: 'unchanged' | 'modified' | 'deleted' | 'added';
}
```

#### Scenario: spanMappings included in IterationComparison

- **WHEN** `compareIterations(reviewId, baseIteration, targetIteration)` resolves
- **THEN** the returned `IterationComparison` SHALL include a `spanMappings` array describing how spans in the base iteration map onto the target iteration

#### Scenario: changeType classifies each mapping

- **WHEN** a consumer inspects a `SpanMapping`
- **THEN** its `changeType` SHALL be exactly one of `'unchanged'`, `'modified'`, `'deleted'`, or `'added'`, enabling the comment system to reposition or orphan threads accordingly (see `iterations` and `comments`)
