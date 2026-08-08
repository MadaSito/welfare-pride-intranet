import { describe, expect, it } from "vitest";
import { sanitizeDiagnosticError } from "./diagnostics";

describe("diagnostic sanitization", () => {
  it("redacts token-like query values and limits stored message length", () => {
    const message = sanitizeDiagnosticError(new Error(`Connection failed token=abc123 secret=xyz ${"x".repeat(1200)}`));
    expect(message).toContain("token=[redacted]");
    expect(message).toContain("secret=[redacted]");
    expect(message).not.toContain("abc123");
    expect(message.length).toBeLessThanOrEqual(800);
  });
});
