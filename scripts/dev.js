import { execSync, execFileSync } from "child_process";
import { existsSync, rmSync } from "fs";
import { basename, join } from "path";
import { createServer } from "net";
import { platform } from "os";

const LOCK_FILE = join(process.cwd(), ".next", "dev", "lock");
const NEXT_CACHE = join(process.cwd(), ".next");
const IS_WINDOWS = platform() === "win32";

/**
 * Kills zombie Next.js dev server for THIS project only.
 * Detects the lock file and finds node processes with this project's path.
 * Also wipes .next cache to ensure clean restart.
 */
function killZombieNextProcess() {
  if (!existsSync(LOCK_FILE)) {
    return; // No lock file = no dev server was running
  }

  const pids = IS_WINDOWS ? findZombiePidsWindows() : findZombiePidsUnix();

  if (pids.length === 0) {
    return;
  }

  console.log(
    `Found zombie Next.js process(es) for this project: PIDs ${pids.join(", ")}`
  );

  for (const pid of pids) {
    try {
      if (IS_WINDOWS) {
        execSync(`taskkill /PID ${pid} /T /F`, {
          stdio: ["pipe", "pipe", "pipe"],
        });
      } else {
        // Kill entire process tree (like taskkill /T on Windows)
        killProcessTree(pid);
      }
    } catch {
      // Process may have already exited
    }
  }

  console.log(`Killed ${pids.length} zombie process(es)`);

  // Small delay to ensure port is released
  execSync(IS_WINDOWS
    ? "pwsh.exe -NoProfile -Command Start-Sleep -Milliseconds 500"
    : "sleep 0.5",
    { stdio: "ignore" }
  );

  // Wipe .next cache for clean restart
  try {
    rmSync(NEXT_CACHE, { recursive: true, force: true });
    console.log("Wiped .next cache");
  } catch {
    // Ignore if already deleted or inaccessible
  }
}

function findZombiePidsWindows() {
  const projectPath = process.cwd().replace(/\//g, "\\");
  // Escape single quotes for safe embedding in a PowerShell single-quoted string
  const escapedProjectPathForPwsh = projectPath.replace(/'/g, "''");
  const psCommand =
    `$projectPath = '${escapedProjectPathForPwsh}'; ` +
    `$escapedProjectPath = [regex]::Escape($projectPath); ` +
    "Get-CimInstance Win32_Process | " +
    "Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match $escapedProjectPath -and $_.CommandLine -match 'next\\W+dev' } | " +
    "Select-Object -ExpandProperty ProcessId";
  try {
    const output = execSync(`pwsh.exe -NoProfile -Command "${psCommand}"`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return output
      .trim()
      .split(/\r?\n/)
      .filter((pid) => /^\d+$/.test(pid.trim()))
      .map((pid) => pid.trim());
  } catch {
    return [];
  }
}

/**
 * Recursively kills a process and all its descendants (Unix equivalent of taskkill /T).
 */
function killProcessTree(pid) {
  // Find children first (depth-first kill)
  try {
    const children = execFileSync("ps", ["-o", "pid", "--no-headers", "--ppid", pid], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    for (const childPid of children.trim().split(/\n/).map(p => p.trim()).filter(p => /^\d+$/.test(p))) {
      killProcessTree(childPid);
    }
  } catch {
    // No children or ps failed
  }
  try {
    process.kill(Number(pid), "SIGKILL");
  } catch {
    // Already exited
  }
}

function findZombiePidsUnix() {
  const projectPath = process.cwd();
  try {
    // Use execFileSync to avoid shell injection risks from project paths
    const psOutput = execFileSync("ps", ["ax", "-o", "pid,args"], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return psOutput
      .split(/\n/)
      .filter((line) => line.includes(projectPath) && /\bnext\s+dev\b/.test(line))
      .map((line) => line.trim().split(/\s+/)[0])
      .filter((pid) => /^\d+$/.test(pid) && pid !== String(process.pid));
  } catch {
    return [];
  }
}

/**
 * Maps worktree directory name to port number.
 * A=3010, B=3020, C=3030, D=3040, ...
 * Anything else gets a dynamic port starting at 4000.
 */
function getPortForWorktree() {
  const dirName = basename(process.cwd());

  // Check if directory name ends with a single uppercase letter (e.g., "B" or "codjiflo-B")
  const match = dirName.match(/(?:^|-)([A-Z])$/);
  if (match) {
    const letter = match[1].charCodeAt(0); // ASCII code
    const port = 3010 + (letter - 65) * 10; // A=3010, B=3020, ...
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
      env: { ...process.env, NODE_OPTIONS: [process.env.NODE_OPTIONS, "--no-experimental-webstorage"].filter(Boolean).join(" ") },
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
