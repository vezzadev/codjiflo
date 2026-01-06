import { execSync } from "child_process";

const E2E_PORT_ENV = "PLAYWRIGHT_E2E_PORT";

/**
 * Let the OS pick an available port by binding to port 0.
 * Caches result in env var to ensure all Playwright workers use the same port.
 */
export function findAvailablePortSync(): number {
  // Return cached port if already found (for parallel workers)
  if (process.env[E2E_PORT_ENV]) {
    return parseInt(process.env[E2E_PORT_ENV], 10);
  }

  // Bind to port 0 and let the OS assign a free port
  const result = execSync(
    `node -e "const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close()})"`,
    { encoding: "utf-8", timeout: 1000 }
  );

  const port = parseInt(result.trim(), 10);
  if (isNaN(port) || port <= 0) {
    throw new Error(`Failed to get available port from OS: ${result}`);
  }

  // Cache in env var for workers
  process.env[E2E_PORT_ENV] = String(port);
  return port;
}
