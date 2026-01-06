import "@testing-library/jest-dom/vitest";


// Mock ResizeObserver (not available in jsdom)
class ResizeObserverMock {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
    observe(target: Element): void {}
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
    unobserve(target: Element): void {}
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
