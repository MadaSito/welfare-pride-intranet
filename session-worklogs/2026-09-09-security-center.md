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

## Investigation and alert extension

The Security Center now provides a server-protected event-detail query and an administrator-only modal that renders complete captured metadata plus the retained event chain sharing its correlation ID. Request bodies and query strings are never collected for this view. The seven-day charts provide hover tooltips and apply their selected source IP or threat type to the timeline filters.

Security settings now include an alerting switch, high-severity count threshold, and rolling alert window. When the exact configured count of high or critical events is reached in the rolling window, durable recipient-scoped alert records are created for the administrators present at that time. The header alert bell polls these records, opens Security Center context using the alert’s correlation and event IDs, and marks only the viewing administrator’s alerts as read. The `security_alert_notifications` migration uses short foreign-key names for TiDB/MySQL compatibility.

Focused tests validate threshold crossing and the administrator-only event-detail/alert read-state procedures. Isolated loopback-only acceptance created disposable high-severity events, confirmed the threshold alert, correlated detail response, unauthenticated denial, administrator read state, interactive IP/threat chart drill-through, responsive desktop/mobile modal rendering, and alert-bell presentation. The temporary remote stack, volumes, credentials, request traces, browser tooling, images, and artifacts are removed after validation.
