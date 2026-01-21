import { describe, it, expect, vi } from "vitest";
import { render, screen } from "../../tests/helpers";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";

describe("Button", () => {
  it("renders with the provided label", () => {
    render(<Button label="Click me" />);
    expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const handleClick = vi.fn();
    render(<Button label="Click me" onClick={handleClick} />);

    await userEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", async () => {
    const handleClick = vi.fn();
    render(<Button label="Click me" onClick={handleClick} disabled />);

    await userEvent.click(screen.getByRole("button"));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("applies primary variant styles by default", () => {
    render(<Button label="Primary" />);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("btn-colorful");
  });

  it("applies secondary variant styles when specified", () => {
    render(<Button label="Secondary" variant="secondary" />);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("btn");
  });

  it("renders with type='button' by default", () => {
    render(<Button label="Click me" />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("type", "button");
  });

  it("renders with type='submit' when specified", () => {
    render(<Button label="Submit" type="submit" />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("type", "submit");
  });

  it("renders with type='reset' when specified", () => {
    render(<Button label="Reset" type="reset" />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("type", "reset");
  });

  it("applies icon size class when size='icon'", () => {
    render(<Button label="Icon" size="icon" />);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("btn-icon");
  });

  it("does not apply icon class with default size", () => {
    render(<Button label="Default" size="default" />);
    const button = screen.getByRole("button");
    expect(button).not.toHaveClass("btn-icon");
  });

  it("applies custom className when provided", () => {
    render(<Button label="Custom" className="my-custom-class" />);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("my-custom-class");
  });

  it("sets aria-label when provided", () => {
    render(<Button label="X" ariaLabel="Close dialog" />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-label", "Close dialog");
  });
});
