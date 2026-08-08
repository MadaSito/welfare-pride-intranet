import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasLocalCredential: vi.fn(),
  createInitialLocalAdmin: vi.fn(),
  getLocalCredentialByEmail: vi.fn(),
  recordLocalLoginFailure: vi.fn(),
  clearLocalLoginFailures: vi.fn(),
  upsertUser: vi.fn(),
  issueAppSession: vi.fn(),
  revokeRequestSession: vi.fn(),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
  validateStrongPassword: vi.fn(),
}));

vi.mock("./db", () => ({
  hasLocalCredential: mocks.hasLocalCredential,
  createInitialLocalAdmin: mocks.createInitialLocalAdmin,
  getLocalCredentialByEmail: mocks.getLocalCredentialByEmail,
  recordLocalLoginFailure: mocks.recordLocalLoginFailure,
  clearLocalLoginFailures: mocks.clearLocalLoginFailures,
  upsertUser: mocks.upsertUser,
}));
vi.mock("./auth/session", () => ({ issueAppSession: mocks.issueAppSession, revokeRequestSession: mocks.revokeRequestSession }));
vi.mock("./auth/passwords", () => ({ hashPassword: mocks.hashPassword, verifyPassword: mocks.verifyPassword, validateStrongPassword: mocks.validateStrongPassword }));

import { localAuthRouter } from "./routers/localAuth";

function context() {
  return {
    user: null,
    req: { protocol: "https", headers: {} },
    res: { cookie: vi.fn(), clearCookie: vi.fn() },
  } as any;
}

describe("portable local authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INITIAL_SETUP_TOKEN = "correct-one-time-token";
    mocks.validateStrongPassword.mockReturnValue(null);
    mocks.hashPassword.mockResolvedValue({ passwordHash: "hash", passwordSalt: "salt" });
  });

  it("reports setup as required only while no local credential exists", async () => {
    mocks.hasLocalCredential.mockResolvedValue(false);
    await expect(localAuthRouter.createCaller(context()).status()).resolves.toEqual({ setupRequired: true, setupTokenConfigured: true });
    mocks.hasLocalCredential.mockResolvedValue(true);
    await expect(localAuthRouter.createCaller(context()).status()).resolves.toEqual({ setupRequired: false, setupTokenConfigured: true });
  });

  it("rejects an incorrect setup token before creating a credential", async () => {
    mocks.hasLocalCredential.mockResolvedValue(false);
    await expect(localAuthRouter.createCaller(context()).setupOwner({ name: "Portal Owner", email: "owner@example.org", password: "ValidPassword!123", setupToken: "wrong-token" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.createInitialLocalAdmin).not.toHaveBeenCalled();
  });

  it("creates the first administrator and issues a revocable application session", async () => {
    const user = { id: 41, openId: "local:owner", name: "Portal Owner", email: "owner@example.org", role: "admin" };
    mocks.hasLocalCredential.mockResolvedValue(false);
    mocks.createInitialLocalAdmin.mockResolvedValue(user);
    const ctx = context();
    await expect(localAuthRouter.createCaller(ctx).setupOwner({ name: "Portal Owner", email: "Owner@Example.org", password: "ValidPassword!123", setupToken: "correct-one-time-token" })).resolves.toMatchObject({ success: true, user });
    expect(mocks.createInitialLocalAdmin).toHaveBeenCalledWith(expect.objectContaining({ email: "owner@example.org", passwordHash: "hash", passwordSalt: "salt" }));
    expect(mocks.issueAppSession).toHaveBeenCalledWith(ctx.req, ctx.res, 41);
  });

  it("increments failed login attempts without revealing account existence", async () => {
    mocks.getLocalCredentialByEmail.mockResolvedValue({ credential: { id: 8, passwordHash: "hash", passwordSalt: "salt", failedAttempts: 2, lockedUntil: null }, user: { id: 41 } });
    mocks.verifyPassword.mockResolvedValue(false);
    await expect(localAuthRouter.createCaller(context()).login({ email: "owner@example.org", password: "incorrect" })).rejects.toMatchObject({ code: "UNAUTHORIZED", message: "Email or password is incorrect." });
    expect(mocks.recordLocalLoginFailure).toHaveBeenCalledWith(8, 3, null);
  });
});
