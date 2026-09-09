import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";
import { shouldTriggerHighSeverityAlert } from "./securityAlerts";

const dbMock = {
  getSecurityEventDetail: vi.fn(),
  getSecurityIncidentCase: vi.fn(),
  getUnreadSecurityAlertNotificationCount: vi.fn(),
  listSecurityAlertNotifications: vi.fn(),
  markSecurityAlertNotificationsRead: vi.fn(),
  getUnreadSecurityEventCount: vi.fn(),
  listUnreadSecurityEvents: vi.fn(),
  markSecurityEventsRead: vi.fn(),
  listSecurityAdministrators: vi.fn(),
  listSecurityEscalationOwners: vi.fn(),
  replaceSecurityEscalationOwners: vi.fn(),
  acknowledgeCriticalSecurityIncident: vi.fn(),
  resolveCriticalSecurityIncident: vi.fn(),
  appendSecurityEvent: vi.fn(),
};

vi.mock("../db", () => dbMock);
const { securityCenterRouter } = await import("../routers/securityCenter");

function context(role: "user" | "admin" = "user"): TrpcContext {
  return {
    req: { headers: {}, method: "GET", path: "/api/trpc/securityCenter.alertNotifications", socket: { remoteAddress: "127.0.0.1" } } as TrpcContext["req"],
    res: { getHeader: () => "corr-security-alert-test" } as TrpcContext["res"],
    user: { id: 7, openId: "local:security-alert-test", name: "Security Alert Test", email: "security-alert@example.test", loginMethod: "local", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    authState: "full",
    session: null,
  };
}

describe("Security Center threshold alert policy", () => {
  it("creates an alert only at the configured crossing and never while paused", () => {
    expect(shouldTriggerHighSeverityAlert({ alertingEnabled: true, threshold: 3, matchedEventCount: 2 })).toBe(false);
    expect(shouldTriggerHighSeverityAlert({ alertingEnabled: true, threshold: 3, matchedEventCount: 3 })).toBe(true);
    expect(shouldTriggerHighSeverityAlert({ alertingEnabled: true, threshold: 3, matchedEventCount: 4 })).toBe(false);
    expect(shouldTriggerHighSeverityAlert({ alertingEnabled: false, threshold: 3, matchedEventCount: 3 })).toBe(false);
  });
});

describe("Security Center alert and event detail authorization", () => {
  it("limits event details and alert read state to administrators and the authenticated recipient", async () => {
    dbMock.getSecurityEventDetail.mockResolvedValue({ selected: { event: { id: 5, correlationId: "corr-5" } }, related: [{ event: { id: 5 } }] });
    dbMock.getSecurityIncidentCase.mockResolvedValue(undefined);
    dbMock.getUnreadSecurityAlertNotificationCount.mockResolvedValue(1);
    dbMock.listSecurityAlertNotifications.mockResolvedValue([{ id: 11, recipientUserId: 7, triggerEventId: 5, correlationId: "corr-5" }]);
    const userCaller = securityCenterRouter.createCaller(context());
    await expect(userCaller.eventDetail({ eventId: 5 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(userCaller.alertNotifications()).rejects.toMatchObject({ code: "FORBIDDEN" });
    const adminCaller = securityCenterRouter.createCaller(context("admin"));
    await expect(adminCaller.eventDetail({ eventId: 5 })).resolves.toMatchObject({ selected: { event: { id: 5 } } });
    await expect(adminCaller.alertNotifications()).resolves.toEqual({ unreadCount: 1, notifications: [{ id: 11, recipientUserId: 7, triggerEventId: 5, correlationId: "corr-5" }] });
    await adminCaller.markAlertNotificationsRead();
    expect(dbMock.markSecurityAlertNotificationsRead).toHaveBeenCalledWith(7);
  });
});

describe("Security Center escalation and critical incident workflows", () => {
  it("scopes unread event state and escalation assignment to administrators", async () => {
    dbMock.getUnreadSecurityEventCount.mockResolvedValue(2);
    dbMock.listUnreadSecurityEvents.mockResolvedValue([{ event: { id: 31, correlationId: "corr-31" } }]);
    dbMock.listSecurityAdministrators.mockResolvedValue([{ id: 7, name: "Security Alert Test", email: "security-alert@example.test" }]);
    dbMock.listSecurityEscalationOwners.mockResolvedValue([{ userId: 7, name: "Security Alert Test", email: "security-alert@example.test" }]);
    dbMock.replaceSecurityEscalationOwners.mockResolvedValue([{ userId: 7, name: "Security Alert Test", email: "security-alert@example.test" }]);
    const userCaller = securityCenterRouter.createCaller(context());
    await expect(userCaller.unreadEvents()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(userCaller.saveEscalationOwners({ userIds: [7] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const adminCaller = securityCenterRouter.createCaller(context("admin"));
    await expect(adminCaller.unreadEvents()).resolves.toMatchObject({ unreadCount: 2, events: [{ event: { id: 31 } }] });
    await adminCaller.markEventsRead();
    expect(dbMock.markSecurityEventsRead).toHaveBeenCalledWith(7);
    await expect(adminCaller.saveEscalationOwners({ userIds: [7] })).resolves.toEqual([{ userId: 7, name: "Security Alert Test", email: "security-alert@example.test" }]);
    expect(dbMock.replaceSecurityEscalationOwners).toHaveBeenCalledWith({ userIds: [7], assignedByUserId: 7 });
  });

  it("keeps critical incident acknowledgement and resolution behind administrator authorization", async () => {
    dbMock.acknowledgeCriticalSecurityIncident.mockResolvedValue({ id: 9, triggerEventId: 42, caseReference: "SEC-20260909-42", status: "acknowledged" });
    dbMock.resolveCriticalSecurityIncident.mockResolvedValue({ id: 9, triggerEventId: 42, caseReference: "SEC-20260909-42", status: "resolved" });
    const userCaller = securityCenterRouter.createCaller(context());
    await expect(userCaller.acknowledgeCriticalIncident({ eventId: 42, ownerUserId: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const adminCaller = securityCenterRouter.createCaller(context("admin"));
    await expect(adminCaller.acknowledgeCriticalIncident({ eventId: 42, ownerUserId: 7 })).resolves.toMatchObject({ caseReference: "SEC-20260909-42", status: "acknowledged" });
    await expect(adminCaller.resolveCriticalIncident({ eventId: 42, resolutionNotes: "Source blocked and perimeter controls verified." })).resolves.toMatchObject({ status: "resolved" });
    expect(dbMock.acknowledgeCriticalSecurityIncident).toHaveBeenCalledWith({ triggerEventId: 42, ownerUserId: 7, acknowledgedByUserId: 7 });
    expect(dbMock.resolveCriticalSecurityIncident).toHaveBeenCalledWith(expect.objectContaining({ triggerEventId: 42, resolvedByUserId: 7 }));
  });
});
