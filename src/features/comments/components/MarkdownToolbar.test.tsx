import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@/tests/helpers";
import userEvent from "@testing-library/user-event";
import { MarkdownToolbar } from "./MarkdownToolbar";
import { createRef, type RefObject } from "react";

describe("MarkdownToolbar", () => {
  let textareaRef: RefObject<HTMLTextAreaElement | null>;
  let mockTextarea: HTMLTextAreaElement;
  const onTextChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockTextarea = document.createElement("textarea");
    mockTextarea.value = "test text";
    mockTextarea.selectionStart = 0;
    mockTextarea.selectionEnd = 4;
    document.body.appendChild(mockTextarea);
    textareaRef = { current: mockTextarea };
  });

  afterEach(() => {
    document.body.removeChild(mockTextarea);
  });

  it("renders all formatting buttons", () => {
    render(
      <MarkdownToolbar
        textareaRef={textareaRef}
        onTextChange={onTextChange}
        value="test"
      />
    );

    expect(screen.getByRole("button", { name: "Bold" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Italic" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Code" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Link" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "List" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quote" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Image" })).toBeInTheDocument();
  });

  it("renders toolbar with accessible role", () => {
    render(
      <MarkdownToolbar
        textareaRef={textareaRef}
        onTextChange={onTextChange}
        value="test"
      />
    );

    expect(
      screen.getByRole("toolbar", { name: "Text formatting" })
    ).toBeInTheDocument();
  });

  it("disables all buttons when disabled prop is true", () => {
    render(
      <MarkdownToolbar
        textareaRef={textareaRef}
        onTextChange={onTextChange}
        value="test"
        disabled
      />
    );

    const buttons = screen.getAllByRole("button");
    buttons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it("applies bold formatting to selected text", async () => {
    mockTextarea.value = "hello world";
    mockTextarea.selectionStart = 0;
    mockTextarea.selectionEnd = 5;

    render(
      <MarkdownToolbar
        textareaRef={textareaRef}
        onTextChange={onTextChange}
        value="hello world"
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Bold" }));

    expect(onTextChange).toHaveBeenCalledWith("**hello** world");
  });

  it("applies italic formatting to selected text", async () => {
    mockTextarea.value = "hello world";
    mockTextarea.selectionStart = 0;
    mockTextarea.selectionEnd = 5;

    render(
      <MarkdownToolbar
        textareaRef={textareaRef}
        onTextChange={onTextChange}
        value="hello world"
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Italic" }));

    expect(onTextChange).toHaveBeenCalledWith("_hello_ world");
  });

  it("applies inline code formatting", async () => {
    mockTextarea.value = "hello world";
    mockTextarea.selectionStart = 0;
    mockTextarea.selectionEnd = 5;

    render(
      <MarkdownToolbar
        textareaRef={textareaRef}
        onTextChange={onTextChange}
        value="hello world"
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Code" }));

    expect(onTextChange).toHaveBeenCalledWith("`hello` world");
  });

  it("applies code block formatting for multi-line text", async () => {
    mockTextarea.value = "line1\nline2";
    mockTextarea.selectionStart = 0;
    mockTextarea.selectionEnd = 11;

    render(
      <MarkdownToolbar
        textareaRef={textareaRef}
        onTextChange={onTextChange}
        value={"line1\nline2"}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Code" }));

    expect(onTextChange).toHaveBeenCalledWith("```\nline1\nline2\n```");
  });

  it("applies link formatting with selected text", async () => {
    mockTextarea.value = "click here";
    mockTextarea.selectionStart = 0;
    mockTextarea.selectionEnd = 5;

    render(
      <MarkdownToolbar
        textareaRef={textareaRef}
        onTextChange={onTextChange}
        value="click here"
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Link" }));

    expect(onTextChange).toHaveBeenCalledWith("[click](url) here");
  });

  it("inserts link placeholder when no text selected", async () => {
    mockTextarea.value = "hello";
    mockTextarea.selectionStart = 5;
    mockTextarea.selectionEnd = 5;

    render(
      <MarkdownToolbar
        textareaRef={textareaRef}
        onTextChange={onTextChange}
        value="hello"
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Link" }));

    expect(onTextChange).toHaveBeenCalledWith("hello[link text](url)");
  });

  it("applies list formatting to selected lines", async () => {
    mockTextarea.value = "item1\nitem2";
    mockTextarea.selectionStart = 0;
    mockTextarea.selectionEnd = 11;

    render(
      <MarkdownToolbar
        textareaRef={textareaRef}
        onTextChange={onTextChange}
        value={"item1\nitem2"}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "List" }));

    expect(onTextChange).toHaveBeenCalledWith("- item1\n- item2");
  });

  it("inserts list item when no text selected", async () => {
    mockTextarea.value = "";
    mockTextarea.selectionStart = 0;
    mockTextarea.selectionEnd = 0;

    render(
      <MarkdownToolbar
        textareaRef={textareaRef}
        onTextChange={onTextChange}
        value=""
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "List" }));

    expect(onTextChange).toHaveBeenCalledWith("- list item");
  });

  it("applies quote formatting to selected lines", async () => {
    mockTextarea.value = "quote text";
    mockTextarea.selectionStart = 0;
    mockTextarea.selectionEnd = 10;

    render(
      <MarkdownToolbar
        textareaRef={textareaRef}
        onTextChange={onTextChange}
        value="quote text"
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Quote" }));

    expect(onTextChange).toHaveBeenCalledWith("> quote text");
  });

  it("applies image formatting", async () => {
    mockTextarea.value = "alt";
    mockTextarea.selectionStart = 0;
    mockTextarea.selectionEnd = 3;

    render(
      <MarkdownToolbar
        textareaRef={textareaRef}
        onTextChange={onTextChange}
        value="alt"
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Image" }));

    expect(onTextChange).toHaveBeenCalledWith("![alt](image-url)");
  });

  it("does nothing when textarea ref is null", async () => {
    const emptyRef = createRef<HTMLTextAreaElement | null>();

    render(
      <MarkdownToolbar
        textareaRef={emptyRef}
        onTextChange={onTextChange}
        value="test"
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Bold" }));

    expect(onTextChange).not.toHaveBeenCalled();
  });

  it("inserts bold placeholder when no text selected", async () => {
    mockTextarea.value = "";
    mockTextarea.selectionStart = 0;
    mockTextarea.selectionEnd = 0;

    render(
      <MarkdownToolbar
        textareaRef={textareaRef}
        onTextChange={onTextChange}
        value=""
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Bold" }));

    expect(onTextChange).toHaveBeenCalledWith("**bold text**");
  });

  it("adds newline before list item when not at line start", async () => {
    mockTextarea.value = "text";
    mockTextarea.selectionStart = 4;
    mockTextarea.selectionEnd = 4;

    render(
      <MarkdownToolbar
        textareaRef={textareaRef}
        onTextChange={onTextChange}
        value="text"
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "List" }));

    expect(onTextChange).toHaveBeenCalledWith("text\n- list item");
  });
});
