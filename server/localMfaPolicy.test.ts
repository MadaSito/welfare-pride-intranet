import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listLocalMfaPolicies: vi.fn(),
  setLocalMfaRequired: vi.fn(),
}));

vi.mock("./db", () => ({
  listLocalMfaPolicies: mocks.listLocalMfaPolicies,
  setLocalMfaRequired: mocks.setLocalMfaRequired,
}));

import { localAuthRouter } from "./routers/localAuth";

function adminContext() {
  return {
    user: {
      id: 7,
      openId: "local:admin",
      name: "Local Administrator",
      email: "admin@local.invalid",
      loginMethod: "local",
      role: "admin" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    authState: "full" as const,
    session: null,
    req: { headers: {}, protocol: "https" },
    res: {},
  } as any;
}

describe("administrator local MFA policy", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the administrator-visible local MFA policy list", async () => {
    const policies = [{ userId: 7, email: "admin@local.invalid", mfaRequired: true, mfaEnabled: true, mfaEnrolledAt: new Date(), mustChangePassword: false }];
    mocks.listLocalMfaPolicies.mockResolvedValue(policies);
    await expect(localAuthRouter.createCaller(adminContext()).listLocalMfaPolicies()).resolves.toEqual(policies);
  });

  it("persists an administrator MFA requirement change for a specified local user", async () => {
    await expect(localAuthRouter.createCaller(adminContext()).setMfaRequirement({ userId: 12, required: true })).resolves.toEqual({ success: true });
    expect(mocks.setLocalMfaRequired).toHaveBeenCalledWith({ userId: 12, required: true });
  });
});
