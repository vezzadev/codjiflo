import { describe, it, expect } from "vitest";
import { render, screen } from "@/tests/helpers";
import { Textarea } from "./Textarea";

describe("Textarea", () => {
  it("should render with label", () => {
    render(<Textarea label="Test Label" />);
    expect(screen.getByLabelText("Test Label")).toBeInTheDocument();
  });

  it("should render without label", () => {
    render(<Textarea placeholder="Enter text" />);
    expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
  });

  it("should display error message", () => {
    render(<Textarea label="Test" error="Error message" />);
    const errorElement = screen.getByText("Error message");
    expect(errorElement).toBeInTheDocument();
    expect(errorElement).toHaveAttribute("role", "alert");
    expect(errorElement).toHaveAttribute("aria-live", "polite");
  });

  it("should display helper text when no error", () => {
    render(<Textarea label="Test" helperText="Helper text" />);
    expect(screen.getByText("Helper text")).toBeInTheDocument();
  });

  it("should not display helper text when error exists", () => {
    render(<Textarea label="Test" helperText="Helper text" error="Error" />);
    expect(screen.queryByText("Helper text")).not.toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("should have accessible attributes when error", () => {
    render(<Textarea label="Test" error="Error message" />);
    const textarea = screen.getByLabelText("Test");
    expect(textarea).toHaveAttribute("aria-invalid", "true");
    expect(textarea).toHaveAttribute("aria-describedby");
  });

  it("should have aria-invalid false when no error", () => {
    render(<Textarea label="Test" />);
    const textarea = screen.getByLabelText("Test");
    expect(textarea).toHaveAttribute("aria-invalid", "false");
  });

  it("should be disabled when disabled prop is true", () => {
    render(<Textarea label="Test" disabled />);
    expect(screen.getByLabelText("Test")).toBeDisabled();
  });

  it("should forward ref correctly", () => {
    const ref = { current: null as HTMLTextAreaElement | null };
    render(<Textarea label="Test" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });

  it("should apply custom className", () => {
    render(<Textarea label="Test" className="custom-class" />);
    const textarea = screen.getByLabelText("Test");
    expect(textarea).toHaveClass("custom-class");
  });

  it("should accept rows prop", () => {
    render(<Textarea label="Test" rows={10} />);
    const textarea = screen.getByLabelText("Test");
    expect(textarea).toHaveAttribute("rows", "10");
  });
});
