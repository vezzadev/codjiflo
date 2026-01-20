import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";
import { render, screen } from "@/tests/helpers";
import { DiffView } from "./DiffView";
import { useDiffStore } from "../stores";
import { useCommentsStore } from "@/features/comments";
import { FileChangeStatus } from "@/api/types";

vi.mock('next/navigation', () => ({
  useParams: vi.fn(() => ({ owner: 'testowner', repo: 'testrepo' })),
}));

describe("DiffView comments integration", () => {
  beforeEach(() => {
    // Suppress React act() warnings that occur due to Zustand store updates
    vi.spyOn(console, 'error').mockImplementation((msg: unknown) => {
      if (typeof msg === 'string' && msg.includes('act(')) return;
      console.warn(msg);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    act(() => {
      useDiffStore.setState({
        files: [],
        selectedFileIndex: 0,
        isLoading: false,
        error: null,
      });
      useCommentsStore.setState({
        threads: [],
        isLoading: false,
        error: null,
        announcement: "",
      });
    });
  });

  // Skipped: CodeMirror widget DOM is not created in JSDOM with mocked CodeMirrorBase
  // React portals are implemented but require real CodeMirror widget containers
  // This flow is tested in E2E tests instead
  it.skip("renders comment threads under the matching diff line", () => {
    act(() => {
      useDiffStore.setState({
        files: [
          {
            filename: "src/example.ts",
            status: FileChangeStatus.Modified,
            additions: 1,
            deletions: 0,
            changes: 1,
            patch: "@@ -1,1 +1,2 @@\n const foo = 'bar';\n+const added = true;",
          },
        ],
        selectedFileIndex: 0,
        isLoading: false,
        error: null,
      });

      useCommentsStore.setState({
        threads: [
          {
            id: "thread-1",
            path: "src/example.ts",
            line: 2,
            side: "RIGHT",
            isResolved: false,
            originalLine: 2,
            originalCommitId: "abc123",
            trackedLine: null,
            comments: [
              {
                id: "comment-1",
                body: "Looks good!",
                author: {
                  id: "2",
                  login: "reviewer",
                  avatarUrl: "https://example.com/avatar.png",
                },
                createdAt: new Date(Date.now() - 1000 * 60),
                updatedAt: new Date(Date.now() - 1000 * 60),
                path: "src/example.ts",
                line: 2,
                side: "RIGHT",
                position: 2,
                originalLine: 2,
                originalCommitId: "abc123",
              },
            ],
          },
        ],
        isLoading: false,
        error: null,
        announcement: "",
      });
    });

    render(<DiffView />);

    expect(screen.getByText("Looks good!")).toBeInTheDocument();
    expect(screen.getByText("Thread on line 2")).toBeInTheDocument();
  });
});
