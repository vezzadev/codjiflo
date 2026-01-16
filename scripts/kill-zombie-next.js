import { execSync } from "child_process";
import { existsSync, rmSync } from "fs";
import { join } from "path";

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

killZombieNextProcess();
