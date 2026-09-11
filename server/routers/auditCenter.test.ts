import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const dbMock = {
  searchOperationAuditEvents: vi.fn(),
  getOperationAuditAnalytics: vi.fn(),
  appendOperationAuditEvent: vi.fn(),
  userHasPortalPermission: vi.fn(),
};

vi.mock("../db", () => dbMock);
const { auditCenterRouter } = await import("./auditCenter");

function context(role: "user" | "admin" = "user"): TrpcContext {
  return {
    req: { headers: {}, method: "POST", path: "/api/trpc/auditCenter.recordPdfExport", socket: { remoteAddress: "127.0.0.1" } } as TrpcContext["req"],
    res: { getHeader: () => "audit-pdf-test" } as TrpcContext["res"],
    user: { id: 7, openId: "local:audit-pdf-test", name: "Audit PDF Test", email: "audit-pdf@example.test", loginMethod: "local", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    authState: "full",
    session: null,
  };
}

describe("Audit Center PDF report export", () => {
  it("requires audit permission and records an authorized management report export", async () => {
    dbMock.userHasPortalPermission.mockResolvedValue(false);
    dbMock.appendOperationAuditEvent.mockResolvedValue(undefined);
    const userCaller = auditCenterRouter.createCaller(context());
    await expect(userCaller.recordPdfExport({ recordCount: 4, filters: {} })).rejects.toMatchObject({ code: "FORBIDDEN" });

    const adminCaller = auditCenterRouter.createCaller(context("admin"));
    await expect(adminCaller.recordPdfExport({ recordCount: 4, filters: { eventType: "configuration_updated" } })).resolves.toEqual({ success: true });
    expect(dbMock.appendOperationAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ entityType: "audit_report", eventType: "audit_pdf_exported", actorUserId: 7 }));
  });
});
