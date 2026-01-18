# How to Report This Issue to Next.js

This guide will help you report the issue to the Next.js team with a complete minimal reproduction.

## Prerequisites

Before reporting, please:

1. ✅ Test with the latest Next.js canary version
2. ✅ Confirm the issue exists with Next.js 16.1.3
3. ✅ Verify it works with Next.js 16.1.1
4. ✅ Document your exact error messages
5. ✅ Note your environment details

## Step 1: Create Your Own Reproduction Repository

You have two options:

### Option A: Fork This Repository

1. Fork this repository to your GitHub account
2. Clone your fork locally
3. Test the reproduction on your machine
4. Document any errors you encounter

### Option B: Create a Fresh Repository

1. Create a new repository from this reproduction
2. Push it to GitHub
3. Make it public for the Next.js team to access

## Step 2: Test the Reproduction

Run the following commands and document the output:

```bash
# Install dependencies
npm install

# Run diagnostics
npm run diagnose

# Test development server
npm run dev

# Test build
npm run build
```

### What to Document

For each command, note:
- ✅ Success or ❌ Failure
- Complete error messages
- Console output
- System information from `npm run diagnose`

## Step 3: Prepare Your Issue Report

Use the template in `ISSUE_TEMPLATE.md` and fill in:

### Required Information

1. **Environment Details** (from `npm run diagnose`):
   - Operating System and version
   - Node.js version
   - npm version
   - Next.js version (16.1.3)

2. **Error Messages**:
   - Complete stack traces
   - Console errors
   - Build failures

3. **Reproduction Link**:
   - Your public GitHub repository URL
   - Specific commit SHA if relevant

4. **Steps That Fail**:
   - `npm run dev` ✅ or ❌
   - `npm run build` ✅ or ❌
   - Which platform (Windows/macOS/Linux)

### Comparison with Working Version

If possible, also test with Next.js 16.1.1:

```bash
# Test with 16.1.1
npm install next@16.1.1
npm run dev
npm run build
```

Document the differences in behavior.

## Step 4: Submit the Issue

1. Go to: https://github.com/vercel/next.js/issues/new/choose
2. Select "Bug Report"
3. Fill in the template with your information
4. Include the link to your reproduction repository
5. Add relevant labels:
   - `area: turbopack`
   - `area: configuration`
   - `bug`

### Issue Title Format

```
[Turbopack] Dev server fails with import.meta.dirname in next.config.ts (Next.js 16.1.3)
```

### Issue Body Template

```markdown
## Verify canary release

- [ ] I verified that the issue exists in the latest Next.js canary release

## Provide environment information

**Operating System:**
- Platform: [Windows/macOS/Linux]
- Version: [OS version]

**Binaries:**
- Node: [version from npm run diagnose]
- npm: [version]

**Relevant Packages:**
- next: 16.1.3
- react: 19.2.1
- react-dom: 19.2.1
- typescript: 5.x

## Which area(s) are affected?

Turbopack, Configuration (next.config.ts)

## Which stage(s) are affected?

next dev (local)

## Link to the code that reproduces this issue

https://github.com/[your-username]/nextjs-16.1.3-repro

## To Reproduce

1. Clone the reproduction repository: `git clone https://github.com/[your-username]/nextjs-16.1.3-repro`
2. Install dependencies: `npm install`
3. Run dev server: `npm run dev`
4. [Observe the error - describe what happens]

## Current vs. Expected behavior

**Current Behavior (Next.js 16.1.3):**
[Describe the error or unexpected behavior]

**Expected Behavior (Works in Next.js 16.1.1):**
The dev server starts successfully with the following turbopack configuration:

\`\`\`typescript
turbopack: {
  root: import.meta.dirname,
  resolveAlias: {
    fs: { browser: './src/lib/empty-module.js' },
    path: { browser: './src/lib/empty-module.js' },
    crypto: { browser: './src/lib/empty-module.js' },
  },
}
\`\`\`

## Describe the Bug

When upgrading from Next.js 16.1.1 to 16.1.3, using `import.meta.dirname` in the `turbopack.root` configuration causes [describe the specific issue].

Error message:
\`\`\`
[Paste complete error message here]
\`\`\`

This configuration is used to replace Node.js built-in modules with empty modules for browser compatibility when using SQL.js with WASM.

## Additional Context

Diagnostics output:
\`\`\`
[Paste output from npm run diagnose]
\`\`\`

The issue appears to be [Windows/macOS/Linux]-specific and may be related to path handling differences between versions.

Tested configurations:
- ✅ Works with Next.js 16.1.1
- ❌ Fails with Next.js 16.1.3

[Add any other relevant information]
```

## Step 5: Follow Up

After submitting:

1. Monitor the issue for responses from the Next.js team
2. Be ready to provide additional information
3. Test any suggested fixes
4. Update the issue with new findings

## Alternative: Submit via Reproduction Template

Next.js has a reproduction template at:
https://github.com/vercel/next.js/tree/canary/examples/reproduction-template

You can also use that as a starting point and copy the relevant configuration from this repro.

## Need Help?

If you need help creating the reproduction or reporting the issue:

1. Check existing Next.js issues: https://github.com/vercel/next.js/issues
2. Search for similar problems with `import.meta.dirname` and turbopack
3. Join the Next.js Discord: https://nextjs.org/discord
4. Ask in the #help-forum channel

## Checklist Before Submitting

- [ ] Tested with Next.js 16.1.3
- [ ] Tested with Next.js 16.1.1 (for comparison)
- [ ] Ran `npm run diagnose` and saved output
- [ ] Documented complete error messages
- [ ] Created public reproduction repository
- [ ] Filled out issue template completely
- [ ] Added relevant labels
- [ ] Tested on the platform where the issue occurs
- [ ] Checked for duplicate issues

## Thank You!

By reporting this issue with a complete reproduction, you help make Next.js better for everyone! 🎉
