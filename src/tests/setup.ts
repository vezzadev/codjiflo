import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";

// Fail tests on any console.error or console.warn
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
    console.error = vi.fn((...args: unknown[]) => {
        originalConsoleError.apply(console, args);
        throw new Error(`Unexpected console.error:\n${args.join(" ")}`);
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
