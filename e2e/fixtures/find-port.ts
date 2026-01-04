import { execSync } from "child_process";

const E2E_PORT_ENV = "PLAYWRIGHT_E2E_PORT";

/**
 * Synchronously find an available port, caching result in env var.
 * This ensures all Playwright workers use the same port.
 */
export function findAvailablePortSync(startPort = 3000): number {
  // Return cached port if already found (for parallel workers)
  if (process.env[E2E_PORT_ENV]) {
    return parseInt(process.env[E2E_PORT_ENV], 10);
  }

  for (let port = startPort; port < startPort + 100; port++) {
    try {
      // Try to create a temporary server on the port using a child process
      // Bind to 0.0.0.0 to properly detect conflicts
      const result = execSync(
        `node -e "const s=require('net').createServer();s.listen(${port},'0.0.0.0',()=>{console.log('ok');s.close()});s.on('error',()=>process.exit(1))"`,
        { encoding: "utf-8", timeout: 500, stdio: ["pipe", "pipe", "pipe"] }
      );
      if (result.trim() === "ok") {
        // Cache in env var for workers
        process.env[E2E_PORT_ENV] = String(port);
        return port;
      }
    } catch {
      // Port is in use, try next
      continue;
    }
  }

  throw new Error(`No available port found starting from ${startPort}`);
}
