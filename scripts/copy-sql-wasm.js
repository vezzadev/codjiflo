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

// Files to copy
const files = ['sql-wasm.wasm', 'sql-wasm.js'];

// Ensure target directory exists
if (!existsSync(targetDir)) {
  mkdirSync(targetDir, { recursive: true });
  console.log('Created directory:', targetDir);
}

// Copy files
for (const file of files) {
  const source = join(sourceDir, file);
  const target = join(targetDir, file);

  if (existsSync(source)) {
    copyFileSync(source, target);
    console.log(`Copied: ${file}`);
  } else {
    console.warn(`Warning: Source file not found: ${source}`);
  }
}

console.log('SQL.js WASM files copied to public/sql-wasm/');
