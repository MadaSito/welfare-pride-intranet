import { describe, expect, it } from "vitest";
import { buildSecurityAnalytics, buildSecurityEventsCsv } from "./securityAnalytics";

const now = new Date("2026-09-09T12:00:00.000Z");

describe("Security Center analytics", () => {
  it("ranks live threat events from the previous seven days and excludes unrelated or expired events", () => {
    const analytics = buildSecurityAnalytics([
      { eventType: "blocked_ip", ipAddress: "203.0.113.10", createdAt: new Date("2026-09-09T10:00:00.000Z") },
      { eventType: "blocked_ip", ipAddress: "203.0.113.10", createdAt: new Date("2026-09-08T10:00:00.000Z") },
      { eventType: "automatic_ip_block_created", ipAddress: "198.51.100.24", createdAt: new Date("2026-09-08T11:00:00.000Z") },
      { eventType: "suspicious_request", ipAddress: "198.51.100.24", createdAt: new Date("2026-09-07T11:00:00.000Z") },
      { eventType: "security_settings_updated", ipAddress: "198.51.100.24", createdAt: new Date("2026-09-07T11:00:00.000Z") },
      { eventType: "rate_limited", ipAddress: "192.0.2.30", createdAt: new Date("2026-08-31T11:59:59.000Z") },
    ], now);

    expect(analytics.totalThreatEvents).toBe(4);
    expect(analytics.topBlockedIps).toEqual([
      { ipAddress: "203.0.113.10", count: 2 },
      { ipAddress: "198.51.100.24", count: 1 },
    ]);
    expect(analytics.topThreatTypes).toEqual([
      { eventType: "blocked_ip", count: 2 },
      { eventType: "automatic_ip_block_created", count: 1 },
      { eventType: "suspicious_request", count: 1 },
    ]);
  });
});

describe("Security Center CSV export", () => {
  it("quotes cells, preserves headers, normalizes line breaks, and neutralizes spreadsheet formulas", () => {
    const csv = buildSecurityEventsCsv([{
      id: 42,
      createdAt: now,
      correlationId: "corr-42",
      severity: "high",
      eventType: "suspicious_request",
      ipAddress: "203.0.113.10",
      method: "GET",
      requestPath: "/api/search",
      actorName: " =UNSAFE",
      actorEmail: "admin@example.test",
      detailsJson: "first line\nsecond line",
    }]);

    expect(csv).toContain("event_id,created_at_utc,correlation_id");
    expect(csv).toContain("\"' =UNSAFE\"");
    expect(csv).toContain("\"first line second line\"");
    expect(csv).toContain("\"2026-09-09T12:00:00.000Z\"");
  });
});
