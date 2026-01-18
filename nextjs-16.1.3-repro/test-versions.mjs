#!/usr/bin/env node

/**
 * Test script to compare Next.js versions
 * 
 * Usage:
 *   node test-versions.mjs
 * 
 * This script will:
 * 1. Test with Next.js 16.1.1
 * 2. Test with Next.js 16.1.3
 * 3. Compare the results
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';

const VERSIONS_TO_TEST = ['16.1.1', '16.1.3'];

console.log('=== Next.js Version Comparison Test ===\n');

async function testVersion(version) {
  console.log(`\n📦 Testing Next.js ${version}...`);
  
  try {
    // Install the specific version
    console.log(`Installing next@${version}...`);
    execSync(`npm install --no-save next@${version}`, { 
      stdio: 'inherit' 
    });
    
    // Run diagnostics
    console.log('\nRunning diagnostics...');
    execSync('node diagnose.mjs', { stdio: 'inherit' });
    
    // Try to build
    console.log('\nTrying build...');
    try {
      execSync('npm run build', { 
        stdio: 'pipe',
        timeout: 60000 
      });
      console.log('✅ Build succeeded');
    } catch (error) {
      console.log('❌ Build failed');
      console.log(error.stdout?.toString() || '');
      console.log(error.stderr?.toString() || '');
    }
    
    // Try dev server (with timeout)
    console.log('\nTrying dev server (10 second timeout)...');
    try {
      // Use a cross-platform approach with Node.js child_process
      const { spawn } = await import('child_process');
      const devProcess = spawn('npm', ['run', 'dev'], {
        stdio: 'inherit',
        shell: true,
        timeout: 10000
      });
      
      // Wait for 10 seconds
      await new Promise((resolve) => setTimeout(resolve, 10000));
      
      // Kill the process
      devProcess.kill();
      
      console.log('✅ Dev server started successfully');
    } catch (error) {
      console.log('❌ Dev server failed to start');
      console.log(error.message);
    }
    
  } catch (error) {
    console.error(`❌ Error testing version ${version}:`, error.message);
  }
}

async function main() {
  // Save original package.json
  const originalPackageJson = readFileSync('package.json', 'utf8');
  
  try {
    for (const version of VERSIONS_TO_TEST) {
      await testVersion(version);
      console.log('\n' + '='.repeat(60) + '\n');
    }
    
    console.log('\n✅ Testing complete!');
    console.log('\nCompare the output above to identify differences between versions.');
    
  } finally {
    // Restore original package.json
    console.log('\nRestoring original package.json...');
    writeFileSync('package.json', originalPackageJson);
    execSync('npm install', { stdio: 'inherit' });
  }
}

main().catch(console.error);
