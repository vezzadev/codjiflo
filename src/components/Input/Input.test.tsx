import { describe, it, expect } from "vitest";
import { render, screen } from "@/tests/helpers";
import { Input } from "./Input";

describe("Input", () => {
  it("should render with label", () => {
    render(<Input label="Test Label" />);
    expect(screen.getByLabelText("Test Label")).toBeInTheDocument();
  });

  it("should display error message", () => {
    render(<Input label="Test" error="Error message" />);
    const errorElement = screen.getByText("Error message");
    expect(errorElement).toBeInTheDocument();
    expect(errorElement).toHaveAttribute("role", "alert");
    expect(errorElement).toHaveAttribute("aria-live", "polite");
  });

  it("should display helper text when no error", () => {
    render(<Input label="Test" helperText="Helper text" />);
    expect(screen.getByText("Helper text")).toBeInTheDocument();
  });

  it("should not display helper text when error exists", () => {
    render(<Input label="Test" helperText="Helper text" error="Error" />);
    expect(screen.queryByText("Helper text")).not.toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("should have accessible attributes when error", () => {
    render(<Input label="Test" error="Error message" />);
    const input = screen.getByLabelText("Test");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby");
  });

  it("should be disabled when disabled prop is true", () => {
    render(<Input label="Test" disabled />);
    expect(screen.getByLabelText("Test")).toBeDisabled();
  });

  it("should forward ref correctly", () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<Input label="Test" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});
