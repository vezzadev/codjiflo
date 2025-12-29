/**
 * Comment Manager
 *
 * Manages the CodjiFlo data comment on PRs.
 */

import * as github from '@actions/github';

// ============================================================================
// Constants
// ============================================================================

const COMMENT_MARKER = '<!-- codjiflo-data -->';
const ARTIFACT_NAME_PATTERN = /\*\*Artifact\*\*: `([^`]+)`/;

// ============================================================================
// Types
// ============================================================================

interface CommentData {
  iterationCount: number;
  artifactName: string;
  runId: number;
  timestamp: string;
}

// ============================================================================
// Comment Management
// ============================================================================

/**
 * Create or update the CodjiFlo data comment on the PR.
 */
export async function updatePRComment(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  prNumber: number,
  data: CommentData
): Promise<void> {
  const body = formatCommentBody(data);

  // Find existing comment
  const existingComment = await findExistingComment(octokit, owner, repo, prNumber);

  if (existingComment) {
    // Update existing comment
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existingComment.id,
      body,
    });
  } else {
    // Create new comment
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });
  }
}

/**
 * Find existing CodjiFlo comment on PR.
 */
async function findExistingComment(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  prNumber: number
): Promise<{ id: number; body: string } | null> {
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
    per_page: 100,
  });

  const codjifloComment = comments.find((c) => c.body?.includes(COMMENT_MARKER));

  if (codjifloComment && codjifloComment.body) {
    return { id: codjifloComment.id, body: codjifloComment.body };
  }

  return null;
}

/**
 * Get the artifact name from the existing PR comment.
 * Returns null if no comment exists or artifact name is not found.
 */
export async function getArtifactNameFromComment(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  prNumber: number
): Promise<string | null> {
  const existingComment = await findExistingComment(octokit, owner, repo, prNumber);

  if (!existingComment) {
    return null;
  }

  const match = existingComment.body.match(ARTIFACT_NAME_PATTERN);
  if (match && match[1]) {
    return match[1];
  }

  return null;
}

/**
 * Format the comment body with metadata.
 */
function formatCommentBody(data: CommentData): string {
  return `${COMMENT_MARKER}
### CodjiFlo Iteration Tracking

**Iterations captured**: ${data.iterationCount}
**Last updated**: ${data.timestamp}
**Artifact**: \`${data.artifactName}\`
**Run ID**: ${data.runId}

---
<details>
<summary>What is this?</summary>

This comment is automatically updated by the [CodjiFlo GitHub Action](https://github.com/codjiflo/action) to enable force-push resilient code review with iteration tracking.

The artifact referenced above contains iteration data that the CodjiFlo frontend uses to:
- Track code changes across force-pushes
- Enable comment persistence across code modifications
- Allow comparison between any two iterations

</details>
`;
}
