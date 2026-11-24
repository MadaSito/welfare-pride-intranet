import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const wrapperSource = fileURLToPath(
  new URL("../scripts/hostinger-entry.mjs", import.meta.url),
);
const fixtureDirectories = new Set<string>();
const childTimeoutMs = 5_000;

function createFixture() {
  const directory = mkdtempSync(path.join(tmpdir(), "hostinger-entry-test-"));
  fixtureDirectories.add(directory);
  mkdirSync(path.join(directory, "dist"));
  mkdirSync(path.join(directory, "scripts"));
  writeFileSync(
    path.join(directory, "package.json"),
    JSON.stringify({ private: true, type: "module" }) + "\n",
  );
  copyFileSync(wrapperSource, path.join(directory, "dist", "hostinger-entry.js"));
  writeFileSync(
    path.join(directory, "scripts", "migrate.mjs"),
    `import { appendFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";
const record = (event) => appendFileSync(process.env.TEST_EVENT_LOG, event + "\\n");
process.once("exit", () => record("migration:exit"));
record("migration:start");
await setTimeout(40);
const exitCode = Number(process.env.TEST_MIGRATION_EXIT_CODE);
if (exitCode !== 0) {
  record("migration:failed");
  process.exit(exitCode);
}
record("migration:complete");
// Keep the child alive after its work to verify the wrapper waits for exit.
await setTimeout(20);
`,
  );
  writeFileSync(
    path.join(directory, "dist", "index.js"),
    `import { appendFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";
const record = (event) => appendFileSync(process.env.TEST_EVENT_LOG, event + "\\n");
record("server:import");
// This module must be dynamically imported, not synchronously required.
await setTimeout(20);
record("server:ready");
`,
  );
  return {
    directory,
    entry: path.join(directory, "dist", "hostinger-entry.js"),
    eventLog: path.join(directory, "events.log"),
  };
}

type LaunchMode = "LiteSpeed CommonJS require" | "direct Node launch";

function launch(
  mode: LaunchMode,
  options: { migrationSetting?: string; migrationExitCode?: number } = {},
) {
  const fixture = createFixture();
  // Deliberately do not inherit credentials, NODE_OPTIONS, or migration settings.
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "test",
    TEST_EVENT_LOG: fixture.eventLog,
    TEST_MIGRATION_EXIT_CODE: String(options.migrationExitCode ?? 0),
  };
  if (options.migrationSetting !== undefined) {
    env.RUN_MIGRATIONS_ON_START = options.migrationSetting;
  }
  const args =
    mode === "LiteSpeed CommonJS require"
      ? ["--input-type=commonjs", "-e", `require(${JSON.stringify(fixture.entry)});`]
      : [fixture.entry];
  const result = spawnSync(process.execPath, args, {
    // Starting outside the project root also checks wrapper-relative resolution.
    cwd: path.join(fixture.directory, "dist"),
    env,
    encoding: "utf8",
    timeout: childTimeoutMs,
    killSignal: "SIGKILL",
    maxBuffer: 64 * 1024,
  });
  const events = existsSync(fixture.eventLog)
    ? readFileSync(fixture.eventLog, "utf8").trim().split("\n")
    : [];
  return { result, events };
}

function expectSuccessfulLaunch(result: ReturnType<typeof launch>["result"]) {
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  expect(result.stderr).not.toContain("ERR_REQUIRE_ASYNC_MODULE");
  expect(result.status, result.stderr || result.stdout).toBe(0);
}

const migratedEvents = [
  "migration:start",
  "migration:complete",
  "migration:exit",
  "server:import",
  "server:ready",
];

afterEach(() => {
  for (const directory of fixtureDirectories) {
    rmSync(directory, { recursive: true, force: true });
    fixtureDirectories.delete(directory);
  }
});

describe.each<LaunchMode>(["LiteSpeed CommonJS require", "direct Node launch"])(
  "Hostinger entry compatibility: %s",
  (mode) => {
    it("runs migrations by default and waits for completion and exit before importing the async server", () => {
      const { result, events } = launch(mode);
      expectSuccessfulLaunch(result);
      expect(events).toEqual(migratedEvents);
    }, 10_000);

    it("exits nonzero without importing the server when migrations fail", () => {
      const { result, events } = launch(mode, { migrationExitCode: 23 });
      expect(result.error).toBeUndefined();
      expect(result.signal).toBeNull();
      expect(result.status).not.toBeNull();
      expect(result.status).not.toBe(0);
      expect(result.stderr).not.toContain("ERR_REQUIRE_ASYNC_MODULE");
      expect(events).toEqual([
        "migration:start",
        "migration:failed",
        "migration:exit",
      ]);
      expect(result.stderr).toMatch(/startup failed/i);
      expect(result.stderr.length).toBeLessThan(1_024);
    }, 10_000);

    it.each(["false", "FALSE"])(
      "skips migrations only for the explicit setting %j, while still importing the server",
      (migrationSetting) => {
        const { result, events } = launch(mode, {
          migrationSetting,
          // Any accidental migration execution must fail this case.
          migrationExitCode: 23,
        });
        expectSuccessfulLaunch(result);
        expect(events).toEqual(["server:import", "server:ready"]);
      },
      10_000,
    );

    it.each(["", "true", "0", "no", " false "])(
      "does not disable migrations for the non-explicit setting %j",
      (migrationSetting) => {
        const { result, events } = launch(mode, { migrationSetting });
        expectSuccessfulLaunch(result);
        expect(events).toEqual(migratedEvents);
      },
      10_000,
    );
  },
);
