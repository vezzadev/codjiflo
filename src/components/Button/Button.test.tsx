import { describe, it, expect, vi } from "vitest";
import { render, screen } from "../../tests/helpers";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";

describe("Button", () => {
  it("renders with the provided children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument();
  });

  it("calls onPress when clicked", async () => {
    const handlePress = vi.fn();
    render(<Button onPress={handlePress}>Click me</Button>);

    await userEvent.click(screen.getByRole("button"));
    expect(handlePress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress when disabled", async () => {
    const handlePress = vi.fn();
    render(<Button onPress={handlePress} isDisabled>Click me</Button>);

    await userEvent.click(screen.getByRole("button"));
    expect(handlePress).not.toHaveBeenCalled();
  });

  it("applies primary variant styles by default", () => {
    render(<Button>Primary</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("btn-colorful");
  });

  it("applies secondary variant styles when specified", () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("btn");
  });

  it("renders with type='button' by default", () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("type", "button");
  });

  it("renders with type='submit' when specified", () => {
    render(<Button type="submit">Submit</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("type", "submit");
  });

  it("renders with type='reset' when specified", () => {
    render(<Button type="reset">Reset</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("type", "reset");
  });

  it("applies icon size class when size='icon'", () => {
    render(<Button size="icon">Icon</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("btn-icon");
  });

  it("does not apply icon class with default size", () => {
    render(<Button size="default">Default</Button>);
    const button = screen.getByRole("button");
    expect(button).not.toHaveClass("btn-icon");
  });

  it("applies custom className when provided", () => {
    render(<Button className="my-custom-class">Custom</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("my-custom-class");
  });

  it("sets aria-label when provided", () => {
    render(<Button aria-label="Close dialog">X</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-label", "Close dialog");
  });
});
