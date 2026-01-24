/**
 * Markdown Toolbar Component
 *
 * Provides formatting buttons for markdown text editing.
 * Part of S-5.5: Rich Formatting & Reactions
 */

import { useCallback, type RefObject } from 'react';
import { Bold, Italic, Code, Link, List, Quote, ImageIcon } from 'lucide-react';

export interface MarkdownToolbarProps {
  /** Ref to the textarea element */
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  /** Callback when text is modified */
  onTextChange: (newValue: string) => void;
  /** Current text value */
  value: string;
  /** Whether editing is disabled */
  disabled?: boolean;
}

type FormatAction = 'bold' | 'italic' | 'code' | 'link' | 'list' | 'quote' | 'image';

interface FormatButton {
  action: FormatAction;
  icon: typeof Bold;
  label: string;
  title: string;
}

const FORMAT_BUTTONS: FormatButton[] = [
  { action: 'bold', icon: Bold, label: 'Bold', title: 'Bold (Ctrl+B)' },
  { action: 'italic', icon: Italic, label: 'Italic', title: 'Italic (Ctrl+I)' },
  { action: 'code', icon: Code, label: 'Code', title: 'Inline code' },
  { action: 'link', icon: Link, label: 'Link', title: 'Insert link' },
  { action: 'list', icon: List, label: 'List', title: 'Bulleted list' },
  { action: 'quote', icon: Quote, label: 'Quote', title: 'Block quote' },
  { action: 'image', icon: ImageIcon, label: 'Image', title: 'Insert image' },
];

/**
 * Insert or wrap text with markdown formatting
 */
function applyFormat(
  textarea: HTMLTextAreaElement,
  action: FormatAction,
  currentValue: string
): { newValue: string; newSelectionStart: number; newSelectionEnd: number } {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = currentValue.slice(start, end);

  let prefix = '';
  let suffix = '';
  let placeholder = '';
  let linePrefix = '';

  switch (action) {
    case 'bold':
      prefix = '**';
      suffix = '**';
      placeholder = 'bold text';
      break;
    case 'italic':
      prefix = '_';
      suffix = '_';
      placeholder = 'italic text';
      break;
    case 'code':
      if (selectedText.includes('\n')) {
        // Multi-line: use code block
        prefix = '```\n';
        suffix = '\n```';
        placeholder = 'code';
      } else {
        // Single line: inline code
        prefix = '`';
        suffix = '`';
        placeholder = 'code';
      }
      break;
    case 'link':
      if (selectedText) {
        // Wrap selection as link text
        prefix = '[';
        suffix = '](url)';
      } else {
        prefix = '[';
        suffix = '](url)';
        placeholder = 'link text';
      }
      break;
    case 'list':
      linePrefix = '- ';
      placeholder = 'list item';
      break;
    case 'quote':
      linePrefix = '> ';
      placeholder = 'quote';
      break;
    case 'image':
      prefix = '![';
      suffix = '](image-url)';
      placeholder = 'alt text';
      break;
  }

  let newValue: string;
  let newSelectionStart: number;
  let newSelectionEnd: number;

  if (linePrefix) {
    // Line-prefix formatting (list, quote)
    if (selectedText) {
      // Apply to each selected line
      const lines = selectedText.split('\n');
      const formattedLines = lines.map((line) => linePrefix + line);
      const formatted = formattedLines.join('\n');
      newValue = currentValue.slice(0, start) + formatted + currentValue.slice(end);
      newSelectionStart = start;
      newSelectionEnd = start + formatted.length;
    } else {
      // Insert on new line if not at line start
      const beforeStart = currentValue.slice(0, start);
      const isLineStart = start === 0 || beforeStart.endsWith('\n');
      const insert = isLineStart
        ? linePrefix + placeholder
        : '\n' + linePrefix + placeholder;
      newValue = currentValue.slice(0, start) + insert + currentValue.slice(end);
      newSelectionStart = start + (isLineStart ? linePrefix.length : linePrefix.length + 1);
      newSelectionEnd = newSelectionStart + placeholder.length;
    }
  } else {
    // Wrap formatting (bold, italic, code, link, image)
    if (selectedText) {
      const formatted = prefix + selectedText + suffix;
      newValue = currentValue.slice(0, start) + formatted + currentValue.slice(end);
      newSelectionStart = start + prefix.length;
      newSelectionEnd = start + prefix.length + selectedText.length;
    } else {
      const insert = prefix + placeholder + suffix;
      newValue = currentValue.slice(0, start) + insert + currentValue.slice(end);
      newSelectionStart = start + prefix.length;
      newSelectionEnd = start + prefix.length + placeholder.length;
    }
  }

  return { newValue, newSelectionStart, newSelectionEnd };
}

/**
 * Toolbar with markdown formatting buttons
 */
export function MarkdownToolbar({
  textareaRef,
  onTextChange,
  value,
  disabled = false,
}: MarkdownToolbarProps) {
  const handleFormat = useCallback(
    (action: FormatAction) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const { newValue, newSelectionStart, newSelectionEnd } = applyFormat(
        textarea,
        action,
        value
      );

      onTextChange(newValue);

      // Restore focus and set selection after React updates
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(newSelectionStart, newSelectionEnd);
      });
    },
    [textareaRef, onTextChange, value]
  );

  return (
    <div className="markdown-toolbar" role="toolbar" aria-label="Text formatting">
      {FORMAT_BUTTONS.map(({ action, icon: Icon, label, title }) => (
        <button
          key={action}
          type="button"
          className="markdown-toolbar-btn"
          onClick={() => handleFormat(action)}
          disabled={disabled}
          aria-label={label}
          title={title}
        >
          <Icon size={16} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
