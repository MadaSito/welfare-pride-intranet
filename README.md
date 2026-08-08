# Welfare Pride Employee Intranet

Welfare Pride is a branded full-stack employee portal for Microsoft 365 identity, company communication, people discovery, SharePoint-authorized resources, and multi-cloud backup administration.

## Technology

The application uses React 19, TypeScript, Tailwind CSS 4, Wouter, tRPC 11, Express, Drizzle ORM, MySQL/TiDB, Microsoft Entra OIDC/OAuth 2.0 and SAML 2.0, Microsoft Graph, SharePoint, and S3-backed file storage. It is designed for the managed Autoscale runtime and does not depend on a permanently running local worker.

## Local validation

```bash
pnpm test
pnpm check
pnpm build
```

The final validation baseline is **15 passing tests across 6 Vitest files**, a clean TypeScript check, and a successful production build.

## Major modules

| Area | Included capabilities |
| --- | --- |
| Authentication | Branded OIDC, OAuth 2.0, SAML 2.0, silent Microsoft session reuse, secure application sessions |
| People | Employee self-service profile, administrator override, photo storage, directory search, organization chart |
| Company communication | Announcements, events, holiday and birthday calendars with birth-year privacy |
| Resources | Important Links, SharePoint-authorized HR repository, secure Technology embeds |
| Company pages | About Welfare Pride, founders, biographies, and milestone timeline |
| Administration | Encrypted integration settings, sanitized diagnostics, role-protected routes |
| Recovery | Multi-cloud connection tests, dry runs, retained manifests, checksum verification, restore validation, schedules, audit events |

## Documentation

| Document | Purpose |
| --- | --- |
| [`docs/architecture.md`](docs/architecture.md) | Trust boundaries, module architecture, and security decisions |
| [`docs/production-rollout-guide.md`](docs/production-rollout-guide.md) | Entra, SAML, Graph, SharePoint, cloud provider, and launch instructions |
| [`docs/api-coverage-matrix.md`](docs/api-coverage-matrix.md) | Typed API and persistence coverage by portal module |
| [`docs/quality-assurance-matrix.md`](docs/quality-assurance-matrix.md) | Route-level state, accessibility, and responsive QA evidence |
| [`docs/technology-embed-security.md`](docs/technology-embed-security.md) | Secure iframe and Content Security Policy guidance |
| [`docs/backup-audit-and-recovery.md`](docs/backup-audit-and-recovery.md) | Backup control plane, audit behavior, and recovery boundaries |
| [`todo.md`](todo.md) | Full implementation history and completion record |

## Production setup

Publish the final project checkpoint from the project interface, record the canonical HTTPS origin, and follow [`docs/production-rollout-guide.md`](docs/production-rollout-guide.md). External integrations remain unconfigured until an authorized Welfare Pride administrator enters the tenant and provider credentials through the encrypted Integration Settings and Backup Center interfaces.

SharePoint remains the authorization boundary for HR documents. The portal uses the signed-in employee’s delegated Microsoft token and does not recreate SharePoint ACLs in the application database.

## Brand system

All interface typography uses **Roboto**. The exact primary colors are Welfare Pride blue **`#5A92C9`** and orange **`#D58240`**. Approved logo assets are served from permanent project storage and are documented in [`docs/brand-assets.md`](docs/brand-assets.md).
