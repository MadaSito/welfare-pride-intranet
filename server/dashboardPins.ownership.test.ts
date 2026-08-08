import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listDashboardPinsForUser: vi.fn(),
  getPublishedUpcomingEventById: vi.fn(),
  addDashboardPinForUser: vi.fn(),
  removeDashboardPinForUser: vi.fn(),
  getAuthorizedSharePointDocument: vi.fn(),
}));
vi.mock("./db", () => ({
  listDashboardPinsForUser: mocks.listDashboardPinsForUser,
  getPublishedUpcomingEventById: mocks.getPublishedUpcomingEventById,
  addDashboardPinForUser: mocks.addDashboardPinForUser,
  removeDashboardPinForUser: mocks.removeDashboardPinForUser,
}));
vi.mock("./integrations/sharePoint", () => ({ getAuthorizedSharePointDocument: mocks.getAuthorizedSharePointDocument }));

import { dashboardPinsRouter } from "./routers/dashboardPins";

function context(userId: number) {
  return { user: { id: userId, role: "user" }, req: {}, res: {} } as any;
}

describe("dashboard pin ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listDashboardPinsForUser.mockResolvedValue([]);
  });

  it("uses the authenticated owner for event pins", async () => {
    mocks.getPublishedUpcomingEventById.mockResolvedValue({ id: 12, status: "published", endAt: new Date(Date.now() + 60_000) });
    await dashboardPinsRouter.createCaller(context(55)).pinEvent({ eventId: 12 });
    expect(mocks.addDashboardPinForUser).toHaveBeenCalledWith(55, "event", "12");
  });

  it("reauthorizes a SharePoint document for the authenticated owner before pinning", async () => {
    mocks.getAuthorizedSharePointDocument.mockResolvedValue({ id: "sp-9", isFolder: false });
    await dashboardPinsRouter.createCaller(context(56)).pinDocument({ documentId: "sp-9" });
    expect(mocks.getAuthorizedSharePointDocument).toHaveBeenCalledWith({ userId: 56, documentId: "sp-9" });
    expect(mocks.addDashboardPinForUser).toHaveBeenCalledWith(56, "hr_document", "sp-9");
  });

  it("cannot remove another employee's pin because userId is never accepted from input", async () => {
    await dashboardPinsRouter.createCaller(context(57)).remove({ pinType: "event", targetKey: "12" });
    expect(mocks.removeDashboardPinForUser).toHaveBeenCalledWith(57, "event", "12");
  });

  it("limits each employee to twelve pins of one type", async () => {
    mocks.listDashboardPinsForUser.mockResolvedValue(Array.from({ length: 12 }, (_, index) => ({ pinType: "event", targetKey: String(index + 1) })));
    mocks.getPublishedUpcomingEventById.mockResolvedValue({ id: 99, status: "published", endAt: new Date(Date.now() + 60_000) });
    await expect(dashboardPinsRouter.createCaller(context(58)).pinEvent({ eventId: 99 })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(mocks.addDashboardPinForUser).not.toHaveBeenCalled();
  });
});
