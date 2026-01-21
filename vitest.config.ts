import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    onConsoleLog: () => false,
    include: ["src/**/*.test.{ts,tsx}", "action/src/**/*.test.ts", "e2e/fixtures/**/*.test.ts", "packages/*/src/**/*.test.ts"],
    exclude: [
      "node_modules/",
      "src/app/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["json", "json-summary", "html"],
      exclude: [
        "node_modules/",
        "e2e/",
        "**/*.stories.tsx",
        "**/*.d.ts",
        // Re-export files with no logic
        "**/index.ts",
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
});
