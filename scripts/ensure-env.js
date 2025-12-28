import { existsSync } from "fs";
import { execSync } from "child_process";

// Skip in CI - env vars are injected differently there
if (process.env.CI) {
  process.exit(0);
}

if (!existsSync(".env.local")) {
  execSync("vercel env pull", { stdio: "inherit" });
}
