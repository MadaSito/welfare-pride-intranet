export const SECURITY_THREAT_EVENT_TYPES = [
  "blocked_ip",
  "allowlist_rejected",
  "suspicious_request",
  "rate_limited",
  "automatic_ip_block_created",
] as const;

type AnalyticsEvent = {
  eventType: string;
  ipAddress: string | null;
  createdAt: Date;
};

export type SecurityAnalytics = {
  windowStart: Date;
  windowEnd: Date;
  topBlockedIps: Array<{ ipAddress: string; count: number }>;
  topThreatTypes: Array<{ eventType: string; count: number }>;
  totalThreatEvents: number;
};

export function buildSecurityAnalytics(events: AnalyticsEvent[], now = new Date()): SecurityAnalytics {
  const windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentEvents = events.filter(event => event.createdAt >= windowStart && event.createdAt <= now);
  const threatEvents = recentEvents.filter(event => SECURITY_THREAT_EVENT_TYPES.includes(event.eventType as typeof SECURITY_THREAT_EVENT_TYPES[number]));
  const blockedIps = new Map<string, number>();
  const threatTypes = new Map<string, number>();

  for (const event of threatEvents) {
    threatTypes.set(event.eventType, (threatTypes.get(event.eventType) || 0) + 1);
    if ((event.eventType === "blocked_ip" || event.eventType === "automatic_ip_block_created") && event.ipAddress) {
      blockedIps.set(event.ipAddress, (blockedIps.get(event.ipAddress) || 0) + 1);
    }
  }

  const descendingCounts = <T extends string>(entries: Iterable<[T, number]>, key: "ipAddress" | "eventType") => Array.from(entries)
    .map(([value, count]) => ({ [key]: value, count }) as { [key in typeof key]: T } & { count: number })
    .sort((left, right) => right.count - left.count || String(left[key]).localeCompare(String(right[key])))
    .slice(0, 8);

  return {
    windowStart,
    windowEnd: now,
    topBlockedIps: descendingCounts(blockedIps, "ipAddress"),
    topThreatTypes: descendingCounts(threatTypes, "eventType"),
    totalThreatEvents: threatEvents.length,
  };
}

function escapeCsvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value).replace(/\r?\n/g, " ");
  const formulaSafe = /^\s*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${formulaSafe.replaceAll('"', '""')}"`;
}

export type SecurityCsvRow = {
  id: number;
  createdAt: Date;
  correlationId: string;
  severity: string;
  eventType: string;
  ipAddress: string | null;
  method: string | null;
  requestPath: string | null;
  actorName: string | null;
  actorEmail: string | null;
  detailsJson: string | null;
};

export function buildSecurityEventsCsv(rows: SecurityCsvRow[]) {
  const header = ["event_id", "created_at_utc", "correlation_id", "severity", "event_type", "ip_address", "method", "request_path", "actor_name", "actor_email", "details"];
  const body = rows.map(row => [
    row.id,
    row.createdAt.toISOString(),
    row.correlationId,
    row.severity,
    row.eventType,
    row.ipAddress,
    row.method,
    row.requestPath,
    row.actorName,
    row.actorEmail,
    row.detailsJson,
  ].map(escapeCsvCell).join(","));
  return `${header.join(",")}\r\n${body.join("\r\n")}\r\n`;
}
