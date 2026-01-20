/**
 * Language Registry for CodeMirror 6
 *
 * Maps file extensions to CodeMirror language loaders with lazy loading for performance.
 */

import type { LanguageSupport } from '@codemirror/language';

type LanguageLoader = () => Promise<LanguageSupport>;

/**
 * Map of file extensions to CodeMirror language loaders.
 * Languages are loaded lazily to reduce initial bundle size.
 */
const languageLoaders: Record<string, LanguageLoader> = {
  // JavaScript/TypeScript
  js: async () => (await import('@codemirror/lang-javascript')).javascript(),
  jsx: async () => (await import('@codemirror/lang-javascript')).javascript({ jsx: true }),
  ts: async () => (await import('@codemirror/lang-javascript')).javascript({ typescript: true }),
  tsx: async () => (await import('@codemirror/lang-javascript')).javascript({ jsx: true, typescript: true }),
  mjs: async () => (await import('@codemirror/lang-javascript')).javascript(),
  cjs: async () => (await import('@codemirror/lang-javascript')).javascript(),

  // Python
  py: async () => (await import('@codemirror/lang-python')).python(),
  pyw: async () => (await import('@codemirror/lang-python')).python(),

  // JSON
  json: async () => (await import('@codemirror/lang-json')).json(),
  jsonc: async () => (await import('@codemirror/lang-json')).json(),

  // CSS
  css: async () => (await import('@codemirror/lang-css')).css(),
  scss: async () => (await import('@codemirror/lang-css')).css(),
  less: async () => (await import('@codemirror/lang-css')).css(),

  // HTML
  html: async () => (await import('@codemirror/lang-html')).html(),
  htm: async () => (await import('@codemirror/lang-html')).html(),
  vue: async () => (await import('@codemirror/lang-html')).html(),
  svelte: async () => (await import('@codemirror/lang-html')).html(),

  // Markdown
  md: async () => (await import('@codemirror/lang-markdown')).markdown(),
  mdx: async () => (await import('@codemirror/lang-markdown')).markdown(),

  // Java
  java: async () => (await import('@codemirror/lang-java')).java(),

  // Rust
  rs: async () => (await import('@codemirror/lang-rust')).rust(),

  // C/C++
  c: async () => (await import('@codemirror/lang-cpp')).cpp(),
  cc: async () => (await import('@codemirror/lang-cpp')).cpp(),
  cpp: async () => (await import('@codemirror/lang-cpp')).cpp(),
  cxx: async () => (await import('@codemirror/lang-cpp')).cpp(),
  h: async () => (await import('@codemirror/lang-cpp')).cpp(),
  hpp: async () => (await import('@codemirror/lang-cpp')).cpp(),

  // SQL
  sql: async () => (await import('@codemirror/lang-sql')).sql(),

  // YAML
  yaml: async () => (await import('@codemirror/lang-yaml')).yaml(),
  yml: async () => (await import('@codemirror/lang-yaml')).yaml(),

  // Go
  go: async () => (await import('@codemirror/lang-go')).go(),

  // PHP
  php: async () => (await import('@codemirror/lang-php')).php(),
};

/**
 * Cache of loaded language supports to avoid repeated dynamic imports.
 */
const languageCache = new Map<string, LanguageSupport>();

/**
 * Detects the language from a filename or path.
 * Returns the file extension if found, otherwise 'text'.
 */
export function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext && languageLoaders[ext] ? ext : 'text';
}

/**
 * Gets the CodeMirror language support for a given language/extension.
 * Returns null if the language is not supported or loading fails.
 */
export async function getLanguageSupport(language: string): Promise<LanguageSupport | null> {
  if (!language || language === 'text') {
    return null;
  }

  // Check cache first
  const cached = languageCache.get(language);
  if (cached) {
    return cached;
  }

  const loader = languageLoaders[language.toLowerCase()];
  if (!loader) {
    return null;
  }

  try {
    const support = await loader();
    languageCache.set(language, support);
    return support;
  } catch {
    // Language loading failed (e.g., network error, missing package)
    return null;
  }
}

/**
 * Gets the CodeMirror language support synchronously if already cached.
 * Returns null if not cached or not supported.
 */
export function getCachedLanguageSupport(language: string): LanguageSupport | null {
  return languageCache.get(language) ?? null;
}

/**
 * Preloads a language into the cache.
 * Useful for warming up commonly used languages.
 */
export async function preloadLanguage(language: string): Promise<void> {
  await getLanguageSupport(language);
}

/**
 * Preloads multiple languages concurrently.
 */
export async function preloadLanguages(languages: string[]): Promise<void> {
  await Promise.all(languages.map(preloadLanguage));
}
