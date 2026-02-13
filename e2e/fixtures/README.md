# E2E Test Fixtures

This folder contains test infrastructure and utilities for CodjiFlo's Playwright E2E tests. These fixtures provide consistent test data, API mocking, and helper functions across all E2E test scenarios.

## Key Files

### Mode Configuration

- **`mode.ts`** - E2E test mode detection (`mock` vs `prod`). Controls whether tests use mocked GitHub API or hit production endpoints.

### GitHub API Mocking

- **`github-mocks.ts`** - Centralized Playwright route handlers for mocking GitHub API responses. Includes:
  - Authentication (`setupAuthMock`, `setupAuthState`)
  - PR data (`setupPRMock`, `setupFullPRMocks`)
  - File contents and diffs (`setupFilesMock`, `setupFileContentsMock`)
  - Comments (`setupCommentsMock`)
  - Iteration artifacts (`setupIterationMocks`, `setupIterationArtifactMock`)
  - OAuth token refresh (`setupOAuthAuthState`, `setupTokenRefreshMock`)

### Iteration Database Testing

- **`iteration-db-builder.ts`** - Generates mock SQLite iteration databases for testing stateful mode features. Supports:
  - Building databases from initial files and git patches
  - Fluent builder API (`IterationDbBuilder`)
  - Rebase scenario testing (`buildRebaseIterationDb`)

- **`patch-parser.ts`** - Parses git `format-patch` output for iteration database generation. Handles metadata extraction and patch application.

### UI Testing Helpers

- **`codemirror.ts`** - Registers CodjiFlo-specific CodeMirror extension classes with `playwright-codemirror`, enabling semantic locators for diff viewer elements.

- **`minimap-helpers.ts`** - Utilities for testing the minimap component, including lasso stability detection and scroll helpers.

- **`legacy-defaults.ts`** - Sets localStorage with legacy default values for backwards compatibility in existing tests.

- **`console-warnings.ts`** - Extends Playwright test to detect unexpected console warnings, particularly for stateless mode detection.

## Usage

Import fixtures directly in test files:

```typescript
import { setupFullPRMocks, setupAuthState } from '../fixtures/github-mocks';
import { buildIterationDb } from '../fixtures/iteration-db-builder';
import { CMEditor } from '../fixtures/codemirror';
import { setupLegacyDefaults } from '../fixtures/legacy-defaults';
```

See `AGENTS.md` for detailed E2E testing guidelines and patterns.
