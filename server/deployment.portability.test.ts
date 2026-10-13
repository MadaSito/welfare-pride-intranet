import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), "utf8");

function sourceFiles(relativeDirectory: string): string[] {
  const absolute = path.join(root, relativeDirectory);
  return readdirSync(absolute).flatMap(entry => {
    const child = path.join(absolute, entry);
    const relative = path.relative(root, child);
    return statSync(child).isDirectory() ? sourceFiles(relative) : [relative];
  });
}

describe("standalone deployment package", () => {
  it("contains no proprietary managed-platform identifiers in active source or deployment assets", () => {
    const files = ["package.json", "vite.config.ts", "README.md", ...sourceFiles("client/src"), ...sourceFiles("server").filter(file => !file.endsWith(".test.ts")), ...sourceFiles("shared"), ...sourceFiles("deploy")];
    const platformName = ["ma", "nus"].join("");
    const prohibited = new RegExp([
      ["built", "in", "forge"].join("_"),
      ["vite", "oauth", "portal"].join("_"),
      `/${platformName}-storage`,
      `${platformName}\\.space`,
      `vite-plugin-${platformName}`,
      `\\b${platformName}\\b`,
    ].join("|"), "i");
    for (const file of files) expect(read(file), file).not.toMatch(prohibited);
  });

  it("packages a non-root health-checked container with private application and database ports", () => {
    const dockerfile = read("deploy/hostinger/Dockerfile");
    const compose = read("deploy/hostinger/docker-compose.yml");
    const entrypoint = read("deploy/hostinger/entrypoint.sh");
    expect(dockerfile).toContain("USER node");
    expect(dockerfile).toContain("HEALTHCHECK");
    expect(dockerfile).toContain("/app/scripts ./scripts");
    expect(entrypoint).toContain("node scripts/migrate.mjs");
    expect(compose).toContain("condition: service_healthy");
    expect(compose).toContain('"80:80"');
    expect(compose).toContain('"443:443"');
    expect(compose).not.toContain('"3306:3306"');
    expect(compose).not.toContain('"3000:3000"');
  });

  it("documents independent bootstrap, session, cron, and database secrets without committing values", () => {
    const template = read("deploy/hostinger/environment.template");
    for (const key of ["DATABASE_URL", "JWT_SECRET", "CRON_SECRET", "BOOTSTRAP_DEFAULT_ADMIN"]) expect(template).toContain(`${key}=`);
    expect(template).toContain("replace-with-");
    expect(template).not.toMatch(/[A-Fa-f0-9]{64}/);
  });

  it("provides managed, native, and Docker installation modes plus an isolated WordPress link plugin", () => {
    const installer = read("deploy/hostinger/install.sh");
    const plugin = read("deploy/wordpress/welfare-pride-intranet-link/welfare-pride-intranet-link.php");
    for (const mode of ["docker)", "native)", "managed)"]) expect(installer).toContain(mode);
    expect(plugin).toContain("manage_options");
    expect(plugin).toContain("esc_url");
    expect(plugin).toContain("noopener noreferrer");
    expect(plugin).toContain("'default' => ''");
    expect(plugin).toContain("https://intranet.example.org");
  });

  it("includes a generic installer, local MFA controls, and Git-backed operator context", () => {
    expect(read("deploy/install.sh")).toContain("hostinger/install.sh");
    expect(read("server/routers/localAuth.ts")).toContain("setMfaRequirement");
    expect(read("client/src/pages/AdminSettings.tsx")).toContain("Local authentication and MFA");
    expect(read("project-context/README.md")).toContain("reconstruction context");
    expect(read("session-worklogs/README.md")).toMatch(/sanitized/i);
    expect(statSync(path.join(root, "docs/standalone-deployment-guide.pdf")).size).toBeGreaterThan(10_000);
    expect(read("docs/standalone-deployment-guide.md")).toContain("BOOTSTRAP_DEFAULT_ADMIN");
  });

  it("pins the verified pnpm integrity metadata required by production Corepack builds", () => {
    const packageJson = JSON.parse(read("package.json")) as { packageManager?: string };
    expect(packageJson.packageManager).toBe("pnpm@10.4.1+sha512.c753b6c3ad7afa13af388fa6d808035a008e30ea9993f58c6663e2bc5ff21679aa834db094987129aa4d488b86df57f7b634981b2f827cdcacc698cc0cfb88af");
  });

  it("stages a migration-aware Hostinger entry file inside the managed output directory", () => {
    const packageJson = JSON.parse(read("package.json")) as { scripts?: Record<string, string> };
    const hostingerEntry = read("scripts/hostinger-entry.mjs");
    const stagingScript = read("scripts/stage-hostinger-entry.mjs");
    const guide = read("docs/hostinger-deployment.md");

    expect(packageJson.scripts?.build).toContain("stage-hostinger-entry.mjs");
    expect(hostingerEntry).toContain('"scripts/migrate.mjs"');
    expect(hostingerEntry).toContain('await import("./index.js")');
    expect(stagingScript).toContain('"hostinger-entry.js"');
    expect(guide).toContain("| Entry file | `dist/hostinger-entry.js` |");
  });
});
