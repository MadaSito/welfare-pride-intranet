import { afterEach, describe, expect, it } from "vitest";
import { validateAiBaseUrl } from "./integrations/aiProvider";

describe("AI provider endpoint security", () => {
  const previous = process.env.AI_ALLOW_PRIVATE_ENDPOINTS;
  afterEach(() => { process.env.AI_ALLOW_PRIVATE_ENDPOINTS = previous; });

  it("accepts public HTTPS endpoints and strips URL credentials and fragments", () => {
    delete process.env.AI_ALLOW_PRIVATE_ENDPOINTS;
    expect(validateAiBaseUrl("https://user:secret@api.example.org/v1?token=hidden#fragment")).toBe("https://api.example.org/v1");
  });

  it("rejects plaintext and private endpoints by default", () => {
    delete process.env.AI_ALLOW_PRIVATE_ENDPOINTS;
    expect(() => validateAiBaseUrl("http://api.example.org")).toThrow(/HTTPS/);
    expect(() => validateAiBaseUrl("https://127.0.0.1:11434")).toThrow(/Private/);
    expect(() => validateAiBaseUrl("https://localhost:11434")).toThrow(/Private/);
  });

  it("allows an explicitly enabled private self-hosted endpoint", () => {
    process.env.AI_ALLOW_PRIVATE_ENDPOINTS = "true";
    expect(validateAiBaseUrl("http://127.0.0.1:11434")).toBe("http://127.0.0.1:11434");
  });
});
