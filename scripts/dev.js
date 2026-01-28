import { execSync } from "child_process";
import { existsSync, rmSync } from "fs";
import { basename, join } from "path";
import { createServer } from "net";

const LOCK_FILE = join(process.cwd(), ".next", "dev", "lock");
const NEXT_CACHE = join(process.cwd(), ".next");
const PROJECT_PATH = process.cwd().replace(/\//g, "\\"); // Normalize to Windows paths

/**
 * Kills zombie Next.js dev server for THIS project only.
 * Detects the lock file and finds node processes with this project's path.
 * Also wipes .next cache to ensure clean restart.
 */
function killZombieNextProcess() {
  if (!existsSync(LOCK_FILE)) {
    return; // No lock file = no dev server was running
  }

  // Find node processes that contain this project's path in their command line
  const psCommand = `Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match '${PROJECT_PATH.replace(/\\/g, "\\\\")}' } | Select-Object -ExpandProperty ProcessId`;

  let pids = [];
  try {
    const output = execSync(`pwsh.exe -NoProfile -Command "${psCommand}"`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    pids = output
      .trim()
      .split(/\r?\n/)
      .filter((pid) => /^\d+$/.test(pid.trim()))
      .map((pid) => pid.trim());
  } catch {
    // No matching processes found
    return;
  }

  if (pids.length === 0) {
    return;
  }

  console.log(
    `Found zombie Next.js process(es) for this project: PIDs ${pids.join(", ")}`
  );

  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /T /F`, {
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch {
      // Process may have already exited (e.g., killed as child of another)
    }
  }

  console.log(`Killed ${pids.length} zombie process(es)`);

  // Small delay to ensure port is released
  execSync("pwsh.exe -NoProfile -Command Start-Sleep -Milliseconds 500", {
    stdio: "ignore",
  });

  // Wipe .next cache for clean restart
  try {
    rmSync(NEXT_CACHE, { recursive: true, force: true });
    console.log("Wiped .next cache");
  } catch {
    // Ignore if already deleted or inaccessible
  }
}

/**
 * Maps worktree directory name to port number.
 * A=3010, B=3020, C=3030, D=3040, ...
 * Anything else gets a dynamic port starting at 4000.
 */
function getPortForWorktree() {
  const dirName = basename(process.cwd());

  // Check if directory name is a single uppercase letter A-Z
  if (/^[A-Z]$/.test(dirName)) {
    const letter = dirName.charCodeAt(0); // ASCII code
    const port = 3000 + (letter - 65) * 10; // A=3010, B=3020, ...
    return { port, strict: true };
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
    server.listen(port, "::");
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
  killZombieNextProcess();

  // Ensure env is set up
  try {
    execSync("node scripts/ensure-env.js", { stdio: "inherit" });
  } catch {
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
