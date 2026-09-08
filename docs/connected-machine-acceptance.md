# Connected-Machine Acceptance Verification

**Date:** 2026-09-08  
**Scope:** Isolated standalone release acceptance test on an attached Ubuntu host.

## Isolation and safety boundaries

The validation used a separate Docker Compose project, named `welfare-pride-intranet-acceptance`, and a loopback-only application binding on `127.0.0.1:3113`. It did not change the host firewall, public DNS, Caddy configuration, public ports, or the pre-existing Welfare Pride reporting portal containers. A temporary internal TLS proxy bound only to `127.0.0.1:3115` was used solely to validate secure browser session behavior.

## Verified outcomes

| Area | Evidence | Result |
| --- | --- | --- |
| Docker installer | Fresh Compose install built the application image, initialized MySQL, applied migrations, and started healthy app, database, and scheduler containers. | Passed |
| Native installer and service | The root native installer completed dependency installation, production build, migrations, and a temporary `systemd` service start against a separate isolated MySQL database. | Passed |
| Native runtime | The temporary native service returned `{"ok":true}` from `/api/healthz` on test port `3114`. | Passed |
| Bootstrap account | A fresh-install-only `admin` / `admin` account was created, returned a password-change-required state, and was blocked from protected procedures. | Passed |
| Credential rotation | A strong replacement password transitioned the local session to TOTP enrollment; the original `admin` password was rejected after restart. | Passed |
| Local MFA | Docker and native service acceptance both completed TOTP enrollment with locally generated time-based codes; recovery codes were returned only to the active session and never retained in the evidence record. | Passed |
| MFA policy UI | Secure browser login reached **Integration Settings → Local access** and toggled the administrator MFA requirement from optional back to required. | Passed |
| Security boundary | Health endpoint, CSP response header, absence of `X-Powered-By`, and forbidden unauthenticated access to the MFA-policy endpoint were verified. | Passed |
| Git-backed operator records | `project-context/`, `session-worklogs/`, and this acceptance record are present in the repository for remote synchronization with the source. | Passed |

## Operational note

This was an acceptance deployment only. Its temporary containers, MySQL data, browser-test files, locally generated certificates, native unit, test workspaces, and test credentials were removed after validation. Production deployments must use unique administrator credentials, secrets, TLS certificates, and a persistent storage strategy as documented in `docs/standalone-deployment-guide.md`.

## Post-acceptance release gate

After acceptance cleanup, the standalone source passed 46 automated tests, TypeScript validation, a production build, Drizzle migration consistency validation, and a production dependency audit with no known vulnerabilities. A production-equivalent Node 22.22 container also resolved the pinned Corepack `pnpm` declaration successfully after its integrity metadata was corrected. The source-package scan found no proprietary runtime names, managed URLs, injected service variables, or hosted asset paths in the deliverable source tree.
