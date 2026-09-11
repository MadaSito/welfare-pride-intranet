import { describe, expect, it } from "vitest";
import { summarizeAuditAnalytics } from "./auditAnalytics";

describe("System Audit Center analytics", () => {
  it("ranks administrative actions and configuration changes independently", () => {
    const summary = summarizeAuditAnalytics([
      { entityType: "portal_resource", eventType: "resource_updated", createdAt: new Date("2026-09-10T08:00:00Z") },
      { entityType: "portal_resource", eventType: "resource_updated", createdAt: new Date("2026-09-10T09:00:00Z") },
      { entityType: "security_event", eventType: "ip_blocked", createdAt: new Date("2026-09-10T10:00:00Z") },
      { entityType: "email_template", eventType: "template_saved", createdAt: new Date("2026-09-10T11:00:00Z") },
    ]);

    expect(summary.totalEvents).toBe(4);
    expect(summary.administrativeActions[0]).toEqual({ eventType: "resource_updated", label: "Resource Updated", count: 2 });
    expect(summary.configurationChanges).toEqual(expect.arrayContaining([
      { eventType: "resource_updated", label: "Resource Updated", count: 2 },
      { eventType: "template_saved", label: "Template Saved", count: 1 },
    ]));
  });
});
