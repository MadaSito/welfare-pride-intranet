# Hostinger default Express entry — 2026-11-24

The operator's ZIP deployment log showed a successful frontend/server build and creation of `dist/hostinger-entry.js`, followed by `Entry file not found`. The same log declared `Entry file: server.js` and `Output directory: none`. The configured default filename was absent from the archive; this failure preceded application startup and was not caused by dependency warnings, TLS, SAML, or database settings.

The corrected package includes a root `server.js` and declares that entry in `package.json`. The root launcher dynamically imports the existing migration-aware built entry with no top-level await or static server import. It therefore follows the Node 22 LiteSpeed require-based loading contract already tested for the built wrapper. Existing installations pointing directly to `dist/hostinger-entry.js` remain supported. Build and start scripts, native/systemd behavior, Docker entrypoint, historical database migrations, and production secrets are unchanged.

Regression fixtures now cover root `server.js` through direct Node and CommonJS require, successful migration completion before server import, migration-failure denial, explicit migration-skip behavior, and bounded failure if build output is missing. The deployment guide explains both supported entry paths. The release archive must contain `server.js` and `package.json` directly at its root and must not include a real .env file, Git metadata, or installed dependencies.

No raw hosting logs, account-specific filesystem paths, database credentials, encryption keys, or Microsoft credentials are recorded here. Local validation is not proof of a successful operator-hosted deployment; the operator must upload the new archive or redeploy the updated original GitHub repository.

## Validation

TypeScript, all 110 tests across 30 files, the production build, and whitespace checks passed. Two finite smoke tests loaded the actual compiled application from root `server.js` through CommonJS `require()` and direct Node execution; both returned HTTP 200 for health and frontend HTML. Those smoke tests used no production database and skipped migrations only in their temporary local environment. Regression fixtures separately verified migration ordering and failure handling. Test processes and fixture directories were removed. No production configuration or remote hosting service was modified by the validation.
