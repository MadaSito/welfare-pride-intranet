# Security Center Worklog

## Scope

This sanitized worklog records the Security Center implementation for correlation-aware security events, administrator-managed IP allow and block policies, defensive API rate limiting, suspicious-request detection, and safe response workflows.

## Implementation

The project now assigns an `X-Correlation-ID` to protected requests and evaluates active IP policies before portal routes. Block policies take precedence over allow policies. Optional allowlist-only mode requires an active policy for the current administrator source before activation. The server rejects self-blocking by the current administrator, supports timed policies, and retains policy creation and revocation events.

The application detects selected high-signal traversal, exposed-environment, common administrative-surface, and script-injection probes. API requests are limited per source IP in fixed windows. Only the first denial per window is logged to avoid audit-volume amplification. Optional rate-limit escalation creates a temporary automated block with an expiry and a correlated event.

The new administrator-only Security Center page provides control summaries, defensive settings, IP policy creation and confirmed removal, responsive event search, severity filtering, and correlation-ID review. Application-layer session IP fingerprints now use the same trusted Express source-IP model rather than accepting a forwarded header directly.

## Validation

The focused Security Center regression suite covers IP normalization, block-over-allow precedence, allowlist behavior, rate-limit windows, and suspicious-request recognition. Isolated loopback-only Docker acceptance verified anonymous administrator denial, correlation response headers, authenticated policy staging, safe allowlist activation, suspicious-request denial, `429` rate-limit behavior, correlation event visibility, and protected policy revocation. Authenticated desktop and mobile captures confirmed responsive controls and the correlated event timeline. The isolated containers, volumes, workspace, temporary credentials, browser harness, and artifacts are removed after validation.

## Analytics and export extension

The Security Center now calculates live seven-day analytics from retained security-event records. The dashboard ranks blocked-request and automatic-block source addresses separately from the most frequent defensive threat types. Its expanded timeline supports exact correlation-ID and source-IP matching, threat-type and severity selection, UTC date bounds, text search, and a bounded on-screen result limit.

Administrators can export the currently filtered event set as a quoted, formula-safe CSV without storing a temporary download server-side. The export procedure is administrator-only, has a 5,000-row and 90-day cap, and appends a `security_events_exported` audit record after constructing the download. Unit coverage validates live-event aggregation, seven-day exclusion, ranking, CSV quoting, newline normalization, and formula neutralization. A separate isolated Docker acceptance run produced real disposable security events, confirmed protected export denial for unauthenticated callers, verified analytics, exact IP/correlation/threat filters, export content, export audit logging, and responsive desktop/mobile charts. The temporary remote stack, volumes, credentials, CSV response, browser harness, screenshots, and artifacts are removed after validation.
