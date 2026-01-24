import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@/tests/helpers";
import userEvent from "@testing-library/user-event";
import { RegionCommentButton } from "./RegionCommentButton";

describe("RegionCommentButton", () => {
  const defaultProps = {
    position: { x: 100, y: 200 },
    region: { startLine: 5, endLine: 5 },
    onAddComment: vi.fn(),
  };

  it("renders at the specified position", () => {
    render(<RegionCommentButton {...defaultProps} />);

    const button = screen.getByRole("button");
    expect(button).toHaveStyle({ left: "100px", top: "200px" });
  });

  it("calls onAddComment when clicked", async () => {
    const onAddComment = vi.fn();
    render(<RegionCommentButton {...defaultProps} onAddComment={onAddComment} />);

    await userEvent.click(screen.getByRole("button"));

    expect(onAddComment).toHaveBeenCalledTimes(1);
  });

  it("uses custom aria-label when provided", () => {
    render(
      <RegionCommentButton
        {...defaultProps}
        ariaLabel="Custom label for comment"
      />
    );

    expect(
      screen.getByRole("button", { name: "Custom label for comment" })
    ).toBeInTheDocument();
  });

  it("generates single-line label for single line region", () => {
    render(
      <RegionCommentButton
        {...defaultProps}
        region={{ startLine: 10, endLine: 10 }}
      />
    );

    expect(
      screen.getByRole("button", { name: "Add comment to line 10" })
    ).toBeInTheDocument();
  });

  it("generates multi-line label for multi-line region", () => {
    render(
      <RegionCommentButton
        {...defaultProps}
        region={{ startLine: 5, endLine: 10 }}
      />
    );

    expect(
      screen.getByRole("button", { name: "Add comment to lines 5-10" })
    ).toBeInTheDocument();
  });

  it("has proper button type", () => {
    render(<RegionCommentButton {...defaultProps} />);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("type", "button");
  });

  it("has transform style for positioning", () => {
    render(<RegionCommentButton {...defaultProps} />);

    const button = screen.getByRole("button");
    expect(button).toHaveStyle({ transform: "translate(8px, -50%)" });
  });

  it("has the correct CSS class", () => {
    render(<RegionCommentButton {...defaultProps} />);

    const button = screen.getByRole("button");
    expect(button).toHaveClass("region-comment-button");
  });
});
