import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@/tests/helpers";
import userEvent from "@testing-library/user-event";
import { CommentEditor } from "./CommentEditor";

describe("CommentEditor", () => {
  const defaultProps = {
    value: "",
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    label: "Add comment",
  };

  it("renders with label and textarea", () => {
    render(<CommentEditor {...defaultProps} />);
    expect(screen.getByLabelText("Add comment")).toBeInTheDocument();
  });

  it("renders with placeholder text", () => {
    render(<CommentEditor {...defaultProps} />);
    expect(screen.getByPlaceholderText("Leave a comment")).toBeInTheDocument();
  });

  it("calls onChange when typing", async () => {
    const onChange = vi.fn();
    render(<CommentEditor {...defaultProps} onChange={onChange} />);
    
    const textarea = screen.getByLabelText("Add comment");
    await userEvent.type(textarea, "Hello");
    
    expect(onChange).toHaveBeenCalled();
  });

  it("renders submit button with default label", () => {
    render(<CommentEditor {...defaultProps} />);
    expect(screen.getByRole("button", { name: "Comment" })).toBeInTheDocument();
  });

  it("renders submit button with custom label", () => {
    render(<CommentEditor {...defaultProps} submitLabel="Reply" />);
    expect(screen.getByRole("button", { name: "Reply" })).toBeInTheDocument();
  });

  it("disables submit button when value is empty", () => {
    render(<CommentEditor {...defaultProps} value="" />);
    expect(screen.getByRole("button", { name: "Comment" })).toBeDisabled();
  });

  it("enables submit button when value has content", () => {
    render(<CommentEditor {...defaultProps} value="Some text" />);
    expect(screen.getByRole("button", { name: "Comment" })).not.toBeDisabled();
  });

  it("disables submit button when isSubmitting", () => {
    render(<CommentEditor {...defaultProps} value="Some text" isSubmitting />);
    expect(screen.getByRole("button", { name: "Comment..." })).toBeDisabled();
  });

  it("shows loading spinner when isSubmitting", () => {
    render(<CommentEditor {...defaultProps} isSubmitting />);
    expect(screen.getByLabelText("Submitting comment")).toBeInTheDocument();
  });

  it("calls onSubmit when submit button is clicked", async () => {
    const onSubmit = vi.fn();
    render(<CommentEditor {...defaultProps} value="Test" onSubmit={onSubmit} />);
    
    await userEvent.click(screen.getByRole("button", { name: "Comment" }));
    
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("renders cancel button when onCancel is provided", () => {
    const onCancel = vi.fn();
    render(<CommentEditor {...defaultProps} onCancel={onCancel} />);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("does not render cancel button when onCancel is not provided", () => {
    render(<CommentEditor {...defaultProps} />);
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("calls onCancel when cancel button is clicked", async () => {
    const onCancel = vi.fn();
    render(<CommentEditor {...defaultProps} onCancel={onCancel} />);
    
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("disables cancel button when isSubmitting", () => {
    const onCancel = vi.fn();
    render(<CommentEditor {...defaultProps} onCancel={onCancel} isSubmitting />);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("submits on Ctrl+Enter when value is not empty", async () => {
    const onSubmit = vi.fn();
    render(<CommentEditor {...defaultProps} value="Test" onSubmit={onSubmit} />);
    
    const textarea = screen.getByLabelText("Add comment");
    await userEvent.type(textarea, "{Control>}{Enter}{/Control}");
    
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("does not submit on Ctrl+Enter when value is empty", async () => {
    const onSubmit = vi.fn();
    render(<CommentEditor {...defaultProps} value="   " onSubmit={onSubmit} />);
    
    const textarea = screen.getByLabelText("Add comment");
    await userEvent.type(textarea, "{Control>}{Enter}{/Control}");
    
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
