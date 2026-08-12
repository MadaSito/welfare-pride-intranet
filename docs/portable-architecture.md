# Welfare Pride Standalone Architecture

## Objective

The production application runs without any proprietary managed service, domain, credential, connector, SDK, runtime plugin, storage route, scheduler, analytics script, or authentication provider. WordPress remains the public-facing site. The intranet runs as an independent, access-controlled Node.js application on `intranet.<welfare-pride-domain>`.

## Runtime topology

| Component | Portable implementation | Hostinger managed Node | Hostinger VPS |
| --- | --- | --- | --- |
| Web application | React frontend served by Express/tRPC | One Node.js Web App website | Docker container or Node service |
| Database | Standard MySQL 8-compatible schema through Drizzle | Hostinger MySQL via `DATABASE_URL` | MySQL container or managed MySQL |
| Session store | Random opaque session token; SHA-256 token hash stored in MySQL | Same | Same |
| Initial access | One-time local administrator creation, then local credentials | Sign in page | Same |
| Enterprise identity | Optional Microsoft Entra OIDC and SAML | Same | Same |
| File storage | S3-compatible adapter; local filesystem only for development | S3/Wasabi/Backblaze/AWS | S3-compatible or mounted volume |
| Scheduled work | Database schedule definitions and a secret-protected dispatch endpoint | Hostinger UTC cron calls endpoint each minute | system cron calls endpoint each minute |
| AI assistant | OpenAI-compatible HTTPS API configured by administrator | External provider | External or self-hosted compatible provider |
| WordPress connection | Menu link or protected button to the intranet subdomain | Main WordPress site remains unchanged | Main WordPress site remains unchanged |

## Authentication model

### First administrator setup

When no local credential exists, the sign-in page displays **Set up owner account**. The administrator enters a name, email address, and strong password. The server creates the first administrator, stores a scrypt password hash with a unique salt, immediately invalidates the setup route by the existence of that credential, and starts a portable application session. This first-owner account should be created immediately after deployment and before the intranet URL is shared.

This removes the deadlock shown in the published screenshot: Microsoft Entra can be configured only after login, but login no longer depends on Microsoft Entra.

### Local login

Local administrator login uses email and password, rate limiting, generic failure messages, secure HTTP-only SameSite cookies, database-backed revocable sessions, and a twelve-hour default session. The data model includes optional TOTP and recovery-code fields so MFA can be enabled without changing the authentication schema.

### Microsoft enterprise login

Existing OIDC, OAuth 2.0, SAML 2.0, PKCE, nonce, state, signed assertion, tenant, issuer, audience, and request-correlation validation remain. On successful Entra authentication, the server creates the same portable opaque application session used by local login. No hosted-platform OAuth callback remains.

## Storage model

The `storagePut` interface remains to minimize feature churn, but its implementation is provider-neutral. Production uses an S3-compatible endpoint configured through `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, and `STORAGE_FORCE_PATH_STYLE`. Stored objects are returned through an authenticated same-origin file route rather than an external platform-specific asset path.

Local development may use `STORAGE_DRIVER=local` and `LOCAL_STORAGE_PATH=./data/uploads`. Hostinger managed deployment should use S3-compatible storage because application redeployments must not be treated as a durable file store.

Approved Welfare Pride logo artwork is packaged as source-controlled SVG code so no production page references an external managed-storage URL.

## Scheduling model

Backup destinations retain schedule definitions in MySQL. A single endpoint, `POST /api/cron/dispatch`, requires `Authorization: Bearer <CRON_SECRET>`. Hostinger cron invokes it every minute in UTC. The dispatcher uses the stored cron expressions, destination ownership, prior run time, and idempotency checks to execute only due work. The same endpoint works from system cron on a VPS.

The administrator can create, update, enable, disable, and delete schedule definitions inside the portal. The portal does not attempt to modify Hostinger hPanel cron jobs; only the single dispatcher job must be installed once.

## Search and personalization

Global search is a protected tRPC API. It searches cached employee profiles and published announcements in MySQL, then queries the HR SharePoint drive with the requesting employee’s delegated token. Results are grouped by source, capped per category, and link to existing portal detail or SharePoint pages. SharePoint permissions remain authoritative.

Dashboard pins use a `dashboard_pins` table keyed by `userId`, `pinType`, and `resourceId`. Every list, create, reorder, and delete operation derives the owner from the authenticated context; clients cannot submit another user ID.

## AI assistant model

The assistant uses a configurable OpenAI-compatible endpoint rather than a built-in AI service. Before sending a prompt, the server retrieves published company content and, when requested, employee-authorized SharePoint documents using that employee’s delegated token. Supported document types are parsed with strict size and type limits. The model receives only the retrieved excerpts, a no-fabrication system instruction, and opaque source identifiers. Responses include server-generated source links.

No source content is indexed into a shared cross-user vector store. This avoids exposing a document found by one employee to another employee who lacks SharePoint access. If relevant authorized sources are unavailable, the assistant must say that it cannot answer from approved Welfare Pride information.

## Deployment package

The repository includes `deploy/hostinger/environment.template`, migration commands, a Hostinger managed-Node guide, Docker Compose and native VPS options, a health procedure, a cron dispatcher, startup validation, and backup/restore instructions. Production environment variables are provider-neutral.
