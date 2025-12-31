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
});
