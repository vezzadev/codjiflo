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
const ARTIFACT_ID_PATTERN = /\*\*Artifact\*\*: `(\d+)`/;
const PR_DESCRIPTION_MARKER = '<!-- codjiflo-link -->';

// ============================================================================
// Types
// ============================================================================

interface CommentData {
  iterationCount: number;
  runId: number;
  timestamp: string;
  artifactId: number;
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
 * Get the artifact ID from the existing PR comment.
 * Returns null if no comment exists or artifact ID is not found.
 */
export async function getArtifactIdFromComment(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  prNumber: number
): Promise<number | null> {
  const existingComment = await findExistingComment(octokit, owner, repo, prNumber);

  if (!existingComment) {
    return null;
  }

  const match = existingComment.body.match(ARTIFACT_ID_PATTERN);
  if (match && match[1]) {
    return parseInt(match[1], 10);
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
**Artifact**: \`${data.artifactId}\`
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

/**
 * Update PR description to include CodjiFlo review link.
 * Appends the link if not present, or updates existing link.
 */
export async function updatePRDescription(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  prNumber: number
): Promise<void> {
  // Get current PR data
  const { data: pr } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });

  const currentBody = pr.body || '';
  const codjifloLink = `https://codjiflo.vza.net/${owner}/${repo}/${prNumber}`;
  
  // Check if CodjiFlo link section already exists
  // Match from first marker through to second marker (inclusive)
  const markerRegex = new RegExp(`${PR_DESCRIPTION_MARKER}[\\s\\S]*?${PR_DESCRIPTION_MARKER}`);
  const linkSection = `${PR_DESCRIPTION_MARKER}\n\n---\n\n🔍 **[Review in CodjiFlo](${codjifloLink})**\n\n${PR_DESCRIPTION_MARKER}`;
  
  let newBody: string;
  if (currentBody.includes(PR_DESCRIPTION_MARKER)) {
    // Update existing link section
    newBody = currentBody.replace(markerRegex, linkSection);
  } else {
    // Append link section to description
    newBody = currentBody + (currentBody ? '\n\n' : '') + linkSection;
  }

  // Only update if the body has changed
  if (newBody !== currentBody) {
    await octokit.rest.pulls.update({
      owner,
      repo,
      pull_number: prNumber,
      body: newBody,
    });
  }
}
