import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAiProviderStatus: vi.fn(),
  invokeAiProvider: vi.fn(),
  retrieveAssistantSources: vi.fn(),
}));
vi.mock("./integrations/aiProvider", () => ({ getAiProviderStatus: mocks.getAiProviderStatus, invokeAiProvider: mocks.invokeAiProvider }));
vi.mock("./integrations/assistantRetrieval", () => ({ retrieveAssistantSources: mocks.retrieveAssistantSources }));

import { assistantRouter } from "./routers/assistant";

function context(userId: number) {
  return { user: { id: userId, role: "user" }, req: {}, res: {} } as any;
}

describe("assistant retrieval boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAiProviderStatus.mockResolvedValue({ configured: true, providerName: "Test provider", model: "test-model" });
  });

  it("retrieves sources using only the authenticated employee identity and returns citations", async () => {
    mocks.retrieveAssistantSources.mockResolvedValue([{ id: "hr:doc-1", type: "hr_document", title: "Leave policy", url: "https://sharepoint.example/doc-1", content: "Employees submit requests through the HR portal." }]);
    mocks.invokeAiProvider.mockResolvedValue("Submit the request through the HR portal. [S1]");
    const result = await assistantRouter.createCaller(context(88)).ask({ question: "How do I request leave?", history: [] });
    expect(mocks.retrieveAssistantSources).toHaveBeenCalledWith(88, "How do I request leave?");
    expect(result.sources).toEqual([{ id: "S1", type: "hr_document", title: "Leave policy", url: "https://sharepoint.example/doc-1" }]);
    expect(mocks.invokeAiProvider).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ role: "system" }), expect.objectContaining({ role: "user", content: expect.stringContaining("[S1] Leave policy") })]));
  });

  it("does not call the model when no authorized source can answer", async () => {
    mocks.retrieveAssistantSources.mockResolvedValue([]);
    const result = await assistantRouter.createCaller(context(89)).ask({ question: "Show me another employee's private file", history: [] });
    expect(result.sources).toEqual([]);
    expect(mocks.invokeAiProvider).not.toHaveBeenCalled();
  });
});
