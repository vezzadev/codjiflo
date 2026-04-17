# Comment System Specification

---

## Overview

CodjiFlo's comment system allows reviewers to attach discussions to specific code locations with:
- **Floating bubble comments** connected to code via lasso lines
- **Character-level precision** for comment anchoring
- **Thread-based discussions** with status tracking
- **Persistent positioning** across sessions and iterations

---

## Display Modes

Two comment display modes:
- **Bubble Mode** (primary): Floating comment boxes at the right edge, connected to code via "lasso" lines that surround the code snippet chosen by the reviewer
- **Interlinear Mode**: Comments displayed inline between code lines, no lasso needed

---

## Bubble Positioning

### Size Constraints (Recommended)

| Property | Suggested Value | Description |
|----------|-----------------|-------------|
| Minimum Width | ~330px | Ensures readability |
| Minimum Height | ~90px | Fits basic content |
| Maximum Width | ~80% of viewport | Scales with viewer |
| Maximum Height | ~80% of viewport | Scales with viewer |
| Default Width | ~330px | For new comments |

### Position Properties

```typescript
interface BubblePosition {
  // Absolute position in viewport
  x: number;                    // Horizontal position (from left)
  relativeY: number;            // Vertical offset from lasso anchor

  // Tracking offsets (for code movement)
  bubbleSpanTopOffset: number;  // Distance from bubble top to code line top
  bubbleSpanBottomOffset: number; // Distance from bubble bottom to code line bottom

  // Tracking span (follows code as it moves)
  bubbleSpan: TrackingSpan;
}
```

### Positioning Algorithm

When the attached code is visible, bubbles anchor to the exact code line. When code scrolls out of view, bubbles anchor to the nearest viewport edge and are marked as "provisional" (indicating the anchor is approximate).

New comments position at the right edge of the viewport, vertically aligned with the lasso anchor point.

---

## Lasso (Connector Line)

The lasso connects the bubble to the code region it references.

### Visual Appearance (Suggested Styling)

| Property | Suggested Value |
|----------|-----------------|
| Line Color | Semi-transparent blue |
| Fill Color | Very transparent blue |
| Line Thickness (normal) | ~1px |
| Line Thickness (focused) | ~2px |

### Geometry Types

**Non-Empty Spans (Text Selection):**
The selected text region is highlighted with fill color. A rubber band line connects from the rightmost-bottom point of the selection to the bubble's left edge.

**Empty Spans (Point Comments):**
For zero-length spans, display an 8-pointed asterisk marker at the position. The asterisk has 4 cardinal rays and 4 diagonal rays extending from a small inner radius to a larger outer radius.

**Rubber Band Behavior:**
The connecting line updates automatically as the bubble is dragged, always running from the lasso anchor point to the bubble edge.

---

## Comment Threading

### Thread Structure

```typescript
interface CommentThread {
  id: number;
  status: CommentThreadStatus;
  root: Comment;              // First comment
  replies: Comment[];         // Nested replies

  // Location
  filePath: string;
  location: CommentLocation;
  viewContext: CommentViewContext;  // Both, LeftOnly, RightOnly

  // Display state (per-user)
  isCollapsed: boolean;
  position: Point;
  dimensions: Size;
  zIndex: number;
}

interface Comment {
  id: number;
  threadId: number;
  parentId: number;           // 0 for root
  author: Participant;
  text: string;
  createdDate: Date;
  lastUpdatedDate: Date;
  withdrawn: boolean;
  enableMarkdown: boolean;
  likes: Like[];
  children: Comment[];        // Nested replies
}
```

### Thread Status

Threads have statuses: **Active** (open, needs attention), **Pending** (waiting on someone), **Resolved** (issue addressed), **WontFix** (won't be addressed), **ByDesign** (intentional, VSO only), **Closed** (archived).

### Display Options

Comments display either **Flat** (chronological order) or **Nested** (hierarchical reply structure).

---

## Collapse/Expand

### Collapsed State

When collapsed, bubbles move to the **Comment Margin**:

| Property | Suggested Value |
|----------|-----------------|
| Margin Width | ~25px |
| Button Width | ~44px |

### Collapse Behavior

**Collapsing:** Remove bubble and lasso from view, add an indicator to the comment margin, persist collapsed state.

**Expanding:** Remove margin indicator, regenerate lasso geometry, restore bubble to view at its saved position, bring to top z-index, persist expanded state.

---

## Comment Filtering

Comments can be filtered by three dimensions:
- **Status:** Show/hide threads by status (Active, Resolved, etc.)
- **Author:** Hide threads from specific participants
- **Iteration:** Show/hide threads by the iteration they were created in

Threads with unpublished comments are always visible regardless of status filter. A global "hide everything" override can temporarily hide all comments.

---

## User Interactions

### Creating a Comment

From a text selection: compute the location, create a thread with "active" status, generate bubble and lasso, position the bubble at the right edge aligned with the selection, and focus the comment input.

### Drag Behavior

On drag start, bring the bubble to the top z-index. During drag, update position by the drag delta, constrain to viewport bounds, and update the tracking span so the bubble follows code movement.

### Resize Behavior

Bubbles resize from any edge. Resizing the left or top edge also shifts position to keep the opposite edge anchored. All dimensions are clamped to min/max bounds.

### Status Changes

Changing thread status updates the local model, notifies the backend, refreshes the display, and reapplies filters (which may hide the thread based on its new status).

---

## Per-User State Persistence

Each user's bubble positions, dimensions, collapse states, and z-indices are stored separately. Different users see different layouts. State persists across sessions.

---

## Z-Index Management

Bubbles may overlap; each drag operation brings that bubble to top by incrementing its z-index.

---

## Adornment Layers

Two separate layers for comment rendering:

| Layer | Purpose | Positioning |
|-------|---------|-------------|
| CommentLassoLayer | Lasso shapes and lines | Text-relative (moves with scroll) |
| CommentBubbleLayer | Bubble controls | Owner-controlled (fixed viewport position) |

---

## Keyboard Navigation

| Key | Action |
|-----|--------|
| Tab | Move between comments |
| Enter | Submit comment / open reply |
| Escape | Cancel editing / collapse |
| Ctrl+Enter | Submit and close |

---

## Platform Considerations

### Features by Platform

| Feature | Azure DevOps | GitHub | GitLab |
|---------|--------------|--------|--------|
| Thread status | 6 states | 5 states | 2 states |
| Likes | Yes | No | No |
| Feedback | Yes | No | No |
| Character-level spans | Yes | Partial | Partial |
| Nested replies | Yes | Yes | Yes |

### Web Implementation Notes

Use CSS absolute positioning for bubbles, SVG paths for lassos, pointer events for drag/resize, and CSS z-index for layering. State can persist via backend API or localStorage.

---

## Behavioral Requirements Checklist

- [ ] Bubble minimum size: ~330×90px (adjustable)
- [ ] Bubble maximum size: ~80% of viewport
- [ ] Lasso color: semi-transparent blue
- [ ] Lasso thickness: thin normal, thicker on focus
- [ ] Empty span marker: 8-pointed asterisk
- [ ] Drag constrained to viewport
- [ ] Z-index increases on drag start
- [ ] Collapse to narrow margin
- [ ] Expand restores position
- [ ] Filter by status/author/iteration
- [ ] Position persists per user
- [ ] Thread status transitions
- [ ] Nested reply support
