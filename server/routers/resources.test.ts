import { describe, expect, it } from "vitest";
import { validateTechnologyEmbed } from "./resources";

describe("secure Technology embeds", () => {
  it("accepts HTTPS only when the URL host exactly matches the allowlist", () => {
    expect(validateTechnologyEmbed("https://technology.example.org/app?mode=secure", "technology.example.org")).toEqual({
      url: "https://technology.example.org/app?mode=secure",
      allowedHostname: "technology.example.org",
    });
  });

  it.each([
    ["http://technology.example.org/app", "technology.example.org"],
    ["https://evil.example.org/app", "technology.example.org"],
    ["https://localhost/app", "localhost"],
    ["https://10.0.0.5/app", "10.0.0.5"],
  ])("rejects unsafe embed target %s", (url, host) => {
    expect(() => validateTechnologyEmbed(url, host)).toThrow();
  });

  it("removes URL credentials before persistence", () => {
    expect(validateTechnologyEmbed("https://user:password@technology.example.org/app", "technology.example.org").url).toBe("https://technology.example.org/app");
  });
});
