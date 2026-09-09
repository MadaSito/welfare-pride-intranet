import { describe, expect, it } from "vitest";
import { evaluateIpPolicies, FixedWindowRateLimiter, isSuspiciousRequestPath, normalizeClientIp } from "./securityCenter";

const activePolicies = [
  { id: 1, mode: "allow" as const, ipAddress: "203.0.113.10" },
  { id: 2, mode: "block" as const, ipAddress: "203.0.113.10" },
] as Awaited<ReturnType<typeof import("../db").listActiveSecurityIpPolicies>>;

describe("Security Center IP enforcement", () => {
  it("normalizes valid client addresses and rejects malformed input", () => {
    expect(normalizeClientIp("::ffff:203.0.113.10")).toBe("203.0.113.10");
    expect(normalizeClientIp("[2001:db8::1]")).toBe("2001:db8::1");
    expect(normalizeClientIp("203.0.113.10, 198.51.100.2")).toBe("unknown");
    expect(normalizeClientIp("not-an-ip")).toBe("unknown");
  });

  it("gives a block policy precedence over an allow policy", () => {
    expect(evaluateIpPolicies({ ipAddress: "203.0.113.10", allowlistEnabled: false, policies: activePolicies })).toEqual({ allowed: false, reason: "blocked_ip" });
  });

  it("rejects unlisted addresses only when allowlist-only mode is active", () => {
    expect(evaluateIpPolicies({ ipAddress: "198.51.100.2", allowlistEnabled: false, policies: [] })).toEqual({ allowed: true, reason: "allowed" });
    expect(evaluateIpPolicies({ ipAddress: "198.51.100.2", allowlistEnabled: true, policies: [] })).toEqual({ allowed: false, reason: "allowlist_rejected" });
  });
});

describe("Security Center threat controls", () => {
  it("limits requests within a fixed window and tracks independent keys", () => {
    const limiter = new FixedWindowRateLimiter();
    expect(limiter.consume("203.0.113.10", 2, 60_000).allowed).toBe(true);
    expect(limiter.consume("203.0.113.10", 2, 60_000).allowed).toBe(true);
    expect(limiter.consume("203.0.113.10", 2, 60_000)).toMatchObject({ allowed: false, firstDenied: true });
    expect(limiter.consume("203.0.113.10", 2, 60_000)).toMatchObject({ allowed: false, firstDenied: false });
    expect(limiter.consume("198.51.100.2", 2, 60_000).allowed).toBe(true);
  });

  it("recognizes high-signal traversal, script, and exposed-admin probes", () => {
    expect(isSuspiciousRequestPath("/api/%2e%2e%2f.env")).toBe(true);
    expect(isSuspiciousRequestPath("/wp-login.php")).toBe(true);
    expect(isSuspiciousRequestPath("/search?q=%3Cscript%3E")).toBe(true);
    expect(isSuspiciousRequestPath("/announcements")).toBe(false);
  });
});
