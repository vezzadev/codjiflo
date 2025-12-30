#!/bin/bash
# Setup script for E2E test repository
# Creates PRs and comments in pedropaulovc/codjiflo-e2e-test-repo
#
# Prerequisites:
#   - gh CLI installed and authenticated
#   - Repository pedropaulovc/codjiflo-e2e-test-repo exists
#
# Usage:
#   ./scripts/setup-e2e-test-repo.sh

set -e

OWNER="pedropaulovc"
REPO="codjiflo-e2e-test-repo"
REPO_URL="https://github.com/$OWNER/$REPO"

echo "Setting up E2E test repository: $REPO_URL"
echo "============================================"

# Check if gh is authenticated
if ! gh auth status &>/dev/null; then
    echo "Error: gh CLI is not authenticated. Run 'gh auth login' first."
    exit 1
fi

# Clone or update the repo
TEMP_DIR=$(mktemp -d)
echo "Cloning repository to $TEMP_DIR..."
git clone "$REPO_URL.git" "$TEMP_DIR/repo"
cd "$TEMP_DIR/repo"

# Ensure we have a main branch with initial content
if ! git rev-parse --verify main &>/dev/null; then
    echo "Creating initial main branch..."
    mkdir -p src
    echo "# CodjiFlo E2E Test Repository" > README.md
    echo "" >> README.md
    echo "This repository contains test data for CodjiFlo E2E tests." >> README.md
    git add README.md
    git commit -m "Initial commit"
    git branch -M main
    git push -u origin main
fi

# Always ensure src directory exists
mkdir -p src

# ============================================================================
# PR #1: Comment Positioning (test/comment-positioning)
# ============================================================================
echo ""
echo "Creating PR: Comment Positioning..."

git checkout main
git pull origin main
git checkout -B test/comment-positioning

mkdir -p src
cat > src/positioning-test.ts << 'EOF'
// Context line 1
// Context line 2
// Context line 3
const newValue = 'added on line 5';
// Context line for CP-03
const ABCDEFGHIJKLMNOPQRSTUVWXYZ = 'character-level test';
const multiLineStart = 'line 6';
const multiLineMiddle = 'line 7';
const multiLineEnd = 'line 8 end';
const partialLineStart = 'partial at offset 30';
const partialLineEnd = 'ends here at 15';
EOF

git add src/positioning-test.ts
git commit -m "test: Add positioning test file"
git push -u origin test/comment-positioning --force

# Create PR and capture the number
PR1_URL=$(gh pr create \
    --repo "$OWNER/$REPO" \
    --title "test: Comment Positioning" \
    --body "Test PR for validating line-level and character-level comment positions" \
    --base main \
    --head test/comment-positioning 2>/dev/null || gh pr view test/comment-positioning --repo "$OWNER/$REPO" --json url -q .url)
PR1_NUM=$(echo "$PR1_URL" | grep -oE '[0-9]+$')
echo "Created/Found PR #$PR1_NUM"

# Add comments
echo "Adding comments to PR #$PR1_NUM..."
COMMIT_SHA=$(git rev-parse HEAD)

gh api "repos/$OWNER/$REPO/pulls/$PR1_NUM/comments" \
    --method POST \
    -f body="[CP-01] Comment on added line - should appear on RIGHT side of diff" \
    -f path="src/positioning-test.ts" \
    -f commit_id="$COMMIT_SHA" \
    -F line=5 \
    -f side="RIGHT" 2>/dev/null || echo "Comment CP-01 may already exist"

gh api "repos/$OWNER/$REPO/pulls/$PR1_NUM/comments" \
    --method POST \
    -f body="[CP-02] Comment on deleted line - should appear on LEFT side of diff" \
    -f path="src/positioning-test.ts" \
    -f commit_id="$COMMIT_SHA" \
    -F line=4 \
    -f side="RIGHT" 2>/dev/null || echo "Comment CP-02 may already exist"

gh api "repos/$OWNER/$REPO/pulls/$PR1_NUM/comments" \
    --method POST \
    -f body="[CP-03] Comment on context (unchanged) line - visible in both views" \
    -f path="src/positioning-test.ts" \
    -f commit_id="$COMMIT_SHA" \
    -F line=6 \
    -f side="RIGHT" 2>/dev/null || echo "Comment CP-03 may already exist"

# ============================================================================
# PR #2: Comment Threading & States (test/comment-threading)
# ============================================================================
echo ""
echo "Creating PR: Comment Threading..."

git checkout main
git pull origin main
git checkout -B test/comment-threading

mkdir -p src
cat > src/threading-test.ts << 'EOF'
// Line 1: context
// Line 2: added - CT-01 active thread here
// Line 3: added
// Line 4: added - CT-02 resolved thread here
// Line 5: added
// Line 6: added - CT-07 3-level reply chain here
// Line 7: added
// Line 8: added
// Line 9: added
// Line 10: added - CT-08 multiple parallel threads
// Original line 5
EOF

git add src/threading-test.ts
git commit -m "test: Add threading test file"
git push -u origin test/comment-threading --force

PR2_URL=$(gh pr create \
    --repo "$OWNER/$REPO" \
    --title "test: Comment Threading & States" \
    --body "Test PR for thread status transitions and reply chains" \
    --base main \
    --head test/comment-threading 2>/dev/null || gh pr view test/comment-threading --repo "$OWNER/$REPO" --json url -q .url)
PR2_NUM=$(echo "$PR2_URL" | grep -oE '[0-9]+$')
echo "Created/Found PR #$PR2_NUM"

COMMIT_SHA=$(git rev-parse HEAD)

# CT-01: Active thread
gh api "repos/$OWNER/$REPO/pulls/$PR2_NUM/comments" \
    --method POST \
    -f body="[CT-01] Active thread - status 1 (open discussion)" \
    -f path="src/threading-test.ts" \
    -f commit_id="$COMMIT_SHA" \
    -F line=2 \
    -f side="RIGHT" 2>/dev/null || echo "Comment CT-01 may already exist"

# CT-02: Resolved thread
gh api "repos/$OWNER/$REPO/pulls/$PR2_NUM/comments" \
    --method POST \
    -f body="[CT-02] This thread has been RESOLVED (status 2 - Fixed)" \
    -f path="src/threading-test.ts" \
    -f commit_id="$COMMIT_SHA" \
    -F line=4 \
    -f side="RIGHT" 2>/dev/null || echo "Comment CT-02 may already exist"

# CT-07: 3-level reply chain
ROOT_COMMENT=$(gh api "repos/$OWNER/$REPO/pulls/$PR2_NUM/comments" \
    --method POST \
    -f body="[CT-07] ROOT COMMENT - Starting discussion" \
    -f path="src/threading-test.ts" \
    -f commit_id="$COMMIT_SHA" \
    -F line=6 \
    -f side="RIGHT" 2>/dev/null | jq -r '.id') || ROOT_COMMENT=""

if [ -n "$ROOT_COMMENT" ] && [ "$ROOT_COMMENT" != "null" ]; then
    REPLY1=$(gh api "repos/$OWNER/$REPO/pulls/$PR2_NUM/comments" \
        --method POST \
        -f body="[CT-07] LEVEL 2 REPLY - Responding to root" \
        -F in_reply_to="$ROOT_COMMENT" 2>/dev/null | jq -r '.id') || REPLY1=""

    if [ -n "$REPLY1" ] && [ "$REPLY1" != "null" ]; then
        gh api "repos/$OWNER/$REPO/pulls/$PR2_NUM/comments" \
            --method POST \
            -f body="[CT-07] LEVEL 3 REPLY - Responding to level 2" \
            -F in_reply_to="$REPLY1" 2>/dev/null || echo "Reply CT-07-L3 may already exist"
    fi
fi

# CT-08: Multiple parallel threads on same line
gh api "repos/$OWNER/$REPO/pulls/$PR2_NUM/comments" \
    --method POST \
    -f body="[CT-08] Thread 1 on line 10 - First parallel thread" \
    -f path="src/threading-test.ts" \
    -f commit_id="$COMMIT_SHA" \
    -F line=10 \
    -f side="RIGHT" 2>/dev/null || echo "Comment CT-08-T1 may already exist"

gh api "repos/$OWNER/$REPO/pulls/$PR2_NUM/comments" \
    --method POST \
    -f body="[CT-08] Thread 2 on line 10 - Second parallel thread" \
    -f path="src/threading-test.ts" \
    -f commit_id="$COMMIT_SHA" \
    -F line=10 \
    -f side="RIGHT" 2>/dev/null || echo "Comment CT-08-T2 may already exist"

# ============================================================================
# PR #3: File Operations (test/file-operations)
# ============================================================================
echo ""
echo "Creating PR: File Operations..."

git checkout main
git pull origin main
git checkout -B test/file-operations

mkdir -p src
cat > src/file-to-delete.txt << 'EOF'
// This file will be deleted
const oldCode = 'legacy';
function deprecated() {}
// No longer needed
export {};
EOF

cat > src/new-file.txt << 'EOF'
// This is a new file
const greeting = 'Hello';
const target = 'World';
console.log(greeting, target);
// End of new file
EOF

cat > src/new-name.txt << 'EOF'
// This file was renamed
const content = 'preserved';
const addedLine = 'after rename';
export { content };
EOF

git add .
git commit -m "test: File operations - add files"
git push -u origin test/file-operations --force

PR3_URL=$(gh pr create \
    --repo "$OWNER/$REPO" \
    --title "test: File Operations" \
    --body "Test PR for comments on added/deleted/renamed files" \
    --base main \
    --head test/file-operations 2>/dev/null || gh pr view test/file-operations --repo "$OWNER/$REPO" --json url -q .url)
PR3_NUM=$(echo "$PR3_URL" | grep -oE '[0-9]+$')
echo "Created/Found PR #$PR3_NUM"

COMMIT_SHA=$(git rev-parse HEAD)

# FO-01: Comment on new file
gh api "repos/$OWNER/$REPO/pulls/$PR3_NUM/comments" \
    --method POST \
    -f body="[FO-01] Comment on NEW FILE - rightFileStart only" \
    -f path="src/new-file.txt" \
    -f commit_id="$COMMIT_SHA" \
    -F line=2 \
    -f side="RIGHT" 2>/dev/null || echo "Comment FO-01 may already exist"

# FO-02: Comment on file to be deleted (simulate)
gh api "repos/$OWNER/$REPO/pulls/$PR3_NUM/comments" \
    --method POST \
    -f body="[FO-02] Comment on DELETED FILE - leftFileStart only" \
    -f path="src/file-to-delete.txt" \
    -f commit_id="$COMMIT_SHA" \
    -F line=3 \
    -f side="RIGHT" 2>/dev/null || echo "Comment FO-02 may already exist"

# FO-03: Comment on renamed file
gh api "repos/$OWNER/$REPO/pulls/$PR3_NUM/comments" \
    --method POST \
    -f body="[FO-03] Comment on RENAMED FILE - track via changeTrackingId" \
    -f path="src/new-name.txt" \
    -f commit_id="$COMMIT_SHA" \
    -F line=3 \
    -f side="RIGHT" 2>/dev/null || echo "Comment FO-03 may already exist"

# ============================================================================
# PR #4: Edge Cases (test/edge-cases)
# ============================================================================
echo ""
echo "Creating PR: Edge Cases..."

git checkout main
git pull origin main
git checkout -B test/edge-cases

mkdir -p src

# Empty file
touch src/empty-file.txt

# Long line file
python3 -c "print('X' * 1000)" > src/long-line.txt 2>/dev/null || echo "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" > src/long-line.txt

# Unicode test file
cat > src/unicode-test.ts << 'EOF'
const regular = 'ascii';
const japanese = '修正済み';
const russian = 'Привет';
const arabic = 'مرحبا';
const emoji = '🎉✨🚀';
EOF

git add .
git commit -m "test: Add edge case files"
git push -u origin test/edge-cases --force

PR4_URL=$(gh pr create \
    --repo "$OWNER/$REPO" \
    --title "test: Edge Cases" \
    --body "Test PR for unusual but valid scenarios" \
    --base main \
    --head test/edge-cases 2>/dev/null || gh pr view test/edge-cases --repo "$OWNER/$REPO" --json url -q .url)
PR4_NUM=$(echo "$PR4_URL" | grep -oE '[0-9]+$')
echo "Created/Found PR #$PR4_NUM"

COMMIT_SHA=$(git rev-parse HEAD)

# EC-04: Unicode/emoji comment
gh api "repos/$OWNER/$REPO/pulls/$PR4_NUM/comments" \
    --method POST \
    -f body="[EC-04] 🎉 修正済み Привет مرحبا - Unicode/emoji rendering test" \
    -f path="src/unicode-test.ts" \
    -f commit_id="$COMMIT_SHA" \
    -F line=3 \
    -f side="RIGHT" 2>/dev/null || echo "Comment EC-04 may already exist"

# EC-05: First character of file
gh api "repos/$OWNER/$REPO/pulls/$PR4_NUM/comments" \
    --method POST \
    -f body="[EC-05] Comment at first character of file" \
    -f path="src/unicode-test.ts" \
    -f commit_id="$COMMIT_SHA" \
    -F line=1 \
    -f side="RIGHT" 2>/dev/null || echo "Comment EC-05 may already exist"

# ============================================================================
# PR #5: Multi-Commit Push (test/multi-commit-push)
# ============================================================================
echo ""
echo "Creating PR: Multi-Commit Push..."

git checkout main
git pull origin main
git checkout -B test/multi-commit-push

mkdir -p src
cat > src/multi-commit-file.txt << 'EOF'
// Multi-commit file
// Line 2: Commit 1
// Line 3: Commit 1
// Line 4: Commit 2
// Line 5: Commit 2
// Line 6: Commit 3 (MC-01 comment here)
// Line 7: Commit 3
// Line 8: Commit 4
// Line 9: Commit 5 (iter 2)
// Line 10: Commit 5
// Line 11: Commit 6
// Line 12: Commit 6
// Line 13: Commit 7 (MC-03 comment here)
// Line 14: Commit 7
EOF

cat > src/second-file.txt << 'EOF'
// Second file - added in Commit 4
// Line 2
// Line 3
// Line 4
// Line 5 (MC-02 comment here)
// Line 6
// Line 7 (iter 2 content)
// Line 8
// Line 9
// Line 10
EOF

git add .
git commit -m "test: Add multi-commit files"
git push -u origin test/multi-commit-push --force

PR5_URL=$(gh pr create \
    --repo "$OWNER/$REPO" \
    --title "test: Multi-Commit Push" \
    --body "Test PR for multiple commits pushed in a single push operation" \
    --base main \
    --head test/multi-commit-push 2>/dev/null || gh pr view test/multi-commit-push --repo "$OWNER/$REPO" --json url -q .url)
PR5_NUM=$(echo "$PR5_URL" | grep -oE '[0-9]+$')
echo "Created/Found PR #$PR5_NUM"

COMMIT_SHA=$(git rev-parse HEAD)

# MC-01: Comment on line 6
gh api "repos/$OWNER/$REPO/pulls/$PR5_NUM/comments" \
    --method POST \
    -f body="[MC-01] Comment on line 6 from Commit 3" \
    -f path="src/multi-commit-file.txt" \
    -f commit_id="$COMMIT_SHA" \
    -F line=6 \
    -f side="RIGHT" 2>/dev/null || echo "Comment MC-01 may already exist"

# MC-02: Comment on second file
gh api "repos/$OWNER/$REPO/pulls/$PR5_NUM/comments" \
    --method POST \
    -f body="[MC-02] Comment on second-file.txt line 5" \
    -f path="src/second-file.txt" \
    -f commit_id="$COMMIT_SHA" \
    -F line=5 \
    -f side="RIGHT" 2>/dev/null || echo "Comment MC-02 may already exist"

# MC-03: Comment on line 13
gh api "repos/$OWNER/$REPO/pulls/$PR5_NUM/comments" \
    --method POST \
    -f body="[MC-03] Comment on line 13 from Commit 7" \
    -f path="src/multi-commit-file.txt" \
    -f commit_id="$COMMIT_SHA" \
    -F line=13 \
    -f side="RIGHT" 2>/dev/null || echo "Comment MC-03 may already exist"

# ============================================================================
# Cleanup
# ============================================================================
echo ""
echo "Cleaning up..."
cd /
rm -rf "$TEMP_DIR"

echo ""
echo "============================================"
echo "E2E test repository setup complete!"
echo ""
echo "Created PRs:"
echo "  - PR #$PR1_NUM: Comment Positioning"
echo "  - PR #$PR2_NUM: Comment Threading & States"
echo "  - PR #$PR3_NUM: File Operations"
echo "  - PR #$PR4_NUM: Edge Cases"
echo "  - PR #$PR5_NUM: Multi-Commit Push"
echo ""
echo "IMPORTANT: Update e2e/fixtures/azure-devops-test-matrix.ts"
echo "to use these PR numbers for prod mode tests."
echo ""
echo "To run E2E tests in prod mode:"
echo "  npm run test:e2e:prod"
echo "============================================"
