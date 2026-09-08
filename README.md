# Welfare Pride Employee Intranet

Welfare Pride is a standalone, self-hosted employee intranet built with React, Express, tRPC, Drizzle ORM, and MySQL. It is designed to run on a protected Hostinger subdomain beside an existing WordPress site, without requiring WordPress or a proprietary application platform at runtime.

## Core capabilities

The portal includes local-first access with forced bootstrap-password rotation and TOTP MFA, optional Microsoft Entra OIDC and SAML sign-in, employee profiles, a live organizational chart, announcements, events, holidays, birthdays without birth years, SharePoint-authorized HR documents, company pages, secure Technology embeds, multi-cloud backup administration, employee dashboard pins, unified search, and a provider-neutral cited AI assistant.

| Boundary | Implementation |
| --- | --- |
| Authentication | Revocable HTTP-only database sessions; forced first-login password change; TOTP MFA and recovery codes; optional Entra OIDC and SAML |
| Authorization | Typed protected and administrator procedures; SharePoint remains the HR document permission authority |
| Secrets | AES-256-GCM encryption using `JWT_SECRET`; plaintext saved secrets are never returned to the browser |
| Storage | S3-compatible object storage or a persistent local VPS volume |
| Scheduling | Authenticated cron dispatcher for Hostinger cron or the included VPS scheduler |
| AI | Configurable OpenAI-compatible endpoint; published-content grounding; delegated SharePoint retrieval; cited answers |

## Local development

Copy `deploy/hostinger/environment.template` to a local `.env`, replace all placeholder values, and run:

```bash
corepack enable
pnpm install
pnpm db:migrate
pnpm dev
```

Set `DATABASE_URL` and `JWT_SECRET` before opening the application. For a controlled fresh-install bootstrap, set `BOOTSTRAP_DEFAULT_ADMIN=true`; the temporary `admin` / `admin` account must change its password and enroll MFA before it can access the portal. Development defaults to local file storage under `data/uploads`.

## Production

Read [`docs/standalone-deployment-guide.md`](docs/standalone-deployment-guide.md) or its [PDF version](docs/standalone-deployment-guide.pdf) for the current Docker, Linux VPS, bootstrap-account, local MFA, Azure-ready MySQL TLS, scheduling, and operations instructions. The included installer supports:

```bash
deploy/install.sh --mode docker --domain intranet.example.org
deploy/install.sh --mode native --database-url 'mysql://user:password@127.0.0.1:3306/welfare_pride'
deploy/install.sh --mode managed --database-url 'mysql://user:password@host:3306/welfare_pride'
```

## Validation

```bash
pnpm check
pnpm test
pnpm build
```

Database schema changes must be generated with `pnpm db:generate`, reviewed in `drizzle/`, and applied with `pnpm db:migrate`.

## Documentation

| Document | Purpose |
| --- | --- |
| [`docs/hostinger-deployment.md`](docs/hostinger-deployment.md) | Self-hosting, WordPress connection, and first login |
| [`docs/standalone-deployment-guide.md`](docs/standalone-deployment-guide.md) | Current Docker, bare-metal VPS, local MFA, bootstrap, scheduling, and operations guide |
| [`docs/standalone-deployment-guide.pdf`](docs/standalone-deployment-guide.pdf) | Print-ready PDF version of the standalone deployment guide |
| [`docs/azure-docker-vps-deployment-runbook.md`](docs/azure-docker-vps-deployment-runbook.md) | Azure Container Apps, Docker, Linux VPS, capacity, and release procedures |
| [`docs/standalone-release-validation.md`](docs/standalone-release-validation.md) | Test, build, audit, production-smoke, and deployment validation evidence |
| [`docs/portable-architecture.md`](docs/portable-architecture.md) | Runtime and security architecture |
| [`docs/production-rollout-guide.md`](docs/production-rollout-guide.md) | Microsoft Entra, Graph, SharePoint, and cloud setup |
| [`docs/technology-embed-security.md`](docs/technology-embed-security.md) | Secure iframe allowlisting and CSP guidance |
| [`docs/backup-audit-and-recovery.md`](docs/backup-audit-and-recovery.md) | Backup and restore controls |
| [`docs/access-control-administration.md`](docs/access-control-administration.md) | Restricted pages, Business Management access, Entra group mappings, and local-user fallback |
| [`docs/security-review-2026-09-08.md`](docs/security-review-2026-09-08.md) | Defensive review findings, verified remediation, residual risks, and operator actions |
| [`project-context/`](project-context/) | Git-backed architecture and reconstruction context |
| [`session-worklogs/`](session-worklogs/) | Git-backed sanitized implementation and release worklogs |

## Brand system

All interface typography uses **Roboto**. The exact primary colors are Welfare Pride blue **`#5A92C9`** and orange **`#D58240`**. Approved logo assets are bundled in the source tree.
