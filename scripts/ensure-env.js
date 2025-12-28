import { existsSync } from "fs";
import { execSync } from "child_process";

// Skip in CI - env vars are injected differently there
if (process.env.CI) {
  process.exit(0);
}

if (!existsSync(".env.local")) {
  try {
    execSync("vercel env pull", { stdio: "inherit" });
  } catch {
    console.error(
      "\nFailed to pull environment variables from Vercel.\n" +
        "To set up your local environment:\n" +
        "  1. Install Vercel CLI: npm install -g vercel\n" +
        "  2. Log in: vercel login\n" +
        "  3. Link project: vercel link\n" +
        "  4. Re-run: npm run dev\n\n" +
        "Or manually create .env.local with required variables.\n"
    );
    process.exit(1);
  }
}
