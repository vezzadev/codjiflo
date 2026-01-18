// Diagnostic script to help identify the issue
import { fileURLToPath } from 'url';
import { dirname, sep } from 'path';

console.log('=== Path Diagnostics ===\n');

// Test import.meta.dirname (Node 20.11+)
console.log('import.meta.dirname:', import.meta.dirname);
console.log('typeof import.meta.dirname:', typeof import.meta.dirname);

// Test import.meta.url
console.log('\nimport.meta.url:', import.meta.url);

// Test alternative approaches
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
console.log('\n__filename (via fileURLToPath):', __filename);
console.log('__dirname (via dirname):', __dirname);

// Test process.cwd()
console.log('\nprocess.cwd():', process.cwd());

// Path separator
console.log('\nPath separator:', sep);
console.log('Platform:', process.platform);

// Check if paths use backslashes (Windows) or forward slashes (Unix)
if (import.meta.dirname) {
  console.log('\nPath contains backslashes:', import.meta.dirname.includes('\\'));
  console.log('Path contains forward slashes:', import.meta.dirname.includes('/'));
}

console.log('\n=== Next.js Version ===');
try {
  const pkg = await import('./node_modules/next/package.json', {
    with: { type: 'json' }
  });
  console.log('Next.js version:', pkg.default.version);
} catch (error) {
  console.log('Could not read Next.js version');
}

console.log('\n=== Node.js Version ===');
console.log('Node version:', process.version);
console.log('Node supports import.meta.dirname:', 'dirname' in import.meta);
