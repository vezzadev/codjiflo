/**
 * Copy SQL.js WASM files to public folder
 *
 * SQL.js requires WASM files to be served from a URL.
 * This script copies them from node_modules to public/sql-wasm/
 */

import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const sourceDir = join(projectRoot, 'node_modules', 'sql.js', 'dist');
const targetDir = join(projectRoot, 'public', 'sql-wasm');

// Check if sql.js is installed (may not exist during partial installs)
if (!existsSync(sourceDir)) {
  console.log('[postinstall] sql.js not found; skipping SQL WASM copy.');
  process.exit(0);
}

// Files to copy
const files = ['sql-wasm.wasm', 'sql-wasm.js'];

// Ensure target directory exists
if (!existsSync(targetDir)) {
  mkdirSync(targetDir, { recursive: true });
}

// Copy files
for (const file of files) {
  const source = join(sourceDir, file);
  const target = join(targetDir, file);

  if (existsSync(source)) {
    copyFileSync(source, target);
  } else {
    console.warn(`Warning: Source file not found: ${source}`);
  }
}
