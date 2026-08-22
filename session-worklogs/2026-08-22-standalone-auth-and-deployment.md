# 2026-08-22: Standalone Authentication and Deployment Hardening

## Objective

Finalize a portable Welfare Pride release that does not depend on a managed development runtime, supports local-first access with configurable MFA, provides automated Docker and Linux VPS installation paths, and preserves reconstruction context in Git.

## Decisions recorded

| Area | Decision |
| --- | --- |
| Runtime independence | Removed managed-development metadata and historical dependency-audit material from the standalone package, retained only platform-neutral code and documentation, and added a clean-source scan. |
| Bootstrap access | A fresh install may set `BOOTSTRAP_DEFAULT_ADMIN=true` to create only one temporary `admin` / `admin` local account. The account must change its password and enroll TOTP MFA before it can access protected procedures. |
| Local MFA | TOTP secrets and recovery codes are encrypted at rest. MFA enrollment, code verification, recovery-code consumption, and administrator MFA-policy controls are server-side typed procedures. |
| Installer | `deploy/install.sh` delegates to the Docker, native Linux, or managed Node installer. It generates or consumes a root-readable `.env` file and communicates the mandatory credential rotation process. |
| Documentation | The repository root now contains `project-context/` and `session-worklogs/` so the reconstruction context and sanitized release history are easy to find and committed with the source. |

## Validation state

The release completed TypeScript validation, production build, migration-history consistency checks, production dependency audit, source portability scan, PDF verification, and 45 automated tests. Tests cover local TOTP enrollment primitives, recovery-code format, restricted-session server-side enforcement, local-auth flows, administrator MFA-policy procedures, deployment packaging, and the Git-backed context/worklog structure. The built application returned the expected health response, CSP header, and unauthenticated protected-route denial during an isolated production smoke test.

Installer syntax and help output were validated. Container and native service end-to-end installation require a Docker-capable or root-enabled target host; the local validation environment did not provide Docker or root service management, so those target-host acceptance checks remain an operator responsibility.

## Security reminders

The temporary bootstrap credentials are intentionally predictable only for initial physical or operational access to a newly provisioned database. Operators must use HTTPS, restrict server administration, change the password at the first prompt, complete MFA enrollment, and rotate production environment credentials before rollout. No secrets, raw conversation content, or session records are included in this worklog.
