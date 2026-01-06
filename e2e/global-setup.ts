/**
 * Global setup for E2E tests.
 * Starts the Next.js server with OS-assigned port and writes port to file.
 */
import { spawn, execSync, type ChildProcess } from "child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT_FILE = join(__dirname, ".port");
const BUILD_MARKER = join(__dirname, ".build-done");

let serverProcess: ChildProcess | null = null;

/**
 * Wait for the port file to be written with a valid port number.
 */
async function waitForPortFile(
  timeoutMs: number = 60000
): Promise<number> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    if (existsSync(PORT_FILE)) {
      const content = readFileSync(PORT_FILE, "utf-8").trim();
      const port = parseInt(content, 10);
      if (port > 0) {
        return port;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for port file after ${timeoutMs}ms`);
}

/**
 * Wait for the server to be ready by checking if the URL is reachable.
 */
async function waitForServer(
  port: number,
  timeoutMs: number = 30000
): Promise<void> {
  const url = `http://localhost:${port}`;
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (response.ok || response.status === 404) {
        // Server is responding (404 is OK, means Next.js is running)
        return;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for server at ${url} after ${timeoutMs}ms`);
}

/**
 * Run npm build if not already done.
 */
async function runBuild(): Promise<void> {
  // Skip build if marker exists (for faster re-runs during development)
  if (existsSync(BUILD_MARKER) && process.env.SKIP_BUILD === "true") {
    console.log("[global-setup] Skipping build (SKIP_BUILD=true)");
    return;
  }

  console.log("[global-setup] Running npm run build...");
  return new Promise((resolve, reject) => {
    const build = spawn("npm", ["run", "build"], {
      cwd: join(__dirname, ".."),
      shell: true,
      stdio: "inherit",
    });

    build.on("exit", (code) => {
      if (code === 0) {
        writeFileSync(BUILD_MARKER, new Date().toISOString());
        resolve();
      } else {
        reject(new Error(`Build failed with code ${code}`));
      }
    });

    build.on("error", reject);
  });
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  const isCI = !!process.env.CI;
  const isProdMode = process.env.E2E_DEPENDENCIES_MODE === "prod";

  // In CI prod mode, we use the production site - no local server needed
  if (isProdMode && isCI) {
    console.log("[global-setup] Prod mode in CI - using production site");
    return async () => {};
  }

  // Clean up stale port file
  if (existsSync(PORT_FILE)) {
    unlinkSync(PORT_FILE);
  }

  // Run build first
  await runBuild();

  // Start the server with port 0 (OS picks a free port)
  console.log("[global-setup] Starting server with npm run start -- -p 0...");
  serverProcess = spawn("npm", ["run", "start", "--", "-p", "0"], {
    cwd: join(__dirname, ".."),
    shell: true,
    stdio: ["inherit", "pipe", "inherit"],
  });

  // Capture stdout to find the port
  serverProcess.stdout?.on("data", (data: Buffer) => {
    const output = data.toString();
    process.stdout.write(output);

    // Next.js outputs: "- Local:        http://localhost:XXXX"
    const match = output.match(/localhost:(\d+)/);
    if (match?.[1] && !existsSync(PORT_FILE)) {
      writeFileSync(PORT_FILE, match[1]);
      console.log(`[global-setup] Server port: ${match[1]}`);
    }
  });

  // Wait for port file to be written
  const port = await waitForPortFile();

  // Wait for server to be ready
  await waitForServer(port);
  console.log(`[global-setup] Server ready at http://localhost:${port}`);

  // Return teardown function
  return async () => {
    console.log("[global-setup] Stopping server...");
    if (serverProcess?.pid) {
      // On Windows, we need to kill the entire process tree
      // SIGTERM doesn't work well with shell: true
      if (process.platform === "win32") {
        try {
          execSync(`taskkill /pid ${serverProcess.pid} /T /F`, {
            stdio: "ignore",
          });
        } catch {
          // Process might already be dead
        }
      } else {
        serverProcess.kill("SIGTERM");
      }
      serverProcess = null;
    }
    if (existsSync(PORT_FILE)) {
      unlinkSync(PORT_FILE);
    }
  };
}
