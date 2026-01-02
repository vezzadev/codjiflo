#!/usr/bin/env node
/**
 * Bootstrap script that loads the correct native binary for the current Node.js version.
 *
 * This action includes pre-built binaries for multiple Node.js versions to ensure
 * compatibility as GitHub Actions runners update their Node.js version.
 *
 * Supported: Node 20 (ABI 115), Node 22 (ABI 127), Node 24 (ABI 137)
 */

const fs = require('fs');
const path = require('path');

const SUPPORTED_ABIS = {
  115: 'Node 20',
  127: 'Node 22',
  137: 'Node 24'
};

function setupNativeBinary() {
  const currentAbi = parseInt(process.versions.modules, 10);

  if (!SUPPORTED_ABIS[currentAbi]) {
    console.error(`Unsupported Node.js ABI version: ${currentAbi}`);
    console.error(`Supported: ${Object.entries(SUPPORTED_ABIS).map(([abi, ver]) => `${ver} (ABI ${abi})`).join(', ')}`);
    process.exit(1);
  }

  const distDir = __dirname;
  const prebuildsDir = path.join(distDir, 'prebuilds');
  const targetDir = path.join(distDir, 'build', 'Release');
  const targetPath = path.join(targetDir, 'better_sqlite3.node');
  const sourcePath = path.join(prebuildsDir, `better_sqlite3-${currentAbi}.node`);

  // Skip if correct binary already in place (check by comparing file size as quick check)
  if (fs.existsSync(targetPath) && fs.existsSync(sourcePath)) {
    const targetSize = fs.statSync(targetPath).size;
    const sourceSize = fs.statSync(sourcePath).size;
    if (targetSize === sourceSize) {
      return; // Already set up with correct version
    }
  }

  // Create target directory if needed
  fs.mkdirSync(targetDir, { recursive: true });

  // Copy the correct binary
  if (!fs.existsSync(sourcePath)) {
    console.error(`Native binary not found: ${sourcePath}`);
    console.error(`Expected binaries in: ${prebuildsDir}`);
    process.exit(1);
  }

  fs.copyFileSync(sourcePath, targetPath);
  console.log(`Loaded native module for ${SUPPORTED_ABIS[currentAbi]} (ABI ${currentAbi})`);
}

// Set up the binary before loading the main bundle
setupNativeBinary();

// Run the main action
require('./index.js');
