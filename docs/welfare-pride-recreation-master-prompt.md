# Welfare Pride Intranet — Recreation Master Prompt

## How to use this document

Copy the **Master Prompt** below into a capable engineering agent or use it as the governing specification for a development team. It is intentionally self-contained. Replace bracketed values only where an organization-specific domain, cloud tenant, provider, or deployment choice is required. The resulting application must be **standalone and self-hosted**: it must not rely on proprietary preview, identity, storage, scheduling, AI, analytics, or deployment services.

## Master Prompt

```text
You are a senior product engineer, security engineer, and design engineer. Build a production-ready, self-hosted employee intranet named “Welfare Pride.” The application is a private internal employee portal, not a marketing site, and it must run independently in a standard Node.js/Docker/Azure/VPS environment.

Your objective is to deliver a responsive, accessible, branded intranet that centralizes employee profiles, organizational information, internal content, Microsoft 365 and SharePoint resources, events, human-resources documents, backups, and administration. Use a clean, calm, professional employee-hub aesthetic with a persistent application shell, not a generic public landing page.

## Non-negotiable delivery constraints

1. The finished system must have no runtime dependency on proprietary preview, hosted-agent, managed identity, analytics, storage, scheduler, AI, or deployment platforms. It must run with ordinary Node.js, Docker, MySQL, object/file storage, a standard scheduler, and independently configured third-party providers.
2. Use React, TypeScript, Express, tRPC (or an equivalently typed server API layer), Drizzle ORM, and MySQL 8+. Use a clear, modular monorepo or application structure. Prefer React 19, Vite, Tailwind CSS, and accessible component primitives.
3. Use Roboto for every interface element. Use Welfare Pride blue #5A92C9 and orange #D58240 exactly. Do not approximate those values. Use the approved Welfare Pride logo assets supplied by the organization; bundle them with the application source or serve them from the organization’s own object storage.
4. Never hard-code secrets, tenant IDs, client secrets, storage keys, domains, API keys, or personal details. Use environment variables and administrator-managed encrypted configuration.
5. Do not fabricate reviews, testimonials, employee biographies, founder facts, company history, announcements, events, directories, or backup records. Use administrator-managed content states and clear empty states until real data is configured.
6. Ship database migrations, tests, environment templates, Docker assets, operator documentation, health checks, and reproducible deployment workflows.

## Product identity and visual direction

Build a Welfare Pride experience that feels like a warm, secure, connected workplace rather than a generic SaaS dashboard. Use a light interface with white content surfaces, restrained shadows, generous whitespace, subtle rounded corners, a stable blue sidebar, orange for selective calls to action and status emphasis, and brand-logo presence in the authentication view, sidebar, and footer. Typography must be legible, high contrast, and scaled for internal work rather than marketing drama.

Use a persistent desktop sidebar with a compact mobile navigation pattern, a global top navigation bar, page title/breadcrumb area, consistent footer, keyboard-visible focus states, semantic landmarks, reduced-motion support, and responsive layouts at mobile, tablet, and desktop widths. Avoid fake activity, fake employee photos, fake metrics, and generic customer-style testimonials.

## Required user roles and security model

Implement `user` and `admin` roles. Server-side authorization is mandatory: hiding a user-interface element is never authorization. Every administrator endpoint and route must verify the authenticated user’s role.

Implement a practical first deployment experience:

- If there is no local owner account, show a one-time “Create owner account” form. It must collect full name, email, and a strong password, create exactly one owner-administrator atomically, establish a session, and close setup permanently after success.
- Do not require a bootstrap token for that first-owner flow. Warn operators to create the owner account immediately before sharing the URL.
- After setup closes, show local sign-in and optional Microsoft enterprise sign-in.
- Hash passwords with a strong memory-hard algorithm such as Argon2id or scrypt, use rate limiting and lockout after repeated failed attempts, and store revocable, server-managed database sessions in secure HTTP-only cookies.
- Set `Secure`, `HttpOnly`, appropriate `SameSite`, explicit max-age, proxy-aware cookie behavior, and 12-hour maximum session age for Microsoft OIDC and SAML sessions.
- Keep Microsoft Entra OIDC, OAuth 2.0, SAML 2.0, and optional silent sign-in available but unconfigured until an administrator enters the organization’s settings.
- For SAML, validate signed assertions, issuer, audience, recipient, InResponseTo correlation, expiration, and tenant identity. Store request correlation durably so multiple instances are safe.
- For OIDC, use Authorization Code + PKCE, state, nonce, secure callback validation, refresh token handling only on the server, and encrypted delegated Microsoft tokens.

## Full feature inventory

### 1. Branded application shell and dashboard

Create a responsive dashboard shell with the Welfare Pride logo, exact blue/orange color system, Roboto, desktop sidebar, mobile navigation, page headers, global search, user menu, footer, and clear navigation escape routes. The authenticated dashboard must show a welcome section, informational cards, organization-configured highlights, personalized pinned HR resources, and personalized pinned upcoming events. Include empty states, unavailable-item notices, and one-click unpin controls.

### 2. Authentication and account management

Provide tokenless one-time local owner setup, local administrator login, logout, server-managed sessions, account lockout after five failed attempts, and an MFA-ready account data model. Support optional Microsoft Entra ID OIDC, OAuth 2.0, SAML 2.0, and silent work-session sign-in. Explain configuration state clearly on the sign-in screen: enterprise buttons must be disabled or unavailable until an administrator has configured the applicable provider, while the local owner account remains usable.

### 3. Administrator integration settings

Create an administrator-only Integration Settings workspace. It must store public settings and encrypted secret settings separately for Microsoft Entra, Microsoft Graph, SharePoint, optional AI providers, file/object storage, and backup destinations. Administrators must be able to save Tenant ID, Client ID, encrypted Client Secret, OIDC values, SAML endpoints and certificates, SharePoint site URLs, Graph scopes, storage configuration, and cloud credentials.

Implement sanitized “Test Connection” diagnostics for Microsoft Graph, SharePoint REST/Graph document access, AI providers, and backup destinations. Never return persisted secret values to the browser after save. Record timestamped diagnostic outcomes without embedding credentials or sensitive response bodies.

### 4. Employee profiles and directory

Build a searchable employee directory and individual profile experience. Employees can update their own bio, phone number, and profile photo. Administrators can edit any employee’s profile. Persist portal-owned overrides locally while using Microsoft Graph as the directory and organizational source of truth when configured.

Use secure photo upload limits, MIME validation, authenticated same-origin delivery, persistent file storage, and a default placeholder state. Create live Graph synchronization with a clearly labeled cached fallback state if Graph is not configured or unavailable.

### 5. Organization chart

Render a searchable, navigable organizational chart sourced from Microsoft Graph manager/direct-report data. Support zoom, pan, keyboard-friendly search, employee detail cards, manager and direct-report hierarchy, and graceful unconfigured/error/cached data states. Do not reimplement the organization’s Microsoft identity permissions in the browser.

### 6. Calendars, announcements, and events

Build the following content experiences:

- A SharePoint-synchronized holiday calendar with month navigation and holiday details.
- A birthday calendar that displays month and day only. Birth years must never be stored in a response, rendered, logged, or inferred by the client.
- An announcement workspace with published, draft, archive, list, detail, validation, and administrator create/edit/publish/archive controls.
- An events workspace with month-grid calendar, list view, categories, event details, cancellation state, administrator create/edit/publish controls, and event pin/unpin controls.

All content modules must have loading, empty, validation, unconfigured, unauthorized, error, and success states appropriate to the route.

### 7. SharePoint-authorized HR document repository

Create a Human Resources document repository that browses and searches SharePoint documents using the signed-in employee’s delegated Microsoft permissions. The app must not duplicate or bypass SharePoint document authorization. It may display document metadata, filters, summaries, and deep links, but opening documents must preserve SharePoint authorization.

Employees can pin up to 12 HR resources. At dashboard render time, reauthorize each pinned SharePoint document before showing it. If the document no longer exists or is no longer authorized, show an unavailable state without exposing metadata or links.

### 8. Global search

Place an accessible global search bar in the persistent top navigation. Search active employees, currently published announcements, and only HR documents that the current signed-in employee is authorized to see in SharePoint. Group results by People, Announcements, and HR Documents. Support keyboard navigation, loading state, empty state, bounded server-side queries, and deep links that open the selected employee profile or announcement detail.

### 9. Important Links and company content

Create a categorized Important Links hub for Email, Microsoft 365 applications, corporate calendar, and administrator-configured internal/external resources. Make default initialization idempotent and database-constrained so concurrent first loads do not create duplicates.

Create administrator-managed About Welfare Pride content blocks, company-founder biography templates, photo fields, milestone timelines, and reusable branded layouts. Do not seed organizational facts. Include clear administrator empty states until content is added.

### 10. Secure Technology workspace

Build a Technology page for administrator-managed web application embeds. Enforce HTTPS, domain allowlisting, public-host validation, private-network/loopback rejection, sandboxed iframes, and a Content Security Policy that permits only configured, approved frame origins. Show setup guidance when no allowed application is configured. Document framing limitations caused by third-party `X-Frame-Options` or CSP.

### 11. Personalized dashboard pins

Persist dashboard pins by owner user ID with database uniqueness constraints. Employees must only read and mutate their own pins. Support a maximum of 12 pinned HR resources and 12 pinned upcoming events per employee. Validate that event pins refer to a current, published, upcoming event and reauthorize HR resources through SharePoint before display.

### 12. Permission-aware AI assistant

Implement a branded assistant drawer or panel. It must use a provider-neutral OpenAI-compatible endpoint, model, and encrypted API-key configuration. An administrator can test the configured provider without exposing the key.

The assistant may ground answers only in approved published company content, published announcements, and SharePoint HR documents authorized for the current signed-in user. Retrieve only bounded excerpts, reject unauthorized/unavailable documents, return source citations and links, limit conversation history, include privacy guidance, and decline to answer when no authorized source supports an answer. Protect provider configuration against SSRF: require HTTPS by default, validate hostnames, reject private, loopback, link-local, and metadata-service destinations unless an explicit local-development override is enabled.

### 13. Multi-cloud backup center

Create an administrator-only Backup Center that manages connection settings and operations for SharePoint, OneDrive, Google Drive, AWS S3, Wasabi, Backblaze B2, and Azure Blob Storage. Include destination configuration, sanitized connection tests, dry-run/test-backup actions, backup run status, retention/manifests, checksums, restore requests, restore verification, and run history.

Use provider adapters with explicit public and secret configuration fields. Store credentials encrypted at rest. Implement a guarded restore flow with confirmation and administrator authorization. Record append-only application audit events for backup and restore state transitions. Keep mutable execution state separate from audit history. If the selected database does not support database triggers, state honestly that application-layer append-only behavior is enforced by controlled data-access paths; do not claim immutable database-trigger enforcement where it is unavailable.

### 14. Scheduling

Implement a portable authenticated backup dispatcher endpoint, such as `POST /api/cron/dispatch`, protected by a separate `CRON_SECRET`. Store five-field UTC cron expressions in the database with validation, dispatch state, and idempotency protection. Support Docker/VPS scheduler services, external cron, Azure Container Apps scheduled jobs, or a comparable scheduler. Never depend on a platform-specific heartbeat service.

### 15. Operational hardening and accessibility

Add production security headers and a restrictive Content Security Policy, preserve explicit allowed Technology iframe origins, suppress framework disclosure headers, offer a no-auth `/api/healthz` endpoint, and configure trusted-proxy behavior for reverse proxies. Add visible focus rings, semantic headings and landmarks, labels, descriptive buttons, keyboard navigation, and a global `prefers-reduced-motion` fallback.

## Data architecture

Use MySQL migrations and a schema-first workflow. Include tables for users, local credentials, revocable sessions, encrypted Microsoft delegated sessions, durable SAML request correlations, employee profile overrides, announcements, events, holidays, Important Links, company content blocks, founders, milestones, Technology embeds, integration settings, diagnostics, backup destinations, backup runs, restore runs, append-only audit events, and dashboard pins.

Store dates/times in UTC at the persistence/API layer and render them in the user’s local time zone. Use foreign keys, unique constraints, indexes, ownership checks, and idempotent insert patterns where applicable. Keep SharePoint documents and Entra directory objects external rather than copying their permission model into the application database.

## Storage and file delivery

Provide a local persistent volume driver and an S3-compatible object storage driver. Validate paths to prevent traversal. Return authenticated same-origin file routes where appropriate. Do not use ephemeral container filesystems for production uploads. If deploying to Azure Container Apps without an Azure Blob adapter, use an Azure Files mount with the local persistent-volume driver; do not pretend that Azure Blob is automatically S3-compatible.

## Self-hosted deployment requirements

The codebase must be deployable through all of the following paths:

1. Docker Compose on a Linux VPS with application, MySQL, scheduler, persistent uploads volume, reverse proxy, HTTPS, health checks, and restart policies.
2. Standalone Docker container connected to an external MySQL database and persistent volume/object storage.
3. Native Node.js 22 service on a Linux VPS with systemd, MySQL, environment file permissions, and Nginx or Caddy TLS reverse proxy.
4. Azure Container Apps using Azure Container Registry, user-assigned managed identity for image pull, Azure Database for MySQL over verified TLS, Azure Files mount or supported S3-compatible storage, Key Vault-backed secrets, a one-off migration job, managed ingress, custom domain, health checks, and a scheduled job that calls the authenticated cron dispatcher.

Ship these files:

- `.env.example` or `environment.template` with no real secrets.
- A multi-stage production Dockerfile.
- A Docker Compose stack for one-server deployment.
- Container entrypoint and health-check scripts.
- A portable migration script invoked before production rollout or through a one-off migration job.
- A Docker/VPS installer supporting `docker`, `native`, and `managed` modes.
- A WordPress companion plugin that only adds a configurable intranet link/button. Do not convert the intranet into a WordPress plugin or iframe.
- Operator docs for Azure, Docker, VPS, Microsoft Entra, SharePoint, security, backup, recovery, and capacity.

For a starting deployment of approximately 25 named staff and 5–10 concurrent active users, document 0.5 vCPU/1 GiB RAM and 1–2 web replicas, a 2-vCPU/4-GiB MySQL baseline, and a Docker/VPS baseline of 2 vCPU, 4 GiB RAM, and 60 GiB SSD. Explain that bulk backup/restore volume and document extraction are the scaling drivers, not ordinary portal browsing.

## Required tests and validation

Write and run focused unit tests for password hashing, first-owner closure, session/logout behavior, administrator authorization, credential encryption/redaction, birthday privacy, Technology embed validation, AI endpoint SSRF protections, AI retrieval isolation, SharePoint search identity scoping, dashboard-pin ownership and limits, backup checksum/authorization controls, Azure TLS connection configuration, and deployment portability checks.

The final validation gate must pass:

- TypeScript check.
- Full Vitest suite.
- Production frontend/server build.
- Production dependency vulnerability audit with no known production vulnerabilities.
- Migration consistency check.
- Shell syntax checks for installer, entrypoint, and backup scripts.
- Git diff whitespace check.
- A source/deployment scan proving no proprietary-platform runtime URLs, APIs, environment variables, plugins, hosted storage paths, or analytics hooks remain.
- Desktop, tablet, and mobile visual checks for sign-in, shell, search, directory, calendars, HR repository, Technology workspace, backup center, and admin settings.
- A production artifact smoke test for health, first-owner readiness, security headers, static delivery, and protected API denial.

## Final acceptance criteria

Do not declare the project complete until all of the following are true:

1. A new self-hosted deployment can create exactly one local owner without a token and use that owner to configure enterprise services later.
2. Each employee can access only their own profile edits and dashboard pins.
3. Administrator-only routes and mutations are enforced on the server.
4. No birth year is exposed by any birthday API or UI.
5. SharePoint remains the permission authority for HR documents in browsing, search, dashboard pins, and AI retrieval.
6. Secret values are encrypted at rest and never echoed to the browser after persistence.
7. The AI assistant provides source citations and does not retrieve another employee’s unauthorized document content.
8. Backup and restore actions are guarded, validated, auditable, and use real provider diagnostics/dry runs rather than fictional success data.
9. The application can run on Docker, a Linux VPS, and Azure Container Apps without any proprietary runtime dependency.
10. The completed source repository includes documentation, migrations, tests, deployment files, a health endpoint, and an operator-ready deployment runbook.
```

## Categorized checklist for reuse

| Category | Included capabilities |
| --- | --- |
| **Brand and experience** | Welfare Pride logo system, exact `#5A92C9` blue, exact `#D58240` orange, Roboto, responsive shell, sidebar, mobile navigation, global search, footer, accessibility, reduced motion |
| **Authentication** | One-time tokenless local owner setup, local login, lockout, secure revocable sessions, OIDC, OAuth 2.0, SAML 2.0, silent work-session sign-in, PKCE, SAML correlation |
| **People** | Employee directory, self-service profile edit, admin profile override, photo upload, Microsoft Graph synchronization, live organization chart |
| **Content and calendars** | Holidays, birth-year-free birthdays, announcements, events, month views, categories, publishing and archive controls |
| **HR and search** | Delegated SharePoint HR repository, permission-preserving document open, global search across people/announcements/authorized documents |
| **Company information** | Important Links, About content blocks, founder profiles, milestone timeline, administrator-managed content and empty states |
| **Technology** | HTTPS-only, allowlisted, sandboxed iframe workspace and CSP guidance |
| **Personalization** | Per-user pinned HR resources and upcoming events, ownership checks, 12-item caps, reauthorization and unavailable states |
| **AI** | Provider-neutral OpenAI-compatible configuration, encrypted key, secure test, cited answers, approved-content and delegated-SharePoint retrieval, SSRF protection |
| **Backup administration** | Multi-cloud destinations, diagnostics, dry runs, checksums, manifests, restore confirmation/verification, append-only audit stream, portable scheduler |
| **Administration** | Encrypted integration settings, sanitized diagnostics, role-protected settings, backup, restore, and content management |
| **Data and operations** | MySQL migrations, UTC timestamps, health endpoint, security headers, TLS support, Docker, Docker Compose, VPS systemd, Azure Container Apps, Azure Files, ACR, Key Vault, Container Apps Jobs |
| **Quality gates** | Unit tests, TypeScript, build, production dependency audit, migration check, shell syntax, source dependency scan, responsive visual checks, production smoke test |

> **Implementation principle:** Build the security boundaries and data model before polishing UI. Integrations must degrade gracefully when unconfigured, while the local owner account remains available to complete secure setup.
