import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMock = {
  canAccessPortalResource: vi.fn(),
  getPortalResourceByKey: vi.fn(),
  getPortalResourceByPath: vi.fn(),
  listVisiblePortalResources: vi.fn(),
  listUserEntraGroupMemberships: vi.fn(),
  listPortalResources: vi.fn(),
  listEntraGroups: vi.fn(),
  listPortalUsersForAssignments: vi.fn(),
  listAccessControlAuditEvents: vi.fn(),
  listPortalAccessRequests: vi.fn(),
  getPortalResourceAssignments: vi.fn(),
  upsertEntraGroup: vi.fn(),
  savePortalResource: vi.fn(),
  replacePortalResourceAssignments: vi.fn(),
  appendAccessControlAuditEvent: vi.fn(),
  deleteCustomPortalResource: vi.fn(),
  createPortalAccessRequest: vi.fn(),
};

vi.mock("./db", () => dbMock);
vi.mock("./integrations/microsoftGraph", () => ({ synchronizeDelegatedEntraGroupMemberships: vi.fn() }));

const { portalAccessRouter } = await import("./routers/portalAccess");

function context(role: "user" | "admin" = "user"): TrpcContext {
  return {
    req: { headers: {}, protocol: "https" } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    user: { id: 7, openId: "local:policy-test", name: "Policy Test", email: "policy@example.test", loginMethod: "local", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    authState: "full",
    session: null,
  };
}

describe("portal access controls", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fails closed when a user calls a restricted custom page directly", async () => {
    dbMock.getPortalResourceByPath.mockResolvedValue({ id: 42, resourceKey: "page:business-planning", resourceType: "page", isPublished: true });
    dbMock.canAccessPortalResource.mockResolvedValue(false);
    await expect(portalAccessRouter.createCaller(context()).customPage({ slug: "business-planning" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns only server-filtered navigation resources while preserving restricted metadata for authorized UI markers", async () => {
    dbMock.listVisiblePortalResources.mockResolvedValue([{ id: 42, resourceKey: "module:business-management", label: "Business Management", path: "/business-management", accessMode: "restricted" }]);
    await expect(portalAccessRouter.createCaller(context()).navigation()).resolves.toEqual({ resources: [{ id: 42, resourceKey: "module:business-management", label: "Business Management", path: "/business-management", accessMode: "restricted" }] });
  });

  it("provides administrators the resource, assignment directory, and request queue data used by Business Management administration", async () => {
    dbMock.listPortalResources.mockResolvedValue([{ id: 42, resourceKey: "module:business-management", label: "Business Management" }]);
    dbMock.listEntraGroups.mockResolvedValue([{ groupId: "group-1", displayName: "Business leaders" }]);
    dbMock.listPortalUsersForAssignments.mockResolvedValue([{ id: 7, name: "Policy Test" }]);
    dbMock.listAccessControlAuditEvents.mockResolvedValue([]);
    dbMock.listPortalAccessRequests.mockResolvedValue([{ id: 3, resourceId: 42, requesterUserId: 9, status: "pending" }]);
    const overview = await portalAccessRouter.createCaller(context("admin")).adminOverview();
    expect(overview.resources[0]?.resourceKey).toBe("module:business-management");
    expect(overview.accessRequests).toHaveLength(1);
    expect(overview.groups[0]?.groupId).toBe("group-1");
  });

  it("blocks the Business Management API when the caller lacks its resource assignment", async () => {
    dbMock.canAccessPortalResource.mockResolvedValue(false);
    await expect(portalAccessRouter.createCaller(context()).businessManagement()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("does not allow an administrator API client to create arbitrary system-style modules", async () => {
    await expect(portalAccessRouter.createCaller(context("admin")).saveResource({
      resourceType: "module", resourceKey: "module:malformed", label: "Malformed", navigationGroup: "Workplace", iconKey: "file-text", body: null, accessMode: "all_authenticated", isPublished: true, sortOrder: 1, assignments: [],
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("accepts an access request only for a restricted resource that the caller cannot already open", async () => {
    dbMock.getPortalResourceByKey.mockResolvedValue({ id: 42, resourceKey: "page:business-planning", isPublished: true, accessMode: "restricted" });
    dbMock.canAccessPortalResource.mockResolvedValue(false);
    dbMock.createPortalAccessRequest.mockResolvedValue({ created: true, request: { id: 5 } });
    await expect(portalAccessRouter.createCaller(context()).requestAccess({ resourceKey: "page:business-planning", note: "Business planning responsibilities" })).resolves.toEqual({ created: true });
    expect(dbMock.createPortalAccessRequest).toHaveBeenCalledWith(expect.objectContaining({ resourceId: 42, requesterUserId: 7 }));
  });

  it("does not create a request for an all-user resource or a page already accessible to the caller", async () => {
    dbMock.getPortalResourceByKey.mockResolvedValue({ id: 42, resourceKey: "module:links", isPublished: true, accessMode: "all_authenticated" });
    await expect(portalAccessRouter.createCaller(context()).requestAccess({ resourceKey: "module:links" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    dbMock.getPortalResourceByKey.mockResolvedValue({ id: 43, resourceKey: "module:business-management", isPublished: true, accessMode: "restricted" });
    dbMock.canAccessPortalResource.mockResolvedValue(true);
    await expect(portalAccessRouter.createCaller(context()).requestAccess({ resourceKey: "module:business-management" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
