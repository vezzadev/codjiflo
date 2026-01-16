import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCommentsStore } from "./useCommentsStore";
import * as githubClient from "@/api/github/github-client";

// Mock the github client
vi.mock("@/api/github/github-client", () => ({
  githubClient: {
    fetch: vi.fn(),
  },
  GitHubAPIError: class GitHubAPIError extends Error {
    constructor(
      public status: number,
      public statusText: string,
      message: string
    ) {
      super(message);
      this.name = "GitHubAPIError";
    }
  },
}));

describe("useCommentsStore", () => {
  beforeEach(() => {
    useCommentsStore.setState({
      threads: [],
      isLoading: false,
      error: null,
      announcement: "",
    });
  });

  it("adds a new thread when adding a comment on a new line", async () => {
    await useCommentsStore.getState().addComment({
      path: "src/example.ts",
      line: 10,
      side: "RIGHT",
      body: "New comment",
      position: 1,
    });

    const { threads, announcement } = useCommentsStore.getState();
    expect(threads).toHaveLength(1);
    expect(threads[0]?.comments[0]?.body).toBe("New comment");
    expect(announcement).toBe("Comment posted.");
  });

  it("appends comment to existing thread when same line and side", async () => {
    useCommentsStore.setState({
      threads: [
        {
          id: "thread-1",
          path: "src/example.ts",
          line: 10,
          side: "RIGHT",
          isResolved: false,
          comments: [
            {
              id: "comment-1",
              body: "Initial comment",
              author: { id: "1", login: "you", avatarUrl: "https://example.com/1" },
              createdAt: new Date(),
              updatedAt: new Date(),
              path: "src/example.ts",
              line: 10,
              side: "RIGHT",
              position: 1,
            },
          ],
        },
      ],
    });

    await useCommentsStore.getState().addComment({
      path: "src/example.ts",
      line: 10,
      side: "RIGHT",
      body: "Second comment on same line",
      position: 1,
    });

    const { threads, announcement } = useCommentsStore.getState();
    expect(threads).toHaveLength(1);
    expect(threads[0]?.comments).toHaveLength(2);
    expect(threads[0]?.comments[1]?.body).toBe("Second comment on same line");
    expect(announcement).toBe("Comment posted.");
  });

  it("appends a reply to an existing thread", async () => {
    useCommentsStore.setState({
      threads: [
        {
          id: "thread-1",
          path: "src/example.ts",
          line: 10,
          side: "RIGHT",
          isResolved: false,
          comments: [
            {
              id: "comment-1",
              body: "Initial comment",
              author: { id: "1", login: "you", avatarUrl: "https://example.com/1" },
              createdAt: new Date(),
              updatedAt: new Date(),
              path: "src/example.ts",
              line: 10,
              side: "RIGHT",
              position: 1,
            },
          ],
        },
      ],
    });

    await useCommentsStore.getState().addReply("thread-1", "Reply message");

    const { threads } = useCommentsStore.getState();
    expect(threads[0]?.comments).toHaveLength(2);
    expect(threads[0]?.comments[1]?.body).toBe("Reply message");
    expect(threads[0]?.comments[1]?.inReplyTo).toBe("comment-1");
  });

  it("edits a comment body and updates timestamp", async () => {
    const originalDate = new Date("2023-01-01");
    useCommentsStore.setState({
      threads: [
        {
          id: "thread-1",
          path: "src/example.ts",
          line: 10,
          side: "RIGHT",
          isResolved: false,
          comments: [
            {
              id: "comment-1",
              body: "Original body",
              author: { id: "1", login: "you", avatarUrl: "https://example.com/1" },
              createdAt: originalDate,
              updatedAt: originalDate,
              path: "src/example.ts",
              line: 10,
              side: "RIGHT",
              position: 1,
            },
          ],
        },
      ],
    });

    await useCommentsStore.getState().editComment("comment-1", "Updated body");

    const { threads, announcement } = useCommentsStore.getState();
    expect(threads[0]?.comments[0]?.body).toBe("Updated body");
    expect(threads[0]?.comments[0]?.updatedAt.getTime()).toBeGreaterThan(originalDate.getTime());
    expect(announcement).toBe("Comment updated.");
  });

  it("toggles thread resolved state", () => {
    useCommentsStore.setState({
      threads: [
        {
          id: "thread-1",
          path: "src/example.ts",
          line: 10,
          side: "RIGHT",
          isResolved: false,
          comments: [
            {
              id: "comment-1",
              body: "Comment",
              author: { id: "1", login: "you", avatarUrl: "https://example.com/1" },
              createdAt: new Date(),
              updatedAt: new Date(),
              path: "src/example.ts",
              line: 10,
              side: "RIGHT",
              position: 1,
            },
          ],
        },
      ],
    });

    useCommentsStore.getState().toggleResolved("thread-1");
    expect(useCommentsStore.getState().threads[0]?.isResolved).toBe(true);

    useCommentsStore.getState().toggleResolved("thread-1");
    expect(useCommentsStore.getState().threads[0]?.isResolved).toBe(false);
  });

  it("deletes a comment and removes empty threads", async () => {
    useCommentsStore.setState({
      threads: [
        {
          id: "thread-1",
          path: "src/example.ts",
          line: 10,
          side: "RIGHT",
          isResolved: false,
          comments: [
            {
              id: "comment-1",
              body: "Initial comment",
              author: { id: "1", login: "you", avatarUrl: "https://example.com/1" },
              createdAt: new Date(),
              updatedAt: new Date(),
              path: "src/example.ts",
              line: 10,
              side: "RIGHT",
              position: 1,
            },
          ],
        },
      ],
    });

    await useCommentsStore.getState().deleteComment("comment-1");

    expect(useCommentsStore.getState().threads).toHaveLength(0);
    expect(useCommentsStore.getState().announcement).toBe("Comment deleted.");
  });

  it("deletes only the specified comment, keeping others", async () => {
    useCommentsStore.setState({
      threads: [
        {
          id: "thread-1",
          path: "src/example.ts",
          line: 10,
          side: "RIGHT",
          isResolved: false,
          comments: [
            {
              id: "comment-1",
              body: "First comment",
              author: { id: "1", login: "you", avatarUrl: "https://example.com/1" },
              createdAt: new Date(),
              updatedAt: new Date(),
              path: "src/example.ts",
              line: 10,
              side: "RIGHT",
              position: 1,
            },
            {
              id: "comment-2",
              body: "Second comment",
              author: { id: "1", login: "you", avatarUrl: "https://example.com/1" },
              createdAt: new Date(),
              updatedAt: new Date(),
              path: "src/example.ts",
              line: 10,
              side: "RIGHT",
              position: 1,
            },
          ],
        },
      ],
    });

    await useCommentsStore.getState().deleteComment("comment-1");

    const { threads } = useCommentsStore.getState();
    expect(threads).toHaveLength(1);
    expect(threads[0]?.comments).toHaveLength(1);
    expect(threads[0]?.comments[0]?.id).toBe("comment-2");
  });

  it("clears error state", () => {
    useCommentsStore.setState({ error: "Some error" });
    useCommentsStore.getState().clearError();
    expect(useCommentsStore.getState().error).toBeNull();
  });

  it("clears announcement", () => {
    useCommentsStore.setState({ announcement: "Comment posted." });
    useCommentsStore.getState().clearAnnouncement();
    expect(useCommentsStore.getState().announcement).toBe("");
  });

  it("resets store to initial state", () => {
    useCommentsStore.setState({
      threads: [
        {
          id: "thread-1",
          path: "src/example.ts",
          line: 10,
          side: "RIGHT",
          isResolved: false,
          comments: [],
        },
      ],
      isLoading: true,
      error: "Some error",
      announcement: "Some announcement",
    });

    useCommentsStore.getState().reset();

    const state = useCommentsStore.getState();
    expect(state.threads).toHaveLength(0);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.announcement).toBe("");
  });

  describe("loadThreads", () => {
    // Store mock reference outside to avoid unbound-method warning
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const mockFetch = () => vi.mocked(githubClient.githubClient.fetch);

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("loads and groups comments into threads successfully", async () => {
      const mockComments = [
        {
          id: 1,
          body: "First comment",
          user: { id: 101, login: "user1", avatar_url: "https://avatar.example.com/1" },
          created_at: "2024-01-01T10:00:00Z",
          updated_at: "2024-01-01T10:00:00Z",
          path: "src/file.ts",
          line: 10,
          side: "RIGHT",
          position: 1,
        },
        {
          id: 2,
          body: "Reply to first comment",
          user: { id: 102, login: "user2", avatar_url: "https://avatar.example.com/2" },
          created_at: "2024-01-01T11:00:00Z",
          updated_at: "2024-01-01T11:00:00Z",
          path: "src/file.ts",
          line: 10,
          side: "RIGHT",
          position: 1,
          in_reply_to_id: 1,
        },
      ];

      mockFetch().mockResolvedValue(mockComments);

      await useCommentsStore.getState().loadThreads("owner", "repo", 123);

      const state = useCommentsStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.threads).toHaveLength(1);
      expect(state.threads[0]?.comments).toHaveLength(2);
      expect(state.threads[0]?.comments[0]?.body).toBe("First comment");
      expect(state.threads[0]?.comments[1]?.body).toBe("Reply to first comment");
    });

    it("handles GitHubAPIError with custom message", async () => {
      mockFetch().mockRejectedValue(
        new githubClient.GitHubAPIError(404, "Not Found", "Resource not found")
      );

      await useCommentsStore.getState().loadThreads("owner", "repo", 123);

      const state = useCommentsStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).toContain("Unable to load comments");
      expect(state.error).toContain("Resource not found");
    });

    it("handles generic Error", async () => {
      mockFetch().mockRejectedValue(new Error("Network error"));

      await useCommentsStore.getState().loadThreads("owner", "repo", 456);

      const state = useCommentsStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).toContain("Unable to load comments");
      expect(state.error).toContain("Network error");
    });

    it("sets isLoading during fetch", async () => {
      let resolvePromise: ((value: unknown) => void) | undefined;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch().mockReturnValue(pendingPromise);

      const loadPromise = useCommentsStore.getState().loadThreads("owner", "repo", 789);

      expect(useCommentsStore.getState().isLoading).toBe(true);
      expect(useCommentsStore.getState().error).toBeNull();

      if (resolvePromise) {
        resolvePromise([]);
      }
      await loadPromise;

      expect(useCommentsStore.getState().isLoading).toBe(false);
    });

    it("groups multiple comments by root ID into threads", async () => {
      const mockComments = [
        {
          id: 1,
          body: "Root comment",
          user: { id: 101, login: "user1", avatar_url: "https://example.com/1" },
          created_at: "2024-01-01T10:00:00Z",
          updated_at: "2024-01-01T10:00:00Z",
          path: "src/file.ts",
          line: 10,
          side: "RIGHT" as const,
          position: 1,
        },
        {
          id: 2,
          body: "Reply 1",
          user: { id: 102, login: "user2", avatar_url: "https://example.com/2" },
          created_at: "2024-01-01T11:00:00Z",
          updated_at: "2024-01-01T11:00:00Z",
          path: "src/file.ts",
          line: 10,
          side: "RIGHT" as const,
          position: 1,
          in_reply_to_id: 1,
        },
        {
          id: 3,
          body: "Reply to reply",
          user: { id: 101, login: "user1", avatar_url: "https://example.com/1" },
          created_at: "2024-01-01T12:00:00Z",
          updated_at: "2024-01-01T12:00:00Z",
          path: "src/file.ts",
          line: 10,
          side: "RIGHT" as const,
          position: 1,
          in_reply_to_id: 2, // Reply to reply (should trace back to root)
        },
      ];

      mockFetch().mockResolvedValue(mockComments);

      await useCommentsStore.getState().loadThreads("owner", "repo", 123);

      const state = useCommentsStore.getState();
      // All three comments should be in the same thread
      expect(state.threads).toHaveLength(1);
      expect(state.threads[0]?.comments).toHaveLength(3);
    });

    it("creates separate threads for different root comments", async () => {
      const mockComments = [
        {
          id: 1,
          body: "First thread root",
          user: { id: 101, login: "user1", avatar_url: "https://example.com/1" },
          created_at: "2024-01-01T10:00:00Z",
          updated_at: "2024-01-01T10:00:00Z",
          path: "src/file.ts",
          line: 10,
          side: "RIGHT" as const,
          position: 1,
        },
        {
          id: 2,
          body: "Second thread root",
          user: { id: 102, login: "user2", avatar_url: "https://example.com/2" },
          created_at: "2024-01-01T11:00:00Z",
          updated_at: "2024-01-01T11:00:00Z",
          path: "src/file.ts",
          line: 20, // Different line
          side: "RIGHT" as const,
          position: 2,
        },
      ];

      mockFetch().mockResolvedValue(mockComments);

      await useCommentsStore.getState().loadThreads("owner", "repo", 123);

      const state = useCommentsStore.getState();
      expect(state.threads).toHaveLength(2);
    });

    it("handles comments with null line numbers", async () => {
      const mockComments = [
        {
          id: 1,
          body: "Comment on removed line",
          user: { id: 101, login: "user1", avatar_url: "https://example.com/1" },
          created_at: "2024-01-01T10:00:00Z",
          updated_at: "2024-01-01T10:00:00Z",
          path: "src/file.ts",
          line: null,
          side: "LEFT" as const,
          position: 1,
        },
      ];

      mockFetch().mockResolvedValue(mockComments);

      await useCommentsStore.getState().loadThreads("owner", "repo", 123);

      const state = useCommentsStore.getState();
      expect(state.threads).toHaveLength(1);
      expect(state.threads[0]?.line).toBeNull(); // Preserves null for unmappable comments
    });
  });

  describe("addReply edge cases", () => {
    it("handles reply to thread with no existing comments gracefully", async () => {
      useCommentsStore.setState({
        threads: [
          {
            id: "thread-1",
            path: "src/example.ts",
            line: 10,
            side: "RIGHT",
            isResolved: false,
            comments: [], // Empty comments array
          },
        ],
      });

      await useCommentsStore.getState().addReply("thread-1", "Reply to empty thread");

      const { threads } = useCommentsStore.getState();
      expect(threads[0]?.comments).toHaveLength(1);
      expect(threads[0]?.comments[0]?.inReplyTo).toBeUndefined();
    });

    it("does not modify other threads when adding reply", async () => {
      useCommentsStore.setState({
        threads: [
          {
            id: "thread-1",
            path: "src/example.ts",
            line: 10,
            side: "RIGHT",
            isResolved: false,
            comments: [
              {
                id: "comment-1",
                body: "Comment 1",
                author: { id: "1", login: "user1", avatarUrl: "https://example.com/1" },
                createdAt: new Date(),
                updatedAt: new Date(),
                path: "src/example.ts",
                line: 10,
                side: "RIGHT",
                position: 1,
              },
            ],
          },
          {
            id: "thread-2",
            path: "src/other.ts",
            line: 20,
            side: "RIGHT",
            isResolved: false,
            comments: [
              {
                id: "comment-2",
                body: "Comment 2",
                author: { id: "2", login: "user2", avatarUrl: "https://example.com/2" },
                createdAt: new Date(),
                updatedAt: new Date(),
                path: "src/other.ts",
                line: 20,
                side: "RIGHT",
                position: 2,
              },
            ],
          },
        ],
      });

      await useCommentsStore.getState().addReply("thread-1", "Reply to thread 1");

      const { threads } = useCommentsStore.getState();
      expect(threads[0]?.comments).toHaveLength(2);
      expect(threads[1]?.comments).toHaveLength(1); // Unchanged
    });
  });
});
