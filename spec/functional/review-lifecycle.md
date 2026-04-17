# Review Lifecycle Specification

---

## Review States

Reviews progress through states: **Created** (on server, draft), **Active** (open for review), **Draft** (PR draft mode), **Completed** (finished), **Aborted** (recalled/abandoned), **Expired** (time limit exceeded).

---

## State Machine

```
                    ┌───────────────────────────────┐
                    │        ACTIVE / DRAFT         │
                    │       (Review Open)           │
                    └───────────────┬───────────────┘
                                    │
           ┌────────────────────────┼────────────────────────┐
           │                        │                        │
           ▼                        ▼                        ▼
    ┌──────────┐             ┌──────────┐             ┌──────────┐
    │COMPLETED │             │ ABORTED  │             │ EXPIRED  │
    │ (Closed) │             │(Recalled)│             │(Timeout) │
    └──────────┘             └────┬─────┘             └──────────┘
                                  │
                             REACTIVATE
                            (Author Only)
                                  │
                                  ▼
                           ┌──────────┐
                           │  ACTIVE  │
                           └──────────┘
```

---

## State Transitions

| Transition | From | To | Who | Notes |
|------------|------|-----|-----|-------|
| Publish | Draft | Active | Any participant | |
| Complete | Active | Completed | Any participant | Policies must pass for PRs |
| Recall/Abandon | Active, Draft | Aborted | Any participant | |
| Reactivate | Aborted | Active | Any participant | |

---

## Participant Roles

Roles: **Author**, **Reviewer**, **AuthorAndReviewer** (self-review), **MentionedUser**.

## Reviewer Status

Statuses: **NotStarted**, **Started**, **Reviewing**, **Waiting** (for author), **SignedOff** (approved), **SignedOffWithComments**, **InviteOnly**, **Declined**, **Rejected** (blocking).

## Reviewer Kind

Reviewers are either **Required** or **Optional**.

---

## Permission Matrix

| Action | Author | Reviewer | Any User |
|--------|--------|----------|----------|
| Publish | ✓ | ✓ | ✓ |
| Complete | ✓ | ✓ | ✗ |
| Recall | ✓ | ✗ | ✗ |
| Reactivate | ✓ | ✗ | ✗ |
| Add Comment | ✓ | ✓ | ✗ |
| Change Status | ✗ | ✓ (own) | ✗ |
| Add Reviewer | ✓ | ✓ | ✗ |
| Remove Reviewer | ✓ | ✗ | ✗ |
| Create Iteration | ✓ | ✗ | ✗ |

---

## Read-Only States

Terminal states (Completed, Aborted, Expired) are read-only. Iterations can only be created on Active/Draft reviews by the author.

---

## Policy Evaluation

### Common Policies (Azure DevOps) / Checks (GitHub)

| Policy | Description |
|--------|-------------|
| Approver Count | Minimum approvers required |
| Required Reviewers | All required reviewers must approve |
| Build | Build must pass |
| Comment Resolution | All comments resolved |
| Work Item Linking | Work items linked |
| Status | Custom status checks |

### Policy States

Policies are evaluated as: **Queued**, **Running**, **Approved**, or **Rejected**.

### Completion Rules

Before completing (especially Pull Requests):
- All `RequiredReviewers` must approve
- `ApproverCount` threshold met
- `Build` passes (if configured)
- All comments resolved (if policy enabled)
- Work items linked (if required)
- Git history is merge/rebase-able

