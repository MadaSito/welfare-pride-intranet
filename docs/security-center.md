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

## Scope and deployment guidance

The Security Center is **not a substitute for a perimeter firewall, web application firewall, reverse proxy, operating-system patching, secure TLS configuration, Microsoft Entra conditional access, endpoint protection, backups, or incident response**. It is an application-layer control and cannot block packets before they reach the hosting provider or proxy.

For a Docker, VPS, Azure, or Hostinger deployment, set `TRUST_PROXY=true` only when a controlled reverse proxy is the direct upstream. This allows Express to derive the client IP from the trusted proxy chain. Do not accept client-provided `X-Forwarded-For` values directly at the application edge. In horizontally scaled deployments, enforce high-volume or distributed rate limits at a reverse proxy or WAF as well, because this application limiter is intentionally process-local.

## Administrative response workflow

1. Filter the Security Center timeline by a correlation ID, source IP, or severity.
2. Verify the source, path, timing, and related administrator events before acting.
3. Add a labelled temporary block policy for a confirmed abusive address, or use an allow policy for a trusted administrative egress address.
4. If allowlist-only mode is required, first confirm the current administrative source appears in the active allow-policy list.
5. Use the confirmed **Unblock** or **Remove allow** action only after reviewing the event timeline and any perimeter controls.
6. Preserve relevant correlation IDs in the organization’s incident record and investigate repeated high-severity activity at the reverse-proxy, operating-system, and identity layers.
