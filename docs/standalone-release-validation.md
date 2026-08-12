# Welfare Pride Standalone Release Validation

**Validation date:** August 8, 2026  
**Target:** Hostinger managed Node.js or Hostinger VPS beside the existing WordPress site

The standalone release was validated after replacing managed-platform authentication, storage, scheduling, analytics, AI, asset, and deployment dependencies. No tenant credentials, cloud keys, employee records, or fabricated company content were introduced during validation.

| Validation gate | Result | Evidence |
| --- | --- | --- |
| TypeScript | Passed | `pnpm check` completed without errors |
| Unit and security tests | Passed | **33 tests across 12 Vitest files** |
| Production build | Passed | Vite and esbuild produced the frontend and Express server artifacts |
| Migration consistency | Passed | `pnpm exec drizzle-kit check` reported the migration history is consistent |
| Production dependencies | Passed | `pnpm audit --prod` reported **no known vulnerabilities** |
| Frozen install | Passed | `pnpm install --frozen-lockfile` completed with the committed lockfile |
| Production startup | Passed | The built Express 5 artifact listened on an isolated production port |
| Direct health endpoint | Passed | `GET /api/healthz` returned `{"ok":true}` |
| First-owner readiness | Passed | `auth.status` returned the expected setup-required state before a local owner exists |
| Protected API boundary | Passed | Dashboard pins and authenticated file routes returned HTTP `401` without a session |
| Header hardening | Passed | CSP, referrer policy, and content-type protections were present; `X-Powered-By` was absent |
| Proprietary reference scan | Passed | No prohibited hosted-platform names, URLs, service variables, plugins, or asset paths were found in the deliverable |
| Responsive first login | Passed | Desktop and mobile captures showed the local owner setup path and optional Entra controls without the former configuration dead end |
| Hostinger scripts | Passed | Bash and POSIX shell syntax checks completed; install help exposed managed, native, and Docker modes |
| Deployment assertions | Passed | Automated tests verified a non-root health-checked container, private app/database ports, independent secrets, and the isolated WordPress link plugin |

## Security tests added for this release

The test suite verifies one-time owner setup closure, normalized local login behavior, credential lockout accounting, employee-derived SharePoint search authorization, employee-derived dashboard pin ownership, delegated document reauthorization before pinning, twelve-item pin limits, permission-scoped assistant retrieval, no-model behavior when approved sources are absent, private AI endpoint rejection by default, and absence of committed platform-specific runtime dependencies.

## Deployment validation boundary

The production artifact and native Node startup path were executed in the sandbox. Docker Engine and a real Hostinger account were not available, so the Docker image was not built and no remote Hostinger deployment was performed. The Dockerfile, Compose topology, health checks, entrypoint, migration runner, installer, backup script, and WordPress plugin were validated statically and through automated tests. The final remote acceptance test must run on Welfare Pride’s Hostinger account with its real domain, database, storage, Entra, SharePoint, and AI settings.

## Required remote acceptance checks

After deploying, confirm TLS on the final intranet subdomain, create the first owner immediately before sharing the intranet URL, sign out and sign back in locally, configure Entra and SharePoint, test standard and administrator accounts, verify profile uploads survive a restart, test unified search with users holding different SharePoint permissions, run an AI question with and without an authorized HR source, execute one backup dry run, and confirm the cron dispatcher is authenticated.
