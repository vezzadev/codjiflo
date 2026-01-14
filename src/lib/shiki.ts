/**
 * Shiki Syntax Highlighter Wrapper
 *
 * Provides VS Code-style syntax highlighting using TextMate grammars.
 * Uses a singleton pattern with lazy initialization to avoid repeated WASM setup.
 */

import { createHighlighter, type Highlighter, type BundledLanguage, type BundledTheme } from 'shiki';

// ============================================================================
// Types
// ============================================================================

export type ShikiTheme = BundledTheme;
export type ShikiLanguage = BundledLanguage;

// ============================================================================
// Module State
// ============================================================================

let highlighter: Highlighter | null = null;
let initPromise: Promise<Highlighter> | null = null;

// Themes to preload (mapped from UI themes)
const REQUIRED_THEMES: BundledTheme[] = [
  'dark-plus',
  'light-plus',
  'github-dark',
  'github-light',
  'github-dark-high-contrast',
];

// Languages to preload (superset of detectLanguage() output for better coverage)
const REQUIRED_LANGUAGES: BundledLanguage[] = [
  'typescript',
  'tsx',
  'javascript',
  'jsx',
  'python',
  'json',
  'css',
  'html',
  'xml',
  'bash',
  'markdown',
  'java',
  'kotlin',
  'csharp',
  'go',
  'rust',
  'ruby',
  'php',
  'swift',
  'c',
  'cpp',
  'sql',
  'yaml',
];

// ============================================================================
// Initialization
// ============================================================================

/**
 * Get the Shiki highlighter instance.
 * Initializes on first call, returns cached instance on subsequent calls.
 */
export async function getHighlighter(): Promise<Highlighter> {
  if (highlighter) {
    return highlighter;
  }

  initPromise ??= createHighlighter({
    themes: REQUIRED_THEMES,
    langs: REQUIRED_LANGUAGES,
  });

  highlighter = await initPromise;
  return highlighter;
}

/**
 * Check if the highlighter has been initialized.
 * Useful for synchronous checks in components.
 */
export function isHighlighterReady(): boolean {
  return highlighter !== null;
}

/**
 * Preload the highlighter in the background.
 * Call this early in app lifecycle to reduce perceived latency.
 */
export function preloadHighlighter(): void {
  void getHighlighter();
}
