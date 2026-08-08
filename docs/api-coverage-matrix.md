# Welfare Pride Typed API Coverage Matrix

All authenticated application modules use typed tRPC procedures or dedicated standards-based authentication endpoints. Database and external-system access remains server-side.

| Portal experience | Typed server surface | Database or integration helpers | Authorization boundary |
| --- | --- | --- | --- |
| Dashboard identity | `auth.me`, `auth.logout` | `getUserByOpenId`, secure application session SDK | Public session lookup; protected shell |
| Microsoft Entra OIDC/OAuth | `/api/auth/microsoft/start`, callback, status | encrypted Microsoft configuration, Graph `/me`, delegated token persistence | Signed state, nonce, PKCE, token validation |
| Microsoft Entra SAML 2.0 | SAML start, ACS, and metadata endpoints | durable SAML request cache, signed assertion validation, user/profile upsert | `InResponseTo`, signature, audience, issuer, time, and tenant validation |
| Employee directory and profiles | `profiles.me`, `profiles.list`, update and photo procedures | employee profile helpers, S3 photo storage, Microsoft Graph directory synchronization | Employee self-edit; administrator override procedures |
| Organization chart | `profiles.organization` | Graph directory adapter with synchronized cache fallback | Authenticated employees |
| Announcements | `announcements` router | announcement list/create/update/archive helpers | Employee read; administrator management |
| Events | `events` router | event list/create/update/cancel helpers | Employee read; administrator management |
| Holiday and birthday calendars | `calendars.overview` and holiday synchronization procedure | holiday/event queries, privacy-preserving birthday projection, SharePoint list synchronization | Employee read; administrator synchronization |
| Human Resources documents | `documents.list` | delegated-token refresh and SharePoint/Graph document library adapter | Authenticated employee; SharePoint enforces document permissions |
| Important Links | `links` router | active/admin list, create/update/status helpers | Employee read; administrator management |
| About Welfare Pride | `companyPages.about`, `adminAbout`, and save procedure | versioned content block helpers | Employee read; administrator management |
| Founders and milestones | `companyPages.founders` and administrator procedures | founder and milestone helpers | Employee read; administrator management |
| Technology embeds | `technology` router | allowlist validation and embed persistence helpers | Employee read; administrator management |
| Integration Settings | `adminSettings` router | encrypted configuration, secret masks, connection diagnostics | Administrator only |
| Multi-cloud Backup Center | `backups` router | provider adapters, destination helpers, backup runs, append-only audit events | Administrator only |
| Restore History | `backups.restore` and overview | restore execution state, checksum verification, append-only audit events | Administrator only with typed confirmation |
| Scheduled backup callbacks | `/api/scheduled/backup` | durable destination ownership, idempotent recent-run check, backup adapter | Authenticated cron identity and task UID |

The root `appRouter` registers `profiles`, `announcements`, `events`, `calendars`, `documents`, `technology`, `links`, `companyPages`, `adminSettings`, and `backups`. Inputs are validated with Zod, and TypeScript infers client contracts from the root router.
