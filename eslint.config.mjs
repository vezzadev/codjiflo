// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";
import playwright from "eslint-plugin-playwright";

import js from "@eslint/js";
import globals from "globals";
import reactRefresh from "eslint-plugin-react-refresh";
import nextConfig from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "storybook-static", "coverage", ".storybook/**/*", "playwright-report", ".next/**/*", "next-env.d.ts", "action/**/*"] },
  // Next.js recommended config (includes React, React Hooks, and Next.js rules)
  ...nextConfig,
  // TypeScript strict checking
  {
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-refresh": reactRefresh,
    },
    rules: {
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/dot-notation": ["error", { allowIndexSignaturePropertyAccess: false }],
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
          allow: [{ name: ["Error", "URL", "URLSearchParams"], from: "lib" }],
          allowAny: true,
          allowBoolean: true,
          allowNullish: true,
          allowNumber: true,
          allowRegExp: true,
        },
      ],
    },
  },
  {
    // Allow metadata exports in Next.js layout/page files
    files: ["src/app/**/layout.tsx", "src/app/**/page.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    // Disable type-aware linting for config files
    files: ["*.config.ts", "*.config.js", "*.config.mjs", "playwright.config.ts"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    // E2E tests: Playwright recommended rules + prevent custom timeouts + ban test.skip()
    files: ["e2e/**/*.spec.ts"],
    extends: [playwright.configs["flat/recommended"]],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ObjectExpression > Property[key.name='timeout']",
          message: "Use global Playwright timeout config instead of custom timeouts in E2E tests",
        },
      ],
      "playwright/no-skipped-test": "error",
    },
  },
  ...storybook.configs["flat/recommended"]
);
