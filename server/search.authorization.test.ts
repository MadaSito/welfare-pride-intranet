import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  searchEmployeeProfiles: vi.fn(),
  searchPublishedAnnouncements: vi.fn(),
  canAccessPortalResource: vi.fn(),
  listAuthorizedSharePointDocuments: vi.fn(),
}));
vi.mock("./db", () => ({ searchEmployeeProfiles: mocks.searchEmployeeProfiles, searchPublishedAnnouncements: mocks.searchPublishedAnnouncements, canAccessPortalResource: mocks.canAccessPortalResource }));
vi.mock("./integrations/sharePoint", () => ({ listAuthorizedSharePointDocuments: mocks.listAuthorizedSharePointDocuments }));

import { searchRouter } from "./routers/search";

function context(userId: number) {
  return { user: { id: userId, role: "user" }, req: {}, res: {} } as any;
}

describe("unified search authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.searchEmployeeProfiles.mockResolvedValue([]);
    mocks.searchPublishedAnnouncements.mockResolvedValue([]);
    mocks.canAccessPortalResource.mockResolvedValue(true);
    mocks.listAuthorizedSharePointDocuments.mockResolvedValue([{ id: "doc-1", name: "Leave policy.pdf", webUrl: "https://sharepoint.example/doc-1", size: 100, mimeType: "application/pdf", lastModifiedAt: null, category: "Policies", isFolder: false }]);
  });

  it("derives SharePoint authorization from the authenticated user and returns bounded source labels", async () => {
    const result = await searchRouter.createCaller(context(73)).unified({ query: "leave policy", limitPerSource: 4 });
    expect(mocks.listAuthorizedSharePointDocuments).toHaveBeenCalledWith({ userId: 73, query: "leave policy" });
    expect(result.groups.documents).toEqual([expect.objectContaining({ source: "hr_documents", title: "Leave policy.pdf" })]);
    expect(result.results).toHaveLength(1);
  });

  it("does not query or return a source that the user cannot access", async () => {
    mocks.canAccessPortalResource.mockImplementation(({ resourceKey }: { resourceKey: string }) => Promise.resolve(resourceKey !== "module:hr"));
    const result = await searchRouter.createCaller(context(73)).unified({ query: "leave policy", limitPerSource: 4 });
    expect(mocks.listAuthorizedSharePointDocuments).not.toHaveBeenCalled();
    expect(result.groups.documents).toEqual([]);
    expect(result.sourceStatus.documents).toBe("restricted");
  });
});
