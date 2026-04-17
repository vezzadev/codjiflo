import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@/tests/helpers";
import userEvent from "@testing-library/user-event";
import { CommentThread } from "./CommentThread";
import type { ReviewThread } from "../types";

const mockThread: ReviewThread = {
  id: "thread-1",
  path: "src/test.ts",
  line: 10,
  side: "RIGHT",
  isResolved: false,
  originalLine: 10,
  originalCommitId: "abc123",
  trackedLine: null,
  comments: [
    {
      id: "comment-1",
      body: "First comment",
      author: {
        id: "user-1",
        login: "testuser",
        avatarUrl: "https://example.com/avatar.png",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      path: "src/test.ts",
      line: 10,
      side: "RIGHT",
      position: 1,
      originalLine: 10,
      originalCommitId: "abc123",
    },
  ],
};

describe("CommentThread", () => {
  const defaultProps = {
    thread: mockThread,
    currentUserLogin: "testuser",
    onReply: vi.fn().mockResolvedValue(undefined),
    onEdit: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onToggleResolved: vi.fn(),
  };

  it("renders thread header with line number", () => {
    render(<CommentThread {...defaultProps} />);
    expect(screen.getByText("Thread on line 10")).toBeInTheDocument();
  });

  it("has accessible section label", () => {
    render(<CommentThread {...defaultProps} />);
    const section = screen.getByRole("region");
    expect(section).toHaveAttribute(
      "aria-label",
      "Thread on line 10 (added line)"
    );
  });

  it("renders all comments in the thread", () => {
    render(<CommentThread {...defaultProps} />);
    expect(screen.getByText("First comment")).toBeInTheDocument();
  });

  it("renders resolve button for unresolved thread", () => {
    render(<CommentThread {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Resolve conversation" })).toBeInTheDocument();
  });

  it("renders unresolve button for resolved thread", () => {
    const resolvedThread = { ...mockThread, isResolved: true };
    render(<CommentThread {...defaultProps} thread={resolvedThread} />);
    expect(screen.getByRole("button", { name: "Unresolve" })).toBeInTheDocument();
  });

  it("shows resolved badge for resolved thread", () => {
    const resolvedThread = { ...mockThread, isResolved: true };
    render(<CommentThread {...defaultProps} thread={resolvedThread} />);
    expect(screen.getByText("Resolved")).toBeInTheDocument();
  });

  it("calls onToggleResolved when resolve button is clicked", async () => {
    const onToggleResolved = vi.fn();
    render(<CommentThread {...defaultProps} onToggleResolved={onToggleResolved} />);
    
    await userEvent.click(screen.getByRole("button", { name: "Resolve conversation" }));
    
    expect(onToggleResolved).toHaveBeenCalledWith("thread-1");
  });

  it("renders reply editor", () => {
    render(<CommentThread {...defaultProps} />);
    expect(screen.getByLabelText("Reply to conversation")).toBeInTheDocument();
  });

  it("calls onReply when submitting a reply", async () => {
    const onReply = vi.fn().mockResolvedValue(undefined);
    render(<CommentThread {...defaultProps} onReply={onReply} />);
    
    const textarea = screen.getByLabelText("Reply to conversation");
    await userEvent.type(textarea, "My reply");
    await userEvent.click(screen.getByRole("button", { name: "Reply" }));
    
    expect(onReply).toHaveBeenCalledWith("thread-1", "My reply");
  });

  it("shows edit and delete buttons for current user comments", () => {
    render(<CommentThread {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("hides edit and delete buttons for other users comments", () => {
    render(<CommentThread {...defaultProps} currentUserLogin="otheruser" />);
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("shows edit form when edit button is clicked", async () => {
    render(<CommentThread {...defaultProps} />);
    
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    
    expect(screen.getByLabelText("Edit comment")).toBeInTheDocument();
  });

  it("pre-fills edit form with comment body", async () => {
    render(<CommentThread {...defaultProps} />);
    
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    
    const textarea = screen.getByLabelText("Edit comment");
    expect(textarea).toHaveValue("First comment");
  });

  it("calls onEdit when submitting edit", async () => {
    const onEdit = vi.fn().mockResolvedValue(undefined);
    render(<CommentThread {...defaultProps} onEdit={onEdit} />);
    
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    
    const textarea = screen.getByLabelText("Edit comment");
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "Updated comment");
    await userEvent.click(screen.getByRole("button", { name: "Update" }));
    
    expect(onEdit).toHaveBeenCalledWith("comment-1", "Updated comment");
  });

  it("cancels edit when cancel button is clicked", async () => {
    render(<CommentThread {...defaultProps} />);
    
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Edit comment")).toBeInTheDocument();
    
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Edit comment")).not.toBeInTheDocument();
    expect(screen.getByText("First comment")).toBeInTheDocument();
  });

  it("calls onDelete with confirmation when delete button is clicked", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    
    render(<CommentThread {...defaultProps} onDelete={onDelete} />);
    
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    
    expect(window.confirm).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalledWith("comment-1");
    
    vi.restoreAllMocks();
  });

  it("does not call onDelete when confirmation is cancelled", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    
    render(<CommentThread {...defaultProps} onDelete={onDelete} />);
    
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    
    expect(window.confirm).toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
    
    vi.restoreAllMocks();
  });

  it("renders LEFT side label for deleted line thread", () => {
    const leftThread = { ...mockThread, side: "LEFT" as const };
    render(<CommentThread {...defaultProps} thread={leftThread} />);
    
    const section = screen.getByRole("region");
    expect(section).toHaveAttribute(
      "aria-label",
      "Thread on line 10 (deleted line)"
    );
  });
});
