/**
 * Unit tests for language-registry
 *
 * Note: This file unmocks the language-registry to test the real implementation.
 * The global mock in setup.ts is for other tests that don't need real language loading.
 */

import { describe, expect, it, vi } from 'vitest';

// Unmock the module to test the real implementation
vi.unmock('./language-registry');

// Import after unmocking
import {
  detectLanguage,
  getLanguageSupport,
  getCachedLanguageSupport,
  preloadLanguage,
  preloadLanguages,
} from './language-registry';

describe('detectLanguage', () => {
  it('returns js for JavaScript files', () => {
    expect(detectLanguage('app.js')).toBe('js');
    expect(detectLanguage('src/utils/helper.js')).toBe('js');
  });

  it('returns ts for TypeScript files', () => {
    expect(detectLanguage('app.ts')).toBe('ts');
    expect(detectLanguage('src/types/index.ts')).toBe('ts');
  });

  it('returns tsx for TSX files', () => {
    expect(detectLanguage('Component.tsx')).toBe('tsx');
    expect(detectLanguage('src/components/Button.tsx')).toBe('tsx');
  });

  it('returns jsx for JSX files', () => {
    expect(detectLanguage('Component.jsx')).toBe('jsx');
  });

  it('returns py for Python files', () => {
    expect(detectLanguage('script.py')).toBe('py');
    expect(detectLanguage('app.pyw')).toBe('pyw');
  });

  it('returns json for JSON files', () => {
    expect(detectLanguage('package.json')).toBe('json');
    expect(detectLanguage('tsconfig.jsonc')).toBe('jsonc');
  });

  it('returns css for CSS files', () => {
    expect(detectLanguage('styles.css')).toBe('css');
    expect(detectLanguage('theme.scss')).toBe('scss');
    expect(detectLanguage('vars.less')).toBe('less');
  });

  it('returns html for HTML files', () => {
    expect(detectLanguage('index.html')).toBe('html');
    expect(detectLanguage('page.htm')).toBe('htm');
  });

  it('returns html for Vue and Svelte files', () => {
    expect(detectLanguage('App.vue')).toBe('vue');
    expect(detectLanguage('Component.svelte')).toBe('svelte');
  });

  it('returns md for Markdown files', () => {
    expect(detectLanguage('README.md')).toBe('md');
    expect(detectLanguage('docs/page.mdx')).toBe('mdx');
  });

  it('returns java for Java files', () => {
    expect(detectLanguage('Main.java')).toBe('java');
  });

  it('returns rs for Rust files', () => {
    expect(detectLanguage('main.rs')).toBe('rs');
  });

  it('returns cpp/c for C++ files', () => {
    expect(detectLanguage('main.cpp')).toBe('cpp');
    expect(detectLanguage('main.cc')).toBe('cc');
    expect(detectLanguage('main.cxx')).toBe('cxx');
    expect(detectLanguage('main.c')).toBe('c');
    expect(detectLanguage('header.h')).toBe('h');
    expect(detectLanguage('header.hpp')).toBe('hpp');
  });

  it('returns sql for SQL files', () => {
    expect(detectLanguage('query.sql')).toBe('sql');
  });

  it('returns yaml for YAML files', () => {
    expect(detectLanguage('config.yaml')).toBe('yaml');
    expect(detectLanguage('config.yml')).toBe('yml');
  });

  it('returns go for Go files', () => {
    expect(detectLanguage('main.go')).toBe('go');
  });

  it('returns php for PHP files', () => {
    expect(detectLanguage('index.php')).toBe('php');
  });

  it('returns text for unsupported extensions', () => {
    expect(detectLanguage('file.unknown')).toBe('text');
    expect(detectLanguage('file.xyz')).toBe('text');
    expect(detectLanguage('file.rb')).toBe('text'); // Ruby not supported
    expect(detectLanguage('file.swift')).toBe('text'); // Swift not supported
  });

  it('returns text for files without extension', () => {
    expect(detectLanguage('Makefile')).toBe('text');
    expect(detectLanguage('Dockerfile')).toBe('text');
  });

  it('handles case insensitively', () => {
    expect(detectLanguage('file.JS')).toBe('js');
    expect(detectLanguage('file.TS')).toBe('ts');
    expect(detectLanguage('file.JSON')).toBe('json');
  });

  it('handles paths with multiple dots', () => {
    expect(detectLanguage('file.test.ts')).toBe('ts');
    expect(detectLanguage('file.spec.tsx')).toBe('tsx');
    expect(detectLanguage('file.module.css')).toBe('css');
  });
});

describe('getLanguageSupport', () => {
  it('returns null for empty string', async () => {
    const support = await getLanguageSupport('');
    expect(support).toBeNull();
  });

  it('returns null for text language', async () => {
    const support = await getLanguageSupport('text');
    expect(support).toBeNull();
  });

  it('returns null for unsupported language', async () => {
    const support = await getLanguageSupport('unsupported');
    expect(support).toBeNull();
  });

  it('loads JavaScript language support', async () => {
    const support = await getLanguageSupport('js');
    expect(support).not.toBeNull();
    expect(support?.language).toBeDefined();
  });

  it('loads TypeScript language support', async () => {
    const support = await getLanguageSupport('ts');
    expect(support).not.toBeNull();
    expect(support?.language).toBeDefined();
  });

  it('loads JSON language support', async () => {
    const support = await getLanguageSupport('json');
    expect(support).not.toBeNull();
    expect(support?.language).toBeDefined();
  });

  it('loads Python language support', async () => {
    const support = await getLanguageSupport('py');
    expect(support).not.toBeNull();
    expect(support?.language).toBeDefined();
  });

  it('caches loaded languages', async () => {
    // Load twice
    const support1 = await getLanguageSupport('css');
    const support2 = await getLanguageSupport('css');

    // Should be the same cached instance
    expect(support1).toBe(support2);
  });

  it('handles case insensitively', async () => {
    const support1 = await getLanguageSupport('JS');
    const support2 = await getLanguageSupport('js');

    // Both should work
    expect(support1).not.toBeNull();
    expect(support2).not.toBeNull();
  });
});

describe('getCachedLanguageSupport', () => {
  it('returns null for uncached language', () => {
    // Note: This test depends on the cache state
    // Testing with a language not likely to be cached
    const support = getCachedLanguageSupport('never-loaded-language');
    expect(support).toBeNull();
  });

  it('returns cached language if previously loaded', async () => {
    // First load the language
    await getLanguageSupport('html');

    // Then get from cache
    const cached = getCachedLanguageSupport('html');
    expect(cached).not.toBeNull();
    expect(cached?.language).toBeDefined();
  });
});

describe('preloadLanguage', () => {
  it('preloads a language into the cache', async () => {
    // Preload a language not likely to be cached already
    await preloadLanguage('go');

    // Should now be in cache
    const cached = getCachedLanguageSupport('go');
    expect(cached).not.toBeNull();
  });

  it('does not throw for unsupported languages', async () => {
    // Should not throw
    await expect(preloadLanguage('unsupported-lang')).resolves.toBeUndefined();
  });
});

describe('preloadLanguages', () => {
  it('preloads multiple languages concurrently', async () => {
    await preloadLanguages(['java', 'rs', 'php']);

    // All should be cached
    expect(getCachedLanguageSupport('java')).not.toBeNull();
    expect(getCachedLanguageSupport('rs')).not.toBeNull();
    expect(getCachedLanguageSupport('php')).not.toBeNull();
  });

  it('handles empty array', async () => {
    await expect(preloadLanguages([])).resolves.toBeUndefined();
  });

  it('handles mixed supported and unsupported languages', async () => {
    await preloadLanguages(['sql', 'unsupported', 'yaml']);

    expect(getCachedLanguageSupport('sql')).not.toBeNull();
    expect(getCachedLanguageSupport('yaml')).not.toBeNull();
    expect(getCachedLanguageSupport('unsupported')).toBeNull();
  });
});
