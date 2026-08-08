import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { checksum } from "./integrations/backupAdapters";
import { appRouter } from "./routers";

function context(role: "user" | "admin"): TrpcContext {
  return {
    user: {
      id: 42,
      openId: "test-user",
      email: "employee@welfarepride.example",
      name: "Test Employee",
      loginMethod: "test",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("administrator authorization", () => {
  it("blocks a standard employee from Integration Settings", async () => {
    await expect(appRouter.createCaller(context("user")).adminSettings.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("validates typed restore confirmation before database access", async () => {
    await expect(appRouter.createCaller(context("admin")).backups.restore({ backupRunId: 1, confirmationValue: "NO" } as never)).rejects.toBeTruthy();
  });
});

describe("backup checksum controls", () => {
  it("produces deterministic SHA-256 checksums and detects changed content", () => {
    const original = checksum(Buffer.from("Welfare Pride backup artifact"));
    expect(original).toMatch(/^[a-f0-9]{64}$/);
    expect(checksum(Buffer.from("Welfare Pride backup artifact"))).toBe(original);
    expect(checksum(Buffer.from("Welfare Pride modified artifact"))).not.toBe(original);
  });
});
