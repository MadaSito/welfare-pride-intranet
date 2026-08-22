import { describe, expect, it } from "vitest";
import { router, protectedProcedure } from "./_core/trpc";
import type { TrpcContext } from "./_core/context";

const testRouter = router({
  guarded: protectedProcedure.query(() => ({ allowed: true })),
});

function context(authState: TrpcContext["authState"]): TrpcContext {
  return {
    req: { headers: {}, protocol: "https" } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    user: {
      id: 1,
      openId: "local:test",
      name: "Test Administrator",
      email: "admin@local.invalid",
      loginMethod: "local",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    authState,
    session: null,
  };
}

describe("restricted local sessions", () => {
  it("allows fully authenticated local sessions to use protected procedures", async () => {
    await expect(testRouter.createCaller(context("full")).guarded()).resolves.toEqual({ allowed: true });
  });

  it.each(["password_change_required", "mfa_enrollment_required", "mfa_verification_required"] as const)("blocks %s sessions from protected procedures", async authState => {
    await expect(testRouter.createCaller(context(authState)).guarded()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
