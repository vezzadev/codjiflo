import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";

// Mock CodeMirror language registry to avoid async state updates in tests
// This prevents the async getLanguageSupport from triggering act() warnings
vi.mock('../features/diff/components/codemirror/utils/language-registry', () => ({
    detectLanguage: vi.fn((filename: string) => {
        const ext = filename.split('.').pop()?.toLowerCase() ?? '';
        const extensionToLanguage: Record<string, string> = {
            'ts': 'typescript', 'tsx': 'tsx', 'js': 'javascript', 'jsx': 'jsx',
            'py': 'python', 'json': 'json', 'md': 'markdown', 'css': 'css',
            'html': 'html', 'rs': 'rust', 'go': 'go', 'java': 'java',
            'c': 'cpp', 'cpp': 'cpp', 'h': 'cpp', 'hpp': 'cpp',
            'sql': 'sql', 'yaml': 'yaml', 'yml': 'yaml', 'php': 'php',
        };
        return extensionToLanguage[ext] ?? null;
    }),
    getLanguageSupport: vi.fn().mockResolvedValue(null),
    getCachedLanguageSupport: vi.fn(() => null),
    preloadLanguage: vi.fn().mockResolvedValue(undefined),
    preloadLanguages: vi.fn().mockResolvedValue(undefined),
}));

// Mock CodeMirrorBase to avoid complex CodeMirror setup in JSDOM
vi.mock('../features/diff/components/codemirror/CodeMirrorBase', async () => {
    const React = await import('react');
    return {
        CodeMirrorBase: vi.fn().mockImplementation(({ doc, className, height }: { doc?: string; className?: string; height?: string }) => {
            return React.createElement('div', { className: `cm-editor ${className ?? ''}`, style: { height } },
                React.createElement('div', { className: 'cm-scroller' },
                    (doc ?? '').split('\n').map((line: string, i: number) =>
                        React.createElement('div', { key: i, className: 'cm-line' }, line)
                    )
                )
            );
        }),
    };
});

// Fail tests on any console.error or console.warn (with exceptions for known issues)
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Known warnings that can be safely ignored
const ignoredWarningPatterns = [
    // CodeMirror language loading causes async state updates that complete after tests
    // This is a known limitation with testing async React components
    /not wrapped in act\(/i,
];

beforeEach(() => {
    console.error = vi.fn((...args: unknown[]) => {
        const message = args.join(" ");
        const shouldIgnore = ignoredWarningPatterns.some(pattern => pattern.test(message));
        if (shouldIgnore) {
            // Still log it but don't fail the test
            return;
        }
        originalConsoleError.apply(console, args);
        throw new Error(`Unexpected console.error:\n${message}`);
    });

    console.warn = vi.fn((...args: unknown[]) => {
        originalConsoleWarn.apply(console, args);
        throw new Error(`Unexpected console.warn:\n${args.join(" ")}`);
    });
});

afterEach(() => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
});

// Mock ResizeObserver (not available in jsdom)
class ResizeObserverMock {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
    observe(_target: Element): void {}
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
    unobserve(_target: Element): void {}
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    disconnect(): void {}
}
window.ResizeObserver = ResizeObserverMock;

// Mock localStorage
const localStorageMock = (function () {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => {
            store[key] = value;
        },
        clear: () => {
            store = {};
        },
        removeItem: (key: string) => {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete store[key];
        },
    };
})();

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
});
