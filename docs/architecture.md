# Welfare Pride Intranet Implementation Architecture

## Purpose

The **Welfare Pride Intranet** is implemented as a responsive React and TypeScript employee portal with an Express and tRPC application server, a relational database for portal-owned metadata, and server-only adapters for Microsoft 365 and cloud storage services. Microsoft Entra ID remains the identity source of truth, while SharePoint remains the authorization boundary and storage system for Human Resources documents.

The application uses the exact Welfare Pride brand colors **`#5A92C9`** and **`#D58240`**, the **Roboto** typeface, and the official supplied logo assets. The portal presents realistic unconfigured, loading, empty, success, and diagnostic states rather than exposing secrets or simulating successful external connections.

## Architectural Boundaries

| Boundary | System of Record | Application Responsibility | Security Rule |
| --- | --- | --- | --- |
| Employee identity | Microsoft Entra ID | Initiate SSO, validate identity assertions, establish an application session, and map Entra identities to local portal records | Authentication tokens and secrets remain server-side; browser sessions use secure, HTTP-only cookies |
| Employee directory and reporting hierarchy | Microsoft Graph | Read and normalize profile, manager, and direct-report data; maintain optional portal-owned fields | Graph calls use least-privilege scopes and server-side token exchange |
| HR documents | Microsoft SharePoint | Search and render document metadata and server-generated SharePoint links | SharePoint evaluates authorization on every request; the portal never recreates SharePoint ACLs |
| Holidays | SharePoint List | Normalize list items into calendar entries and cache non-sensitive display metadata | Synchronization runs server-side and records sanitized diagnostics |
| Announcements and events | Portal database | Create, publish, categorize, list, and archive company content | Mutations are administrator-only; employee access is read-only |
| Birthdays | Entra extension, SharePoint List, or approved profile source | Display month and day only | Birth year is discarded at the normalization boundary and is never returned by the API |
| Profile photographs and portal media | Project object storage | Store uploaded image bytes and retain only object metadata in the database | Upload type and size are validated; object access is mediated by signed or project storage URLs |
| Integration configuration | Portal database plus runtime encryption key | Store non-sensitive identifiers and encrypted credential envelopes | Secrets are encrypted with authenticated encryption, never logged, and never returned to the browser |
| Backup destinations | Provider APIs | Validate configuration, perform dry runs, record checksum results, and coordinate guarded restores | Provider credentials stay server-side; destructive restore actions require administrator authorization and explicit confirmation |

## Authentication Strategy

The portal supports three Microsoft Entra enterprise sign-in patterns through a unified branded sign-in experience. **OIDC** is the primary interactive web authentication path, **OAuth 2.0** provides delegated Microsoft Graph authorization, and **SAML 2.0** is represented as an enterprise federation option with service-provider metadata and assertion-consumer configuration. The application session is distinct from Microsoft access tokens.

Interactive and silent sign-in both use a one-time state value, short-lived browser correlation cookie, explicit redirect URI, issuer and audience validation, and a server-created application session. Silent sign-in requests `prompt=none`; success depends on the employee already having a valid Microsoft browser session and on the organization’s Entra and device policies. If Microsoft returns an interaction-required response, the portal falls back to the branded interactive sign-in action without creating a partial session.

OAuth access and refresh tokens are never exposed to React components or persisted in local storage. Tokens required for delegated Microsoft Graph calls are encrypted server-side and associated with the authenticated employee. Application authorization is enforced independently through protected and administrator-only tRPC procedures.

## Role Model

| Role | Portal Capabilities |
| --- | --- |
| Employee | View the dashboard, directory, organizational chart, calendars, announcements, links, company pages, and authorized SharePoint documents; edit their own approved profile fields |
| Administrator | All employee capabilities plus edit-any-profile, announcement and event management, integration configuration, connection diagnostics, backup dry runs, and guarded restore operations |

The server is authoritative for authorization. Conditional navigation improves usability but never substitutes for protected server procedures.

## Portal Modules

| Module | Primary Views | Server Contract |
| --- | --- | --- |
| Dashboard | Welcome summary, company pulse, upcoming dates, latest announcements, quick links, and system readiness | Aggregated read-only dashboard query with per-source status |
| Employee Profiles | Directory, personal profile editor, administrator edit drawer, photo upload | Self update, admin override, Graph refresh, and photo metadata procedures |
| Organization | Searchable hierarchy canvas, zoom and pan controls, employee detail cards | Normalized people and reporting-edge query with source status |
| Calendars | Holiday month view, birthday month/day view, event calendar, announcement list and details | Calendar range query, published content query, and administrator content mutations |
| Human Resources | Search, category filters, metadata table or cards, SharePoint open/download actions | Server-side Graph/SharePoint proxy for metadata and permission-preserving links |
| Important Links | Categorized Microsoft 365 and internal resource grid | Read-only configured link query and administrator link management |
| About and Founders | Branded content blocks, founder biographies, milestones, and timeline | Published portal content queries and administrator content management |
| Technology | Approved embedded applications with clear security state | Administrator-managed allowlist and validated embed configuration |
| Integration Settings | Microsoft identifiers, endpoints, credential status, and connection tests | Redacted settings query, encrypted save mutation, and provider-specific diagnostics |
| Backup Center | Destination status, dry runs, checksum results, restore controls, and audit history | Administrator-only destination, dry-run, restore, and audit procedures |

## Data Model

The local database stores portal-owned state only. Planned entities include `employee_profiles`, `announcements`, `events`, `important_links`, `founders`, `milestones`, `technology_embeds`, `integration_settings`, `connection_diagnostics`, `backup_destinations`, `backup_runs`, and `restore_runs`. External identifiers are retained where needed for synchronization, but SharePoint document permissions and Entra directory ownership remain external.

All business timestamps are stored as UTC timestamps. Birthday values are stored, normalized, and returned as **month and day only**. Integration secrets use versioned encrypted envelopes containing an initialization vector, ciphertext, authentication tag, and key version; redacted configuration responses reveal only whether a credential is configured.

## External Integration States

Each externally backed module exposes a consistent status contract: `connected`, `unconfigured`, `degraded`, or `error`. An unconfigured integration produces setup guidance and an administrator action rather than fabricated employee, document, calendar, or backup data. Diagnostic responses contain a timestamp, target, duration, status, and sanitized message; raw provider error bodies and tokens are excluded.

## Backup and Scheduling Model

Manual dry runs execute within a bounded server request. A dry run creates a small manifest archive, calculates a SHA-256 checksum, uploads it to the selected provider, retrieves or verifies provider metadata when supported, records the result, and removes the test artifact when configured to do so. It does not alter production schedules or production content.

Scheduled synchronization and backups use platform-managed HTTP callbacks rather than in-process timers. Callback paths begin with `/api/scheduled/`, authenticate the scheduler identity, look up the owning configuration by scheduler task identifier, execute idempotently, and write an audit record. Scheduled jobs are created only after a production deployment is available.

Restore operations are separate from dry runs. Each restore request requires an administrator session, the selected immutable backup record, a typed confirmation value, destination validation, and an audit entry. Provider-specific restore execution remains disabled until valid production credentials and an approved restore policy are configured.

## Secure Technology Embeds

Technology embeds are administrator-created and must use HTTPS. The server parses and compares each URL against an explicit hostname allowlist. Rendered iframes use a restrictive `sandbox` attribute, a minimal `allow` policy, lazy loading, a descriptive title, and no same-origin privilege unless a reviewed application requires it. The deployment guide documents the corresponding `frame-src` Content Security Policy and the requirement that the embedded application permit framing through its own CSP.

## Delivery Scope and Configuration Dependencies

The delivered application includes the complete branded interface, role-aware APIs, local content management, integration adapters, secure configuration surfaces, diagnostic behavior, and documented production setup. Live Microsoft Graph, SharePoint, SAML, and cloud-provider operations become active only after an authorized Welfare Pride administrator supplies tenant-specific identifiers, endpoints, certificates, and credentials. No customer secret is hardcoded into source control or included in the delivery checkpoint.
