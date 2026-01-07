import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@/tests/helpers";
import userEvent from "@testing-library/user-event";
import { CommentItem } from "./CommentItem";
import type { Comment } from "../types";

const mockComment: Comment = {
  id: "comment-1",
  body: "This is a test comment",
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
};

describe("CommentItem", () => {
  const defaultProps = {
    comment: mockComment,
    isCurrentUser: false,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
  };

  it("renders comment body", () => {
    render(<CommentItem {...defaultProps} />);
    expect(screen.getByText("This is a test comment")).toBeInTheDocument();
  });

  it("renders author login", () => {
    render(<CommentItem {...defaultProps} />);
    expect(screen.getByText("testuser")).toBeInTheDocument();
  });

  it("renders author avatar", () => {
    render(<CommentItem {...defaultProps} />);
    const avatar = screen.getByAltText("testuser avatar");
    expect(avatar).toBeInTheDocument();
    // Next.js Image transforms the src to an optimized URL
    expect(avatar.getAttribute("src")).toContain("avatar.png");
  });

  it("renders time ago", () => {
    render(<CommentItem {...defaultProps} />);
    expect(screen.getByText("just now")).toBeInTheDocument();
  });

  it("has accessible article label", () => {
    render(<CommentItem {...defaultProps} />);
    expect(screen.getByRole("article")).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Comment by testuser")
    );
  });

  it("shows pending badge when comment is pending", () => {
    const pendingComment = { ...mockComment, isPending: true };
    render(<CommentItem {...defaultProps} comment={pendingComment} />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("does not show pending badge when comment is not pending", () => {
    render(<CommentItem {...defaultProps} />);
    expect(screen.queryByText("Pending")).not.toBeInTheDocument();
  });

  it("shows edit and delete buttons for current user", () => {
    render(<CommentItem {...defaultProps} isCurrentUser={true} />);
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("does not show edit and delete buttons for other users", () => {
    render(<CommentItem {...defaultProps} isCurrentUser={false} />);
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("calls onEdit when edit button is clicked", async () => {
    const onEdit = vi.fn();
    render(<CommentItem {...defaultProps} isCurrentUser={true} onEdit={onEdit} />);

    await userEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("calls onDelete when delete button is clicked", async () => {
    const onDelete = vi.fn();
    render(<CommentItem {...defaultProps} isCurrentUser={true} onDelete={onDelete} />);

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  describe("with pre-rendered HTML", () => {
    it("renders pre-rendered HTML content", () => {
      const comment = { ...mockComment, renderedHtml: "<p><strong>bold text</strong></p>" };
      render(<CommentItem {...defaultProps} comment={comment} />);
      expect(screen.getByText("bold text")).toBeInTheDocument();
    });

    it("renders links from pre-rendered HTML", () => {
      const comment = {
        ...mockComment,
        renderedHtml: '<p>Check <a href="https://example.com">this</a></p>',
      };
      render(<CommentItem {...defaultProps} comment={comment} />);

      const link = screen.getByRole("link", { name: "this" });
      expect(link).toHaveAttribute("href", "https://example.com");
    });

    it("renders task lists from pre-rendered HTML", () => {
      const comment = {
        ...mockComment,
        renderedHtml: '<ul><li><input type="checkbox" checked disabled /> Done</li><li><input type="checkbox" disabled /> Todo</li></ul>',
      };
      render(<CommentItem {...defaultProps} comment={comment} />);

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes).toHaveLength(2);
      expect(checkboxes[0]).toBeChecked();
      expect(checkboxes[1]).not.toBeChecked();
    });
  });

  describe("fallback to runtime markdown rendering", () => {
    it("renders markdown content", () => {
      const comment = { ...mockComment, body: "**bold text**" };
      render(<CommentItem {...defaultProps} comment={comment} />);
      expect(screen.getByText("bold text")).toBeInTheDocument();
    });

    it("renders external links with indicator", () => {
      const comment = { ...mockComment, body: "Check [this](https://example.com)" };
      render(<CommentItem {...defaultProps} comment={comment} />);

      const link = screen.getByRole("link", { name: /this/i });
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(screen.getByText("↗")).toBeInTheDocument();
    });

    it("renders internal links without external indicator", () => {
      const comment = { ...mockComment, body: "Check [this](/local-path)" };
      render(<CommentItem {...defaultProps} comment={comment} />);

      const link = screen.getByRole("link", { name: "this" });
      expect(link).not.toHaveAttribute("target", "_blank");
      expect(screen.queryByText("↗")).not.toBeInTheDocument();
    });

    it("renders GFM task lists", () => {
      const comment = { ...mockComment, body: "- [x] Done\n- [ ] Todo" };
      render(<CommentItem {...defaultProps} comment={comment} />);

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes).toHaveLength(2);
      expect(checkboxes[0]).toBeChecked();
      expect(checkboxes[1]).not.toBeChecked();
    });
  });
});
