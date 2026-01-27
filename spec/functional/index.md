# CodjiFlo Specification Index

---

## Features Summary

**Context:** CodjiFlo is a code review tool inspired by Microsoft's CodeFlow, used by ~40,000 developers. Its features represent best practices in code review tooling.

### 1. Advanced Commenting Capabilities

**Precision Commenting**
- Single-character commenting - Mark specific characters within a line, not just entire lines
- Region spanning - Attach comments to multiple lines simultaneously (both deleted and inserted lines)
- Floating comment objects - Comments are visual objects with lines connecting them to code selections
  - Can be moved around freely in the UI
  - Visual connection remains even as code changes
- Comment threading - Organize discussions in threaded conversations
- Comment states - Track comment status: pending, won't fix, fixed, resolved
- Bulk resolution - Resolve entire comment threads at once

**Comment Persistence**
- Super-precise tracking - Comments stay attached to correct code as it moves through iterations
- Iteration tracking - Comments follow code even as lines are added, deleted, or moved
- Comment filtering - Filter by state, author, participation

### 2. Iteration-Based Review Flow

**Revision Management**
- Before/During/After diff toggle - Users may quickly toggle between how the file looked before, during, and after changes for contextual understanding
- Iteration comparison - View specific changes between any two review versions
- Relative diffs - See only what changed since last review
- Full history - Track complete evolution of code through all iterations
- Comment tracking across iterations - See how feedback was addressed in each iteration

**Review States**
- Multiple reviewer states: Accepted, Reviewing, Awaiting changes, Decline to review, Reject change
- Per-reviewer tracking - Individual state for each reviewer
- Progress visibility - Clear indication of review status

### 3. Build and CI Integration

**Automated Testing**
- Automatic build triggering - Start production and smoke-test builds on review creation
- Build status visibility - All reviewers can see build results
- Block on failures - Prevent review completion until builds pass
- Iteration-specific builds - Track build status per iteration

**Quality Gates**
- Pre-merge validation - Code policies / checks are clearly visible in UI so reviewers can start reviewing / approving once their personal minimum quality bar is met
- Bot reviewers - Automated analysis (e.g., StyleCop, linters)
- Inline lint results - Display static analysis findings in review UI
- Code coverage display - Show test coverage metrics

### 4. Context and Metadata

**Enhanced Context**
- Full file display - Show entire files, not just changed sections
- Surrounding code visibility - Understand changes in broader context
- Author notes - Explain reasoning and intent behind changes

### CodeFlow Research Findings
- 20 minutes/day average active use per developer
- 15% of comments relate to bugs
- 50%+ of comments focus on maintainability
- Reviews > 20 files show degraded comment quality

### Key Differentiators
1. Comment precision - Character-level vs. line-level commenting
2. Before/Both/After diff toggle - Users may quickly inspect how the file looked before, during, and after changes
3. Iteration tracking - Comments persist through code movement
4. Review states - Granular workflow states vs. simple approve/request changes
5. Build integration - Automatic CI triggering and blocking
6. Comment threading - Better conversation organization
7. Region commenting - Multi-line comment spanning

---

## Quick Reference

| Spec | Status | Purpose |
|------|--------|---------|
| [models.md](models.md) | ✓ Complete | Core data entities |
| [backend-abstraction.md](backend-abstraction.md) | ✓ Complete | Multi-platform API layer |
| [diff-viewing.md](diff-viewing.md) | ✓ Complete | Diff rendering system |
| [comments.md](comments.md) | ✓ Complete | Bubble comments |
| [iterations.md](iterations.md) | ✓ Complete | Cross-version tracking |
| [review-lifecycle.md](review-lifecycle.md) | ✓ Complete | States & transitions |
| [ui-components.md](ui-components.md) | ✓ Complete | Dashboard, Explorer, Properties |
| [realtime.md](realtime.md) | ✓ Complete | Push notifications |
| [unauthenticated-access.md](unauthenticated-access.md) | ✓ Complete | Public repo access without login |
| [meta-spec.md](meta-spec.md) | ✓ Complete | Extraction methodology |

---

## Core Value Proposition

### 2. Diff Viewing
> [diff-viewing.md](diff-viewing.md)

Multi-mode diff display with word-level highlighting.

**Key Concepts:**
- Four view modes: Inline, SideBySide, LeftOnly, RightOnly
- Hierarchical diff: line-level → word-level
- SpanTracker for position mapping
- TripleSnapshot (left, right, projection)

### 3. Comment System (Bubble Comments)
> [comments.md](comments.md)

The beloved floating comment bubbles with lasso connectors.

**Key Behaviors:**
- Bubble size: minimum ~330×90px, max ~80% viewport
- Lasso color: semi-transparent blue
- Empty span marker: 8-pointed asterisk
- Per-user position persistence
- Collapse to narrow margin

### 4. Iteration Management
> [iterations.md](iterations.md)

Comments follow code across changes.

**Key Concepts:**
- Snapshot pairs: left (even) / right (odd)
- SpanTracker: forward/backward position mapping
- Artifact tracking: file lineage across renames
- Cross-iteration comparison

---

## Supporting Features

### Backend Abstraction Layer
> [backend-abstraction.md](backend-abstraction.md)

Platform-agnostic interfaces enabling Azure DevOps, GitHub, and GitLab support.

**Key Interfaces:**
- `IReviewBackend` - Review CRUD
- `ICommentBackend` - Comments & threads
- `IIterationBackend` - Version comparison
- `IParticipantBackend` - Reviewers
- `IRealTimeBackend` - Push notifications

**Capability Matrix:** Documents what each platform supports/lacks.

### Data Models
> [models.md](models.md)

TypeScript interfaces for all domain entities.

**Key Entities:**
- `CodeReview`, `ReviewIteration`
- `CommentThread`, `Comment`
- `Reviewer`, `Author`, `Participant`
- `FileRegion`, `DiffContext`

### Review Lifecycle
> [review-lifecycle.md](review-lifecycle.md)

State machine and permission model.

**States:** Local → Active → Completed/Aborted/Expired
**Policies:** ApproverCount, RequiredReviewers, Build, CommentResolution

### UI Components
> [ui-components.md](ui-components.md)

Dashboard, File Explorer, Review Properties.

**Dashboard:** Subscriptions, filtering, sorting
**File Explorer:** Tree view, marking, acquisition states
**Properties:** Dynamic metadata display

### Real-Time Updates
> [realtime.md](realtime.md)

Push notifications for live sync.

**Azure DevOps:** SignalR WebSocket
**Others:** Webhook + polling fallback

---

## Key Behavioral Requirements

### Comments
- [ ] Character-level span attachment
- [ ] Bubble minimum ~330×90px, max ~80% viewport
- [ ] Lasso connector with semi-transparent blue
- [ ] 8-pointed asterisk for empty spans
- [ ] Collapse to narrow margin
- [ ] Per-user position persistence
- [ ] Filter by status/author/iteration

### Diff
- [ ] Line + word-level highlighting
- [ ] Four view modes with switching
- [ ] Scroll synchronization
- [ ] Whitespace toggle
- [ ] Theme-aware colors

### Iterations
- [ ] Compare any two iterations
- [ ] Comments track forward/backward
- [ ] Handle renames, deletes
- [ ] Platform abstraction

### Real-Time
- [ ] WebSocket for Azure DevOps
- [ ] Polling fallback
- [ ] Optimistic updates
- [ ] Conflict resolution

## References

### Primary Sources
- **ACM Queue Article:** "CodeFlow: Improving the Code Review Process at Microsoft" (2018)
  - Interview with Jacek Czerwonka, Michaela Greiler, Christian Bird, Lucas Panjer, Terry Coatta
  - URL: https://queue.acm.org/detail.cfm?id=3292420
- **Research Team:** Jacek Czerwonka, Michaela Greiler, Christian Bird (Microsoft TSE - Tools for Software Engineers)
- **Research Data:** Analysis of 3+ million code reviews across Microsoft products

### Additional Sources
- **Hacker News Discussion** (February 2019): Feedback from former Microsoft employees and comparisons with Google Critique, Amazon CRUX
  - URL: https://news.ycombinator.com/item?id=19096844
  - 166 points, 81 comments
- **Dr. Michaela Greiler's Blog:** "How Code Reviews Work at Microsoft" - Overview of CodeFlow usage and practices
  - URL: https://www.michaelagreiler.com/code-reviews-at-microsoft-how-to-code-review-at-a-large-software-company/
  - Published: March 27, 2019 (Updated January 22, 2022)
- **Microsoft News Center** "A Bar, an Idea, and a Garage: The Story of CodeFlow"
  - URL: [Microsoft News Center dead link](http://www.microsoft.com/en-us/news/features/2012/jan12/01-05CodeFlow.aspx) ([Archived copy from the Wayback Machine](https://web.archive.org/web/20131006162507/http://www.microsoft.com/en-us/news/features/2012/jan12/01-05CodeFlow.aspx)
  - Published: January 5, 2012
