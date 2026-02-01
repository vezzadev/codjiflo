/**
 * OTel-aligned Semantic Attributes
 *
 * Provides consistent attribute naming across the codebase following
 * OpenTelemetry semantic conventions. This allows future migration to
 * real OTel SDK without code changes.
 *
 * @see https://opentelemetry.io/docs/specs/otel/trace/semantic_conventions/
 */

export const SemanticAttributes = {
  // GitHub context
  GITHUB_OWNER: 'github.owner',
  GITHUB_REPO: 'github.repo',
  GITHUB_PR_NUMBER: 'github.pr.number',
  GITHUB_COMMIT_SHA: 'github.commit.sha',

  // Iteration context
  ITERATION_REVISION: 'iteration.revision',
  ITERATION_LINEAGE: 'iteration.lineage',
  ITERATION_MODE: 'iteration.mode',
  ITERATION_COUNT: 'iteration.count',

  // Diff context
  DIFF_FILE_PATH: 'diff.file.path',
  DIFF_LEFT_SHA: 'diff.left_sha',
  DIFF_RIGHT_SHA: 'diff.right_sha',
  DIFF_COMPARE_MODE: 'diff.compare_mode',
  DIFF_LINE_COUNT: 'diff.line_count',

  // Task context
  TASK_ID: 'task.id',
  TASK_TYPE: 'task.type',
  TASK_PRIORITY: 'task.priority',
  TASK_STATUS: 'task.status',
  TASK_QUEUE_DEPTH: 'task.queue_depth',

  // HTTP context (standard OTel)
  HTTP_METHOD: 'http.method',
  HTTP_URL: 'http.url',
  HTTP_STATUS_CODE: 'http.status_code',
  HTTP_RESPONSE_SIZE: 'http.response.size',

  // Storage context
  STORAGE_OPERATION: 'storage.operation',
  STORAGE_KEY: 'storage.key',
} as const;

export type AttributeKey = (typeof SemanticAttributes)[keyof typeof SemanticAttributes];
export type AttributeValue = string | number | boolean | string[] | number[];
export type Attributes = Record<string, AttributeValue>;
