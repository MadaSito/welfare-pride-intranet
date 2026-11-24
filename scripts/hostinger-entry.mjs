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

// LiteSpeed's Node launcher loads this entry with require(). Keep its static
// module graph synchronous; defer migrations and the ESM server to this task.
async function start() {
  await runMigrations();
  await import("./index.js");
}

start().catch(() => {
  // The migration child already emits its diagnostic. Never dump credentials
  // or an arbitrary error object into a public-facing startup message.
  console.error("[Hostinger] Startup failed. Check the preceding runtime error; the server was not launched.");
  process.exit(1);
});
