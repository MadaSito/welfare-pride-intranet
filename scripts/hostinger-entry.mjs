import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function runMigrations() {
  if (process.env.RUN_MIGRATIONS_ON_START?.toLowerCase() === "false") {
    console.log("[Hostinger] Database migrations are disabled for this start.");
    return;
  }

  console.log("[Hostinger] Applying Welfare Pride database migrations...");
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/migrate.mjs"], {
      cwd: projectRoot,
      env: process.env,
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Database migration process ended with ${signal ? `signal ${signal}` : `exit code ${code}`}.`));
    });
  });
}

await runMigrations();
await import("./index.js");
