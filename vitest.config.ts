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
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: [
      "node_modules/",
      "src/app/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html"],
      exclude: [
        "node_modules/",
        "src/tests/",
        "src/app/",
        "**/*.stories.tsx",
        "**/*.d.ts",
        // Infrastructure layers require E2E tests, not unit tests
        "src/lib/sqlite-wasm.ts",
        "src/features/iterations/artifact-loader.ts",
        "src/features/iterations/iteration-client.ts",
        "src/features/iterations/application/**",
        "src/features/iterations/infrastructure/**",
        "src/features/iterations/stores/**",
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
