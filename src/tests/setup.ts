import "@testing-library/jest-dom/vitest";


// Mock ResizeObserver (not available in jsdom)
class ResizeObserverMock {
    observe(_target: Element): void {}
    unobserve(_target: Element): void {}
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
