import { existsSync } from "fs";
import { execSync } from "child_process";

if (!existsSync(".env.local")) {
  execSync("vercel env pull", { stdio: "inherit" });
}
