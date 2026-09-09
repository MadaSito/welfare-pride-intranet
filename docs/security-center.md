# Security Center

The **Security Center** is an administrator-only, application-layer defensive control plane for the Welfare Pride intranet. It records high-signal security events, assigns a correlation ID to every protected request, and manages IP allow or block policies, API request throttling, and optional temporary automated blocks.

## Enforcement order

Each incoming request receives an `X-Correlation-ID` response header before it reaches file, authentication, tRPC, or client routes. The Security Center then evaluates the following safeguards in order.

| Order | Control | Result |
|---:|---|---|
| 1 | Active block policy | Block policies win over allow policies and return `403`. |
| 2 | Allowlist-only mode | Requests not in an active allow policy return `403`. |
| 3 | High-signal exploit probe detection | Traversal, exposed-environment, WordPress-admin, common database-admin, test-framework, and script-injection probes return `403`. |
| 4 | API rate limiting | Requests above the configured per-IP fixed window return `429` with `Retry-After`. |

The `/api/healthz` endpoint is intentionally exempt from portal access policy and rate limiting so health checks can distinguish application availability from an administrator configuration error. It is not an authenticated business-data endpoint.

## IP policy management

Use **Allow** policies for known administrative, office-egress, or VPN addresses. Allow policies are staged safely: they do not restrict other addresses until an administrator explicitly enables allowlist-only mode. The server refuses to enable that mode unless the current administrator request comes from an active allow policy.

Use **Block** policies for confirmed abusive, malicious, or unwanted source addresses. A block policy always takes precedence over an allow policy. The server will not allow an administrator to block the source IP of their current administrative request. Temporary policies expire automatically at their configured timestamp; inactive or expired rows remain in the audit trail.

> **Safe rollout:** Add and test an allow policy for the current trusted egress address first. Keep a separate authorized administrator on a different trusted network while enabling allowlist-only mode. Do not activate allowlist-only mode for a workforce that shares changing or unverified NAT addresses without an approved VPN or fixed-egress design.

## Rate limiting and automatic response

Rate limiting applies to `/api/` paths on a **per-source-IP, fixed-window** basis. The default is 120 requests per 60 seconds. The Security Center records the first denial in a window to preserve useful signal while preventing a denial-of-service attempt from producing an unbounded volume of audit rows.

Administrators may configure an optional temporary automated block after a number of rate-limit breaches. A value of `0` disables automated blocks. Automated blocks have a visible reason, expiry, event record, and can be revoked by an administrator after allowlist-only mode has been safely disabled if necessary.

## Correlation-aware audit timeline

Security events record the following data for authorized Security Center viewers.

| Field | Purpose |
|---|---|
| Correlation ID | Relates the request denial and any administrator response action. |
| Event type and severity | Distinguishes policy changes, blocks, rate limits, and suspicious-request detections. |
| Source IP | Enables operational response and policy action; access is limited to administrators. |
| Method and path | Shows the application target without retaining request bodies or query values. |
| User-agent hash | Supports privacy-conscious request fingerprinting without storing the full user-agent string. |
| Administrator actor | Identifies the logged-in administrator for configuration and policy changes. |
| Timestamp and limited metadata | Records the enforcement reason, policy reference, expiry context, and retry interval. |

The timeline can be filtered by text, severity, or correlation ID. Selecting a correlation ID from an event applies that exact filter to facilitate incident review.

## CSV export and seven-day analytics

The Security Center now supports a **filtered CSV export** for offline investigation. Exports are restricted to administrators, use the same exact correlation ID, exact IP, severity, threat type, keyword, and date filters as the on-screen timeline, and are capped at 5,000 rows and a 90-day date window. Each export action creates a `security_events_exported` audit event that records the export row count and non-sensitive filter summary. The downloaded CSV uses a UTF-8 content type, quoted cells, normalized line breaks, and spreadsheet-formula neutralization for cells beginning with formula-significant characters.

The analytics cards use live security events from the preceding seven days. **Top blocked IP addresses** aggregates blocked-request and automatic-block events. **Most frequent security threats** aggregates block, allowlist-rejection, suspicious-request, rate-limit, and automatic-block events while excluding routine administrative policy actions. Both charts update from the authoritative event log and do not use seed or simulated security data.

| Investigation control | Behavior |
|---|---|
| Free-text search | Matches recorded correlation IDs, source IPs, event types, and paths. |
| Exact correlation ID | Narrows the event set to a single request or response chain. |
| Exact IP address | Narrows the event set to one validated IPv4 or IPv6 source address. |
| Severity and threat type | Allows focused review of a category or escalation level. |
| UTC date range | Supports a bounded inclusive date interval of up to 90 days. |
| Result limit | Keeps browser investigation views within 50, 100, 250, or 500 rows. |
| CSV export | Exports up to 5,000 records matching the active filters and creates an audit event. |

## Event investigation and chart drill-through

Selecting an event type or correlation ID in the timeline opens the **Security event investigation** dialog. It displays the selected event’s timestamp, source address, actor when available, request target, correlation ID, and complete **captured security metadata**. The dialog also lists retained events with the same correlation ID, allowing an administrator to move among related records or apply the exact correlation ID to the timeline.

> The event collector intentionally retains security metadata rather than request bodies or query-string values. The modal displays the full payload that was captured for that event; it does not expose uncollected credentials, form content, or request bodies.

Both seven-day charts contain hover tooltips and are interactive. Selecting a bar in **Top blocked IP addresses** applies that exact source IP to the timeline. Selecting a bar in **Most frequent security threats** applies the corresponding event type. Each applied filter remains visible and can be cleared using **Clear filters**.

## High-severity alerts

Administrators can configure the **Security alert bell** in the Security Center. When enabled, the portal counts high and critical events in a rolling window. An in-app alert is created for every current administrator only when the configured count is crossed, preventing a sustained event stream from generating a separate bell alert for every additional request. Alerts include the triggering event ID and correlation ID, source IP when captured, count, window, severity, and event type. Opening the alert bell marks that recipient’s outstanding Security Center alerts as read; one administrator’s read state does not affect another’s.

| Setting | Valid range | Purpose |
|---|---:|---|
| Security alert bell | Enabled or paused | Enables or pauses creation of new in-app threshold alerts. Existing alerts remain available. |
| Threshold events | 1–100 | Number of high or critical events that must be seen before an alert is created. |
| Rolling window | 1–1,440 minutes | Duration in which high and critical events are counted. |

The Security Center alert bell is not a replacement for external 24/7 monitoring. It is an authenticated administrator notification within the portal. Maintain perimeter alerts and incident-response procedures separately for after-hours coverage.

## Scope and deployment guidance

The Security Center is **not a substitute for a perimeter firewall, web application firewall, reverse proxy, operating-system patching, secure TLS configuration, Microsoft Entra conditional access, endpoint protection, backups, or incident response**. It is an application-layer control and cannot block packets before they reach the hosting provider or proxy.

For a Docker, VPS, Azure, or Hostinger deployment, set `TRUST_PROXY=true` only when a controlled reverse proxy is the direct upstream. This allows Express to derive the client IP from the trusted proxy chain. Do not accept client-provided `X-Forwarded-For` values directly at the application edge. In horizontally scaled deployments, enforce high-volume or distributed rate limits at a reverse proxy or WAF as well, because this application limiter is intentionally process-local.

## Administrative response workflow

1. Filter the Security Center timeline by a correlation ID, source IP, threat type, severity, or date range.
2. Verify the source, path, timing, and related administrator events before acting.
3. Use **Export CSV** to preserve the exact filtered event set for offline analysis; the Security Center records the export action.
4. Select a chart bar to inspect its exact IP or threat-type event set, then open an event to review captured metadata and related correlation records.
5. Configure a modest high-severity threshold and rolling window appropriate to the organization’s normal event volume; test the administrator alert bell in a controlled environment.
6. Add a labelled temporary block policy for a confirmed abusive address, or use an allow policy for a trusted administrative egress address.
7. If allowlist-only mode is required, first confirm the current administrative source appears in the active allow-policy list.
8. Use the confirmed **Unblock** or **Remove allow** action only after reviewing the event timeline and any perimeter controls.
9. Preserve relevant correlation IDs in the organization’s incident record and investigate repeated high-severity activity at the reverse-proxy, operating-system, and identity layers.
