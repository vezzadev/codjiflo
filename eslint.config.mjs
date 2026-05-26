// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";
import playwright from "eslint-plugin-playwright";

import js from "@eslint/js";
import globals from "globals";
import reactRefresh from "eslint-plugin-react-refresh";
import nextConfig from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

// Custom ESLint rules
import oneTopLevelTestDescribe from "./eslint-rules/one-top-level-test-describe.js";
import noNativeInteractiveElements from "./eslint-rules/no-native-interactive-elements.js";

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
      "react-refresh/only-export-components": ["error", { allowConstantExport: true }],
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
      // Upgraded from warn to error for baseline suppression
      "import/no-anonymous-default-export": "error",
      "jsx-a11y/role-supports-aria-props": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
      "react-hooks/exhaustive-deps": "error",
      // Claude style preferences — see https://github.com/pedropaulovc/lint-defaults
      "@typescript-eslint/consistent-generic-constructors": ["error", "type-annotation"],
      "@typescript-eslint/consistent-indexed-object-style": ["error", "index-signature"],
      "@typescript-eslint/no-inferrable-types": "off",
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
    // Ban raw native interactive elements in feature/app code and Storybook stories
    files: ["src/features/**/*.{ts,tsx}", "src/app/**/*.{ts,tsx}", "**/*.stories.tsx"],
    ignores: ["**/*.test.{ts,tsx}", "src/tests/**"],
    plugins: {
      "custom-rules": {
        rules: {
          "no-native-interactive-elements": noNativeInteractiveElements,
        },
      },
    },
    rules: {
      "custom-rules/no-native-interactive-elements": "error",
    },
  },
  {
    // Disable type-aware linting for config files
    files: ["*.config.ts", "*.config.js", "*.config.mjs", "playwright.config.ts"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    // JavaScript files - upgrade warnings to errors for baseline suppression
    files: ["**/*.js"],
    rules: {
      "import/no-anonymous-default-export": "error",
    },
  },
  {
    // E2E tests: Playwright recommended rules + prevent custom timeouts + ban test.skip() + enforce single describe
    files: ["e2e/**/*.spec.ts"],
    extends: [playwright.configs["flat/recommended"]],
    plugins: {
      "custom-rules": {
        rules: {
          "one-top-level-test-describe": oneTopLevelTestDescribe,
        },
      },
    },
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ObjectExpression > Property[key.name='timeout']",
          message: "Use global Playwright timeout config instead of custom timeouts in E2E tests",
        },
      ],
      "playwright/no-skipped-test": "error",
      "playwright/no-conditional-in-test": "error",
      "playwright/no-conditional-expect": "error",
      "playwright/no-useless-not": "error",
      "playwright/no-raw-locators": "error",
      "playwright/no-restricted-locators": "error",
      "playwright/prefer-native-locators": "error",
      "playwright/prefer-locator": "error",
      "playwright/require-top-level-describe": "error",
      "playwright/prefer-equality-matcher": "error",
      "playwright/prefer-comparison-matcher": "error",
      "custom-rules/one-top-level-test-describe": ["error", { filePattern: "\\.spec\\.ts$" }],
    },
  },
  ...storybook.configs["flat/recommended"]
);
