# realtime-updates Specification

## Purpose
Live update behaviour — SignalR for Azure DevOps, webhook + polling fallback for other platforms, optimistic UI rules, ETag/Last-Modified delta handling, auto-reconnect, and token-expiry resubscribe.

See [architecture.md](architecture.md) for implementation reference (topology diagram, SignalR/notification interfaces, and the platform table).

## Requirements
### Requirement: Real-Time Provider Abstraction
The system SHALL expose a platform-agnostic real-time provider interface that advertises whether real-time push is supported, declares its transport type (websocket, polling, or server-sent events), and emits typed events for review, iteration, comment, reviewer, status, and policy changes. Platform-specific providers (Azure DevOps, GitHub, GitLab) MUST implement this interface so that consumers of `backend-abstraction` can subscribe to updates without knowing the underlying transport.

#### Scenario: Azure DevOps provider advertises websocket transport
- **WHEN** the Azure DevOps real-time provider is instantiated
- **THEN** it reports `supportsRealTime` as true and `connectionType` as `websocket`

#### Scenario: GitHub provider advertises polling transport
- **WHEN** the GitHub real-time provider is instantiated and no push channel is available
- **THEN** it reports `connectionType` as `polling` and still exposes the same event surface as websocket providers

### Requirement: SignalR Connection For Azure DevOps
The system SHALL establish a SignalR WebSocket connection to `{collectionUrl}/_signalr/codeReview` for Azure DevOps reviews, authenticate with the user's PAT or OAuth token, and invoke a subscribe operation with the review identifier and the set of event types the client cares about (review, iteration, comment, status, properties).

#### Scenario: Successful connection subscribes to review events
- **WHEN** the user opens an Azure DevOps review and the SignalR connection completes its handshake
- **THEN** the client invokes `subscribe` with the review ID and the supported event types and reports `isConnected` as true

#### Scenario: Authentication failure surfaces an error
- **WHEN** the SignalR handshake is rejected because the auth token is invalid
- **THEN** the connection is not marked as connected and the failure is surfaced to the caller so it can prompt for re-authentication

### Requirement: Webhook And Polling Fallback For Other Platforms
For platforms without a SignalR equivalent (GitHub, GitLab), the system SHALL provide updates by combining webhook-driven server notifications with periodic API polling, and SHALL translate those signals into the same notification events as the SignalR provider.

#### Scenario: Polling provider emits comment events
- **WHEN** the polling provider detects a new comment via the platform's REST API since the last seen timestamp
- **THEN** it emits an `onCommentAdded` event with the same shape as the SignalR provider

#### Scenario: Polling cadence does not block UI
- **WHEN** the polling provider is active
- **THEN** it polls on a background schedule without blocking interactive rendering or user input

### Requirement: Notification Event Coverage
The system SHALL surface notifications for every category of state change relevant to a review: review metadata, reviewer participation, iterations, comments, status transitions, custom properties, pull request data, and policy evaluations. Each notification MUST include the review identifier, a timestamp, and category-specific fields sufficient to update local state.

#### Scenario: Comment notification carries action and identifiers
- **WHEN** a remote user adds, edits, or deletes a comment
- **THEN** the client receives a comment notification whose `action` field is `added`, `updated`, or `deleted` and whose `threadId` and `commentId` identify the affected thread

#### Scenario: Status notification carries old and new status
- **WHEN** a review status transitions (for example from `active` to `completed`)
- **THEN** the status notification includes both `oldStatus` and `newStatus` and the actor who changed it

### Requirement: Stale Notification Rejection
The system SHALL reject notifications whose timestamp predates the locally tracked `lastModified` value for the affected entity, or whose revision number is older than the revision already applied locally. Rejected notifications MUST NOT mutate local state.

#### Scenario: Older timestamp is ignored
- **WHEN** a notification arrives with a timestamp earlier than the last applied update for the same review
- **THEN** the notification is discarded and no state mutation occurs

#### Scenario: Stale revision is ignored
- **WHEN** a review notification carries a revision number lower than or equal to the revision already applied
- **THEN** the notification is discarded

### Requirement: Notification Dispatch And Last-Seen Tracking
The system SHALL dispatch each accepted notification to a type-specific handler and SHALL advance the last-seen timestamp for the affected entity after the handler completes successfully. For comment notifications the handler MUST fetch the full comment payload from the API on `added`/`updated` and remove the comment locally on `deleted`.

#### Scenario: Comment add fetches full payload
- **WHEN** a `comment` notification with `action: added` is accepted
- **THEN** the handler fetches the full comment body from the platform API before inserting it into the local `comments` store

#### Scenario: Comment delete removes locally without API call
- **WHEN** a `comment` notification with `action: deleted` is accepted
- **THEN** the handler removes the comment from local state without issuing a fetch

### Requirement: Optimistic UI Updates With Rollback
The system SHALL apply user-initiated mutations (e.g. adding a comment, resolving a thread, changing review status) to local state immediately before the server confirms them. The system MUST snapshot the prior state before applying the change so that, on server failure, the local state can be rolled back to the snapshot and the user can be informed.

#### Scenario: Successful server confirmation keeps optimistic state
- **WHEN** a user posts a comment optimistically and the server returns success
- **THEN** the optimistic comment is reconciled with the server response and remains in local state

#### Scenario: Server failure rolls back optimistic state
- **WHEN** an optimistic mutation fails server-side
- **THEN** the system restores the snapshot taken before the mutation and surfaces the failure to the user

### Requirement: Delta Fetching With ETag And Last-Modified
The system SHALL use HTTP conditional request headers (`If-None-Match` with ETag and/or `If-Modified-Since` with `Last-Modified`) when polling platform APIs for updates, and SHALL treat a `304 Not Modified` response as a no-op so that unchanged resources do not trigger UI work.

#### Scenario: Unchanged resource returns 304
- **WHEN** the polling fallback issues a conditional request whose ETag matches the server's current ETag
- **THEN** the server returns 304 and the client does not emit any notification or update state

#### Scenario: Changed resource returns 200 with new ETag
- **WHEN** a conditional request finds the resource has changed
- **THEN** the client stores the new ETag/`Last-Modified` value and dispatches notifications for the delta

### Requirement: Auto-Reconnect With Exponential Backoff
When a real-time connection drops unexpectedly, the system SHALL automatically attempt to reconnect using an exponential backoff schedule (with increasing delays between attempts). After exhausting the configured maximum number of attempts, the system MUST fall back to the polling provider so that the user continues to receive updates.

#### Scenario: Reconnect attempts back off between retries
- **WHEN** the SignalR socket drops and the client begins reconnecting
- **THEN** the delay between successive reconnect attempts grows monotonically rather than retrying immediately in a tight loop

#### Scenario: Max attempts triggers polling fallback
- **WHEN** the maximum number of reconnect attempts is reached without success
- **THEN** the client switches to polling fallback and continues to emit notifications via that provider

### Requirement: Token Expiry Refresh And Resubscribe
When the real-time connection is terminated because the authentication token has expired, the system SHALL refresh the token, reconnect using the new credentials, and re-subscribe to the same event types for the same review identifier without requiring user action.

#### Scenario: Expired token triggers silent refresh
- **WHEN** the server closes the SignalR connection citing expired credentials
- **THEN** the client refreshes the token, opens a new connection, and re-subscribes to the previously subscribed event types

#### Scenario: Refresh failure prompts re-authentication
- **WHEN** the token refresh itself fails
- **THEN** the client stops auto-reconnecting and surfaces a re-authentication prompt to the user

### Requirement: Subscription Scoping And Teardown
The system SHALL scope subscriptions to a specific review identifier and SHALL unsubscribe and disconnect when the user navigates away from that review, so that closed reviews do not continue to consume notifications, network, or CPU.

#### Scenario: Navigating away unsubscribes
- **WHEN** the user closes or navigates away from a review whose real-time connection is open
- **THEN** the client invokes `unsubscribe` for that review and disconnects if no other reviews remain subscribed

#### Scenario: Switching reviews swaps subscriptions
- **WHEN** the user switches from review A to review B
- **THEN** the client unsubscribes from A's event types and subscribes to B's before delivering notifications for B

### Requirement: Cross-Capability Notification Routing
The system SHALL route accepted notifications to the affected capability stores so that downstream features stay synchronized: comment notifications update the `comments` capability, iteration notifications update the `iterations` capability, and review/status notifications update the `review-lifecycle` capability.

#### Scenario: Iteration notification refreshes iteration list
- **WHEN** an `iteration` notification is accepted for the currently open review
- **THEN** the `iterations` capability is signalled to load the new iteration so it appears in the iteration selector

#### Scenario: Status notification updates review lifecycle
- **WHEN** a `status` notification is accepted
- **THEN** the `review-lifecycle` capability reflects the new status without requiring a full review reload

