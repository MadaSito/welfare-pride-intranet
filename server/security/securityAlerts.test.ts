import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";
import { shouldTriggerHighSeverityAlert } from "./securityAlerts";

const dbMock = {
  getSecurityEventDetail: vi.fn(),
  getUnreadSecurityAlertNotificationCount: vi.fn(),
  listSecurityAlertNotifications: vi.fn(),
  markSecurityAlertNotificationsRead: vi.fn(),
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
