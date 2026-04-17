# Real-Time Updates Specification

---

## Overview

CodjiFlo uses real-time push notifications to keep reviews synchronized across clients. Azure DevOps uses SignalR; other platforms may use webhooks or polling.

---

## Architecture

```
┌─────────────────┐                    ┌─────────────────┐
│   CodjiFlo      │◄───── SignalR ────►│  Azure DevOps   │
│   Client        │      WebSocket     │    Server       │
└─────────────────┘                    └─────────────────┘
         │
         ▼
┌─────────────────┐
│  Review Model   │
│  (updated)      │
└─────────────────┘
```

---

## Connection

### SignalR Client (Azure DevOps)

```typescript
interface SignalRConnection {
  // Connection URL format
  url: string;  // {collectionUrl}/_signalr/{localPath}

  // Authentication
  authToken: string;  // PAT or OAuth token

  // Connection state
  isConnected: boolean;

  // Methods
  connect(reviewId: string): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(eventType: NotificationType): void;
  unsubscribe(eventType: NotificationType): void;
}
```

### Connection Lifecycle

Connect to `{collectionUrl}/_signalr/codeReview` with authentication, then invoke `subscribe` with the review ID and event types (review, iteration, comment, status, properties).

---

## Notification Types

Event types: **Review** (metadata), **Reviewers** (participants), **Iteration** (new version), **Comment** (add/update/delete), **Status** (review status), **Properties** (custom data), **PullRequestData**, **Policies** (evaluation results).

### Notification Payloads

```typescript
interface ReviewNotification {
  type: 'review';
  reviewId: string;
  revision: number;
  timestamp: Date;
  changes: {
    title?: string;
    description?: string;
    status?: ReviewStatus;
  };
}

interface IterationNotification {
  type: 'iteration';
  reviewId: string;
  iterationId: number;
  author: string;
  timestamp: Date;
}

interface CommentNotification {
  type: 'comment';
  reviewId: string;
  threadId: number;
  commentId: number;
  action: 'added' | 'updated' | 'deleted';
  author: string;
  timestamp: Date;
}

interface ReviewerNotification {
  type: 'reviewers';
  reviewId: string;
  action: 'added' | 'removed' | 'status_changed';
  reviewer: string;
  status?: ReviewerStatus;
  timestamp: Date;
}

interface StatusNotification {
  type: 'status';
  reviewId: string;
  oldStatus: ReviewStatus;
  newStatus: ReviewStatus;
  changedBy: string;
  timestamp: Date;
}

interface PolicyNotification {
  type: 'policies';
  reviewId: string;
  policyId: string;
  status: PolicyEvaluationStatus;
  timestamp: Date;
}
```

---

## Event Handling

### Notification Processing

1. Validate timestamp (ignore stale notifications older than last update)
2. Dispatch to type-specific handler
3. For comment notifications: fetch full data from API on add/update, remove locally on delete
4. Update last-seen timestamp

Organize handlers by notification type (e.g., `CommentUpdateHandler`, `IterationUpdateHandler`).

---

## Conflict Resolution

### Optimistic Updates

Apply changes locally first, send to server, rollback on failure. Store original state before applying to enable rollback.

### Timestamp Validation

Reject notifications older than current state's `lastModified` timestamp or with a stale revision number.

---

## Platform Abstraction

### IRealTimeProvider

```typescript
interface IRealTimeProvider {
  readonly supportsRealTime: boolean;
  readonly connectionType: 'websocket' | 'polling' | 'sse';

  connect(reviewId: string): Promise<void>;
  disconnect(): Promise<void>;

  // Events
  onReviewUpdated: Event<ReviewNotification>;
  onIterationAdded: Event<IterationNotification>;
  onCommentAdded: Event<CommentNotification>;
  onCommentUpdated: Event<CommentNotification>;
  onReviewerChanged: Event<ReviewerNotification>;
  onStatusChanged: Event<StatusNotification>;
  onPoliciesChanged: Event<PolicyNotification>;
}
```

### Platform Implementations

| Platform | Method | Notes |
|----------|--------|-------|
| Azure DevOps | SignalR | Full real-time support |
| GitHub | Webhooks + Polling | Requires server component |
| GitLab | Webhooks + Polling | Requires server component |

### Polling Fallback

For platforms without push: poll the API periodically (~30 seconds), fetch updates since last timestamp, dispatch as notifications.

---

## Reconnection

### Auto-Reconnect

Use exponential backoff (e.g., 1s, 2s, 5s, 10s, 30s delays). After max attempts, fall back to polling.

### Connection Expiry

On token expiration: refresh token, reconnect with new credentials, re-subscribe to events.
