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
  getPortalResourceAssignments: vi.fn(),
  upsertEntraGroup: vi.fn(),
  savePortalResource: vi.fn(),
  replacePortalResourceAssignments: vi.fn(),
  appendAccessControlAuditEvent: vi.fn(),
  deleteCustomPortalResource: vi.fn(),
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

  it("blocks the Business Management API when the caller lacks its resource assignment", async () => {
    dbMock.canAccessPortalResource.mockResolvedValue(false);
    await expect(portalAccessRouter.createCaller(context()).businessManagement()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("does not allow an administrator API client to create arbitrary system-style modules", async () => {
    await expect(portalAccessRouter.createCaller(context("admin")).saveResource({
      resourceType: "module", resourceKey: "module:malformed", label: "Malformed", navigationGroup: "Workplace", iconKey: "file-text", body: null, accessMode: "all_authenticated", isPublished: true, sortOrder: 1, assignments: [],
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
