# backend-abstraction — Architecture

> Implementation reference. The behavioral contract lives in [spec.md](spec.md).

## Architecture

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

## Platform API Mappings

### Azure DevOps

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

### GitHub

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

## Span Mapping

Comments reference code positions that may move as iterations are added. The `IterationComparison.spanMappings` provides translation:

```typescript
interface SpanMapping {
  originalSpan: TextSpan;    // Position in base iteration
  mappedSpan: TextSpan;      // Position in target iteration
  changeType: 'unchanged' | 'modified' | 'deleted' | 'added';
}
```
