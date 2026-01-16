import { execSync } from "child_process";
import { basename } from "path";
import { createServer } from "net";

/**
 * Maps worktree directory name to port number.
 * A=3000, B=3010, C=3020, D=3030, E=3040
 * Anything else gets a dynamic port starting at 4000.
 */
function getPortForWorktree() {
  const dirName = basename(process.cwd());
  const worktreePorts = { A: 3000, B: 3010, C: 3020, D: 3030, E: 3040 };

  if (dirName in worktreePorts) {
    return { port: worktreePorts[dirName], strict: true };
  }

  // For non-worktree directories, find an available port starting at 4000
  return { port: 4000, strict: false };
}

/**
 * Check if a port is available by attempting to bind to it on all interfaces.
 * Next.js binds to :: (all interfaces) so we need to check that.
 */
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    // Bind to all interfaces (::) like Next.js does
    server.listen(port);
  });
}

/**
 * Find an available port starting from the given port.
 */
async function findAvailablePort(startPort) {
  for (let port = startPort; port < startPort + 100; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found in range ${startPort}-${startPort + 99}`);
}

async function main() {
  // Kill zombies first
  try {
    execSync("node scripts/kill-zombie-next.js", { stdio: "inherit" });
  } catch {
    // Ignore errors from kill-zombie
  }

  // Ensure env is set up
  try {
    execSync("node scripts/ensure-env.js", { stdio: "inherit" });
  } catch (error) {
    process.exit(1);
  }

  const { port: desiredPort, strict } = getPortForWorktree();
  const dirName = basename(process.cwd());

  if (strict) {
    // For designated worktree ports, fail if port is in use
    const available = await isPortAvailable(desiredPort);
    if (!available) {
      console.error(
        `\n❌ Port ${desiredPort} is already in use!\n` +
          `   Worktree ${dirName} requires port ${desiredPort}.\n` +
          `   Kill the process using this port and try again.\n`
      );
      process.exit(1);
    }
    console.log(`Starting dev server on port ${desiredPort} (worktree ${dirName})`);
    startNextDev(desiredPort);
  } else {
    // For other directories, find an available port
    const port = await findAvailablePort(desiredPort);
    console.log(`Starting dev server on port ${port}`);
    startNextDev(port);
  }
}

function startNextDev(port) {
  // Use execSync to run next dev - this keeps the shell behavior simple
  // and avoids spawn issues on Windows
  try {
    execSync(`npx next dev --turbopack --port ${port}`, {
      stdio: "inherit",
    });
  } catch (error) {
    // execSync throws on non-zero exit or signal termination
    process.exit(error.status ?? 1);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
