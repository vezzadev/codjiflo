import { describe, it, expect } from "vitest";
import { render, screen } from "@/tests/helpers";
import { FormField } from "./FormField";

describe("FormField", () => {
  it("should render with label", () => {
    render(
      <FormField label="Test Label">
        {({ id }) => <input id={id} data-testid="test-input" />}
      </FormField>
    );
    expect(screen.getByLabelText("Test Label")).toBeInTheDocument();
  });

  it("should render without label", () => {
    render(
      <FormField>
        {({ id }) => <input id={id} data-testid="test-input" />}
      </FormField>
    );
    expect(screen.getByTestId("test-input")).toBeInTheDocument();
    expect(screen.queryByRole("label")).not.toBeInTheDocument();
  });

  it("should display error message with correct accessibility attributes", () => {
    render(
      <FormField label="Test" error="Error message">
        {({ id, ariaDescribedBy, ariaInvalid }) => (
          <input id={id} aria-describedby={ariaDescribedBy} aria-invalid={ariaInvalid} />
        )}
      </FormField>
    );
    const errorElement = screen.getByText("Error message");
    expect(errorElement).toBeInTheDocument();
    expect(errorElement).toHaveAttribute("role", "alert");
    expect(errorElement).toHaveAttribute("aria-live", "polite");
  });

  it("should display helper text when no error", () => {
    render(
      <FormField label="Test" helperText="Helper text">
        {({ id }) => <input id={id} />}
      </FormField>
    );
    expect(screen.getByText("Helper text")).toBeInTheDocument();
  });

  it("should not display helper text when error exists", () => {
    render(
      <FormField label="Test" helperText="Helper text" error="Error">
        {({ id }) => <input id={id} />}
      </FormField>
    );
    expect(screen.queryByText("Helper text")).not.toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("should provide correct aria attributes when error", () => {
    render(
      <FormField label="Test" error="Error message">
        {({ id, ariaDescribedBy, ariaInvalid }) => (
          <input id={id} aria-describedby={ariaDescribedBy} aria-invalid={ariaInvalid} />
        )}
      </FormField>
    );
    const input = screen.getByLabelText("Test");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby");
  });

  it("should provide correct aria attributes when no error", () => {
    render(
      <FormField label="Test">
        {({ id, ariaDescribedBy, ariaInvalid }) => (
          <input id={id} aria-describedby={ariaDescribedBy} aria-invalid={ariaInvalid} />
        )}
      </FormField>
    );
    const input = screen.getByLabelText("Test");
    expect(input).toHaveAttribute("aria-invalid", "false");
  });

  it("should use provided id when available", () => {
    render(
      <FormField label="Test" id="custom-id">
        {({ id }) => <input id={id} />}
      </FormField>
    );
    expect(screen.getByLabelText("Test")).toHaveAttribute("id", "custom-id");
  });

  it("should link error id to aria-describedby", () => {
    render(
      <FormField label="Test" error="Error message" id="test-field">
        {({ id, ariaDescribedBy }) => (
          <input id={id} aria-describedby={ariaDescribedBy} />
        )}
      </FormField>
    );
    const input = screen.getByLabelText("Test");
    expect(input).toHaveAttribute("aria-describedby", "test-field-error");
    expect(screen.getByText("Error message")).toHaveAttribute("id", "test-field-error");
  });

  it("should link helper text id to aria-describedby", () => {
    render(
      <FormField label="Test" helperText="Help text" id="test-field">
        {({ id, ariaDescribedBy }) => (
          <input id={id} aria-describedby={ariaDescribedBy} />
        )}
      </FormField>
    );
    const input = screen.getByLabelText("Test");
    expect(input).toHaveAttribute("aria-describedby", "test-field-helper");
    expect(screen.getByText("Help text")).toHaveAttribute("id", "test-field-helper");
  });
});
