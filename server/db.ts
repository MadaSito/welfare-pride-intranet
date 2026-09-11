import { and, asc, desc, eq, gt, gte, inArray, isNotNull, isNull, like, lt, lte, notInArray, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2";
import { summarizeAuditAnalytics } from "./audit/auditAnalytics";
import {
  employeeProfiles,
  announcements,
  companyEvents,
  dashboardPins,
  holidays,
  technologyEmbeds,
  importantLinks,
  emailTemplates,
  emailDeliveries,
  contentBlocks,
  founders,
  milestones,
  InsertUser,
  integrationSettings,
  connectionDiagnostics,
  backupDestinations,
  backupRuns,
  restoreRuns,
  operationAuditEvents,
  appSessions,
  localCredentials,
  microsoftOauthSessions,
  samlRequestCorrelations,
  users,
  entraGroups,
  userEntraGroupMemberships,
  portalResources,
  portalResourceAssignments,
  portalAccessRequests,
  adminAccessRequestNotifications,
  accessControlAuditEvents,
  securityEvents,
  securityIpPolicies,
  securitySettings,
  securityAlertNotifications,
  securityEventReadCursors,
  securityEscalationOwners,
  securityIncidentCases,
  portalRoles,
  portalUserRoleAssignments,
} from "../drizzle/schema";
import { projectBirthdayDisplays } from "./privacy/birthdays";
import { buildSecurityAnalytics } from "./security/securityAnalytics";
import { shouldTriggerHighSeverityAlert } from "./security/securityAlerts";
import { BUILT_IN_PORTAL_RESOURCES, type PortalAssignmentSubjectType, type PortalResourceAccessMode } from "../shared/portalAccess";
import { INTRANET_PORTAL_MANAGER_PERMISSIONS, type PortalPermission } from "../shared/roles";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: mysql.Pool | null = null;

export function databaseConnectionOptions(connectionString: string): string | mysql.PoolOptions {
  if (process.env.DATABASE_SSL?.toLowerCase() !== "true") return connectionString;

  const parsed = new URL(connectionString);
  if (parsed.protocol !== "mysql:" || !parsed.hostname || !parsed.pathname || parsed.pathname === "/") {
    throw new Error("DATABASE_URL must be a valid mysql:// URL when DATABASE_SSL=true.");
  }

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: decodeURIComponent(parsed.pathname.slice(1)),
    waitForConnections: true,
    connectionLimit: Math.max(1, Number(process.env.DATABASE_CONNECTION_LIMIT || 10)),
    ssl: { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" },
  };
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const options = databaseConnectionOptions(process.env.DATABASE_URL);
      if (typeof options === "string") {
        _db = drizzle(options);
      } else {
        _pool = mysql.createPool(options);
        _db = drizzle({ client: _pool });
      }
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function hasLocalCredential() {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select({ id: localCredentials.id }).from(localCredentials).limit(1);
  return result.length > 0;
}

export async function createInitialLocalAdmin(input: {
  openId: string;
  name: string;
  email: string;
  credentialLogin?: string;
  passwordHash: string;
  passwordSalt: string;
  mustChangePassword?: boolean;
  mfaRequired?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.transaction(async tx => {
    const existing = await tx.select({ id: localCredentials.id }).from(localCredentials).limit(1);
    if (existing.length) throw new Error("Owner setup is already complete");
    await tx.insert(users).values({
      openId: input.openId,
      name: input.name,
      email: input.email,
      loginMethod: "local",
      role: "admin",
      lastSignedIn: new Date(),
    });
    const [user] = await tx.select().from(users).where(eq(users.openId, input.openId)).limit(1);
    if (!user) throw new Error("Owner account could not be created");
    await tx.insert(localCredentials).values({
      userId: user.id,
      email: input.credentialLogin ?? input.email,
      passwordHash: input.passwordHash,
      passwordSalt: input.passwordSalt,
      mustChangePassword: input.mustChangePassword ?? false,
      mfaRequired: input.mfaRequired ?? true,
    });
    await tx.insert(employeeProfiles).values({
      userId: user.id,
      displayName: input.name,
      email: input.email,
      source: "local",
    });
    return user;
  });
}

export async function createManagedLocalUser(input: { openId: string; name: string; email: string; role: "user" | "admin"; passwordHash: string; passwordSalt: string; mfaRequired: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.transaction(async tx => {
    const [existingUser] = await tx.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
    const [existingCredential] = await tx.select({ id: localCredentials.id }).from(localCredentials).where(eq(localCredentials.email, input.email)).limit(1);
    if (existingUser || existingCredential) throw new Error("A portal account already uses this email address.");
    await tx.insert(users).values({ openId: input.openId, name: input.name, email: input.email, loginMethod: "local", role: input.role, lastSignedIn: new Date() });
    const [user] = await tx.select().from(users).where(eq(users.openId, input.openId)).limit(1);
    if (!user) throw new Error("Local account could not be created.");
    await tx.insert(localCredentials).values({ userId: user.id, email: input.email, passwordHash: input.passwordHash, passwordSalt: input.passwordSalt, mustChangePassword: true, mfaRequired: input.mfaRequired });
    await tx.insert(employeeProfiles).values({ userId: user.id, displayName: input.name, email: input.email, source: "local" });
    return user;
  });
}

export async function ensureSystemPortalRoles() {
  const db = await getDb();
  if (!db) return;
  await db.insert(portalRoles).values({ name: "Intranet Portal Manager", description: "Manages portal content, approvals, resources, backups, email operations, and audit review without full administrator access.", permissionsJson: JSON.stringify(INTRANET_PORTAL_MANAGER_PERMISSIONS), isSystem: true }).onDuplicateKeyUpdate({ set: { name: sql`${portalRoles.name}` } });
}

function parsePortalPermissions(value: string): PortalPermission[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is PortalPermission => typeof item === "string") : [];
  } catch { return []; }
}

export async function listPortalRoles() {
  await ensureSystemPortalRoles();
  const db = await getDb();
  if (!db) return [];
  return db.select().from(portalRoles).orderBy(desc(portalRoles.isSystem), asc(portalRoles.name));
}

export async function listPortalRoleAssignments() {
  await ensureSystemPortalRoles();
  const db = await getDb();
  if (!db) return [];
  return db.select({ userId: portalUserRoleAssignments.userId, roleId: portalUserRoleAssignments.roleId, roleName: portalRoles.name }).from(portalUserRoleAssignments).innerJoin(portalRoles, eq(portalUserRoleAssignments.roleId, portalRoles.id));
}

export async function savePortalRole(input: { id?: number; name: string; description?: string | null; permissions: PortalPermission[]; actorUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  if (input.id) {
    const existing = (await db.select().from(portalRoles).where(eq(portalRoles.id, input.id)).limit(1))[0];
    if (!existing) throw new Error("Portal role not found.");
    if (existing.isSystem && existing.name !== input.name) throw new Error("The built-in Intranet Portal Manager role name cannot be changed.");
    await db.update(portalRoles).set({ name: input.name, description: input.description ?? null, permissionsJson: JSON.stringify(input.permissions) }).where(eq(portalRoles.id, input.id));
    return (await db.select().from(portalRoles).where(eq(portalRoles.id, input.id)).limit(1))[0];
  }
  const result = await db.insert(portalRoles).values({ name: input.name, description: input.description ?? null, permissionsJson: JSON.stringify(input.permissions), createdByUserId: input.actorUserId });
  return (await db.select().from(portalRoles).where(eq(portalRoles.id, Number(result[0].insertId))).limit(1))[0];
}

export async function replaceUserPortalRoles(input: { userId: number; roleIds: number[]; actorUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const uniqueRoleIds = Array.from(new Set(input.roleIds));
  if (uniqueRoleIds.length) {
    const existing = await db.select({ id: portalRoles.id }).from(portalRoles).where(inArray(portalRoles.id, uniqueRoleIds));
    if (existing.length !== uniqueRoleIds.length) throw new Error("One or more selected portal roles do not exist.");
  }
  await db.transaction(async tx => {
    await tx.delete(portalUserRoleAssignments).where(eq(portalUserRoleAssignments.userId, input.userId));
    if (uniqueRoleIds.length) await tx.insert(portalUserRoleAssignments).values(uniqueRoleIds.map(roleId => ({ userId: input.userId, roleId, assignedByUserId: input.actorUserId })));
  });
}

export async function userHasPortalPermission(userId: number, permission: PortalPermission) {
  const db = await getDb();
  if (!db) return false;
  const assigned = await db.select({ permissionsJson: portalRoles.permissionsJson }).from(portalUserRoleAssignments).innerJoin(portalRoles, eq(portalUserRoleAssignments.roleId, portalRoles.id)).where(eq(portalUserRoleAssignments.userId, userId));
  return assigned.some(role => parsePortalPermissions(role.permissionsJson).includes(permission));
}

export async function getUserPortalPermissions(userId: number) {
  const db = await getDb();
  if (!db) return [] as PortalPermission[];
  const assigned = await db.select({ permissionsJson: portalRoles.permissionsJson }).from(portalUserRoleAssignments).innerJoin(portalRoles, eq(portalUserRoleAssignments.roleId, portalRoles.id)).where(eq(portalUserRoleAssignments.userId, userId));
  return Array.from(new Set(assigned.flatMap(role => parsePortalPermissions(role.permissionsJson))));
}

export async function getLocalCredentialByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [result] = await db
    .select({ credential: localCredentials, user: users })
    .from(localCredentials)
    .innerJoin(users, eq(localCredentials.userId, users.id))
    .where(eq(localCredentials.email, email.toLowerCase()))
    .limit(1);
  return result;
}

export async function recordLocalLoginFailure(credentialId: number, failedAttempts: number, lockedUntil: Date | null) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(localCredentials).set({ failedAttempts, lockedUntil }).where(eq(localCredentials.id, credentialId));
}

export async function clearLocalLoginFailures(credentialId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(localCredentials).set({ failedAttempts: 0, lockedUntil: null }).where(eq(localCredentials.id, credentialId));
}

export async function getLocalCredentialByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [credential] = await db.select().from(localCredentials).where(eq(localCredentials.userId, userId)).limit(1);
  return credential;
}

export async function updateLocalPassword(input: {
  credentialId: number;
  passwordHash: string;
  passwordSalt: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(localCredentials).set({
    passwordHash: input.passwordHash,
    passwordSalt: input.passwordSalt,
    mustChangePassword: false,
    passwordChangedAt: new Date(),
    failedAttempts: 0,
    lockedUntil: null,
  }).where(eq(localCredentials.id, input.credentialId));
}

export async function savePendingTotpSecret(credentialId: number, encryptedSecret: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(localCredentials).set({
    totpSecretEncrypted: encryptedSecret,
    mfaEnabled: false,
    mfaEnrolledAt: null,
  }).where(eq(localCredentials.id, credentialId));
}

export async function enableLocalMfa(input: {
  credentialId: number;
  encryptedRecoveryCodes: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(localCredentials).set({
    recoveryCodesEncrypted: input.encryptedRecoveryCodes,
    mfaEnabled: true,
    mfaRequired: true,
    mfaEnrolledAt: new Date(),
  }).where(eq(localCredentials.id, input.credentialId));
}

export async function consumeRecoveryCode(credentialId: number, encryptedRecoveryCodes: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(localCredentials).set({ recoveryCodesEncrypted: encryptedRecoveryCodes }).where(eq(localCredentials.id, credentialId));
}

export async function setLocalMfaRequired(input: { userId: number; required: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(localCredentials).set({ mfaRequired: input.required }).where(eq(localCredentials.userId, input.userId));
}

export async function updateManagedLocalUserLifecycle(input: { userId: number; loginDisabled: boolean; identityProvider: "local" | "entra" | "oidc" | "saml"; resetMfa: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const patch: Partial<typeof localCredentials.$inferInsert> = {
    loginDisabled: input.identityProvider === "local" ? input.loginDisabled : true,
    identityProvider: input.identityProvider,
  };
  if (input.resetMfa) {
    patch.totpSecretEncrypted = null;
    patch.recoveryCodesEncrypted = null;
    patch.mfaEnabled = false;
    patch.mfaEnrolledAt = null;
  }
  await db.update(localCredentials).set(patch).where(eq(localCredentials.userId, input.userId));
  await revokeAllAppSessionsForUser(input.userId);
}

export async function listLocalMfaPolicies() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      userId: users.id,
      name: users.name,
      email: localCredentials.email,
      role: users.role,
      mfaRequired: localCredentials.mfaRequired,
      mfaEnabled: localCredentials.mfaEnabled,
      mfaEnrolledAt: localCredentials.mfaEnrolledAt,
      mustChangePassword: localCredentials.mustChangePassword,
      loginDisabled: localCredentials.loginDisabled,
      identityProvider: localCredentials.identityProvider,
    })
    .from(localCredentials)
    .innerJoin(users, eq(localCredentials.userId, users.id))
    .orderBy(asc(localCredentials.email));
}

export async function listPortalUsersForAssignments() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, loginMethod: users.loginMethod })
    .from(users)
    .orderBy(asc(users.name), asc(users.email));
}

export async function createAppSessionRecord(input: {
  userId: number;
  tokenHash: string;
  expiresAt: Date;
  authState?: "full" | "password_change_required" | "mfa_enrollment_required" | "mfa_verification_required";
  userAgentHash?: string | null;
  ipHash?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(appSessions).values(input);
}

export async function getActiveAppSession(tokenHash: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [result] = await db
    .select({ session: appSessions, user: users })
    .from(appSessions)
    .innerJoin(users, eq(appSessions.userId, users.id))
    .where(and(eq(appSessions.tokenHash, tokenHash), isNull(appSessions.revokedAt), gt(appSessions.expiresAt, new Date())))
    .limit(1);
  return result;
}

export async function touchAppSession(sessionId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(appSessions).set({ lastSeenAt: new Date() }).where(eq(appSessions.id, sessionId));
}

export async function revokeAppSession(tokenHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(appSessions).set({ revokedAt: new Date() }).where(eq(appSessions.tokenHash, tokenHash));
}

export async function revokeAllAppSessionsForUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(appSessions).set({ revokedAt: new Date() }).where(and(eq(appSessions.userId, userId), isNull(appSessions.revokedAt)));
}

export async function getIntegrationSettingByProvider(provider: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(integrationSettings)
    .where(eq(integrationSettings.provider, provider))
    .limit(1);
  return result[0];
}

export async function upsertIntegrationSetting(input: {
  provider: string;
  displayName: string;
  publicConfigJson: string;
  encryptedSecrets?: string | null;
  secretMaskJson?: string | null;
  status: "unconfigured" | "configured" | "connected" | "degraded" | "error";
  updatedByUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .insert(integrationSettings)
    .values(input)
    .onDuplicateKeyUpdate({
      set: {
        displayName: input.displayName,
        publicConfigJson: input.publicConfigJson,
        ...(input.encryptedSecrets !== undefined ? { encryptedSecrets: input.encryptedSecrets } : {}),
        ...(input.secretMaskJson !== undefined ? { secretMaskJson: input.secretMaskJson } : {}),
        status: input.status,
        updatedByUserId: input.updatedByUserId,
      },
    });
}

export async function listIntegrationSettings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(integrationSettings).orderBy(asc(integrationSettings.displayName));
}

export async function updateIntegrationConnectionStatus(
  provider: string,
  status: "unconfigured" | "configured" | "connected" | "degraded" | "error",
) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(integrationSettings).set({ status, lastTestedAt: new Date() }).where(eq(integrationSettings.provider, provider));
}

export async function createConnectionDiagnostic(input: typeof connectionDiagnostics.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(connectionDiagnostics).values(input);
  return Number(result[0].insertId);
}

export async function listConnectionDiagnostics(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(connectionDiagnostics).orderBy(desc(connectionDiagnostics.createdAt)).limit(limit);
}

export async function listBackupDestinations() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(backupDestinations).orderBy(asc(backupDestinations.provider), asc(backupDestinations.displayName));
}

export async function getBackupDestinationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(backupDestinations).where(eq(backupDestinations.id, id)).limit(1))[0];
}

export async function upsertBackupDestination(input: {
  provider: string;
  displayName: string;
  publicConfigJson: string;
  encryptedSecrets?: string | null;
  secretMaskJson?: string | null;
  isEnabled: boolean;
  status: "unconfigured" | "configured" | "connected" | "degraded" | "error";
  backupScope: "configuration" | "configuration_and_secrets" | "secrets_only" | "full_platform";
  localRetentionDays: number;
  createdByUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(backupDestinations).values(input).onDuplicateKeyUpdate({ set: {
    publicConfigJson: input.publicConfigJson,
    ...(input.encryptedSecrets !== undefined ? { encryptedSecrets: input.encryptedSecrets } : {}),
    ...(input.secretMaskJson !== undefined ? { secretMaskJson: input.secretMaskJson } : {}),
    isEnabled: input.isEnabled,
    status: input.status,
    backupScope: input.backupScope,
    localRetentionDays: input.localRetentionDays,
    createdByUserId: input.createdByUserId,
  } });
  return (await db.select().from(backupDestinations).where(and(eq(backupDestinations.provider, input.provider), eq(backupDestinations.displayName, input.displayName))).limit(1))[0];
}

export async function updateBackupDestinationConnectionStatus(
  id: number,
  status: "unconfigured" | "configured" | "connected" | "degraded" | "error",
) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(backupDestinations).set({ status, lastTestedAt: new Date() }).where(eq(backupDestinations.id, id));
}

export async function setBackupDestinationSchedule(id: number, scheduleCron: string, enabled = true) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(backupDestinations).set({ scheduleCron, scheduleEnabled: enabled, scheduleCronTaskUid: null }).where(eq(backupDestinations.id, id));
}

export async function setBackupDestinationScheduleEnabled(id: number, scheduleEnabled: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(backupDestinations).set({ scheduleEnabled }).where(eq(backupDestinations.id, id));
}

export async function clearBackupDestinationSchedule(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(backupDestinations).set({ scheduleCron: null, scheduleEnabled: false, scheduleCronTaskUid: null }).where(eq(backupDestinations.id, id));
}

export async function listEnabledBackupSchedules() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(backupDestinations).where(and(eq(backupDestinations.isEnabled, true), eq(backupDestinations.scheduleEnabled, true)));
}

export async function markBackupScheduleDispatched(id: number, dispatchedAt: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(backupDestinations).set({ lastScheduledDispatchAt: dispatchedAt }).where(eq(backupDestinations.id, id));
}

export async function createBackupRun(input: typeof backupRuns.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(backupRuns).values(input);
  return Number(result[0].insertId);
}

export async function updateBackupRun(id: number, patch: Partial<typeof backupRuns.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(backupRuns).set(patch).where(eq(backupRuns.id, id));
}

export async function getBackupRunById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(backupRuns).where(eq(backupRuns.id, id)).limit(1))[0];
}

export async function listBackupRuns(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(backupRuns).orderBy(desc(backupRuns.startedAt)).limit(limit);
}

export async function getLatestBackupRunForDestination(destinationId: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (
    await db
      .select()
      .from(backupRuns)
      .where(eq(backupRuns.destinationId, destinationId))
      .orderBy(desc(backupRuns.startedAt))
      .limit(1)
  )[0];
}

export async function listExpiredLocalBackupRuns(destinationId: number, cutoff: Date) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(backupRuns).where(and(eq(backupRuns.destinationId, destinationId), lt(backupRuns.completedAt, cutoff), isNotNull(backupRuns.localArtifactPath)));
}

export async function buildBackupSnapshot(scope: "configuration" | "configuration_and_secrets" | "secrets_only" | "full_platform") {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const integrations = await db.select().from(integrationSettings);
  const encryptedIntegrations = integrations.map(item => ({ provider: item.provider, displayName: item.displayName, publicConfigJson: scope === "secrets_only" ? null : item.publicConfigJson, encryptedSecrets: item.encryptedSecrets, secretMaskJson: item.secretMaskJson, status: item.status, updatedAt: item.updatedAt }));
  const base = { schemaVersion: 2, createdAt: new Date().toISOString(), scope, integrationSettings: scope === "configuration" ? integrations.map(item => ({ provider: item.provider, displayName: item.displayName, publicConfigJson: item.publicConfigJson, secretMaskJson: item.secretMaskJson, status: item.status, updatedAt: item.updatedAt })) : encryptedIntegrations };
  if (scope !== "full_platform") return base;
  return {
    ...base,
    portalResources: await db.select().from(portalResources), portalResourceAssignments: await db.select().from(portalResourceAssignments),
    portalRoles: await db.select().from(portalRoles), portalUserRoleAssignments: await db.select().from(portalUserRoleAssignments),
    employeeProfiles: await db.select().from(employeeProfiles), announcements: await db.select().from(announcements), companyEvents: await db.select().from(companyEvents), holidays: await db.select().from(holidays),
    importantLinks: await db.select().from(importantLinks), contentBlocks: await db.select().from(contentBlocks), founders: await db.select().from(founders), milestones: await db.select().from(milestones), technologyEmbeds: await db.select().from(technologyEmbeds),
    backupDestinations: await db.select().from(backupDestinations), users: await db.select().from(users), localCredentials: await db.select().from(localCredentials), securitySettings: await db.select().from(securitySettings),
  };
}

export async function createRestoreRun(input: typeof restoreRuns.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(restoreRuns).values(input);
  return Number(result[0].insertId);
}

export async function updateRestoreRun(id: number, patch: Partial<typeof restoreRuns.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(restoreRuns).set(patch).where(eq(restoreRuns.id, id));
}

export async function listRestoreRuns(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(restoreRuns).orderBy(desc(restoreRuns.createdAt)).limit(limit);
}

export async function appendOperationAuditEvent(input: typeof operationAuditEvents.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(operationAuditEvents).values(input);
  return Number(result[0].insertId);
}

export async function listOperationAuditEvents(limit = 200) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(operationAuditEvents).orderBy(desc(operationAuditEvents.createdAt)).limit(limit);
}

export async function searchOperationAuditEvents(input: { entityType?: string; eventType?: string; status?: string; query?: string; from?: Date; to?: Date; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (input.entityType) conditions.push(eq(operationAuditEvents.entityType, input.entityType));
  if (input.eventType) conditions.push(eq(operationAuditEvents.eventType, input.eventType));
  if (input.status) conditions.push(eq(operationAuditEvents.status, input.status));
  if (input.from) conditions.push(gte(operationAuditEvents.createdAt, input.from));
  if (input.to) conditions.push(lte(operationAuditEvents.createdAt, input.to));
  const query = input.query?.trim();
  if (query) { const pattern = `%${query.slice(0, 120)}%`; conditions.push(or(like(operationAuditEvents.entityType, pattern), like(operationAuditEvents.eventType, pattern), like(operationAuditEvents.message, pattern), like(operationAuditEvents.metadataJson, pattern))); }
  return db.select().from(operationAuditEvents).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(operationAuditEvents.createdAt)).limit(Math.min(Math.max(input.limit || 200, 1), 500));
}

export async function getOperationAuditAnalytics(days = 30) {
  const boundedDays = Math.min(Math.max(days, 1), 30);
  const to = new Date();
  const from = new Date(to.getTime() - boundedDays * 24 * 60 * 60 * 1000);
  const events = await searchOperationAuditEvents({ from, to, limit: 500 });
  return { windowDays: boundedDays, from, to, ...summarizeAuditAnalytics(events) };
}

export async function upsertMicrosoftOauthSession(input: {
  userId: number;
  tenantId: string;
  encryptedTokenSet: string;
  scopes?: string | null;
  accessTokenExpiresAt?: Date | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .insert(microsoftOauthSessions)
    .values(input)
    .onDuplicateKeyUpdate({
      set: {
        tenantId: input.tenantId,
        encryptedTokenSet: input.encryptedTokenSet,
        scopes: input.scopes ?? null,
        accessTokenExpiresAt: input.accessTokenExpiresAt ?? null,
      },
    });
}

export async function getMicrosoftOauthSession(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(microsoftOauthSessions)
    .where(eq(microsoftOauthSessions.userId, userId))
    .limit(1);
  return result[0];
}

export async function saveSamlRequestCorrelation(input: { requestId: string; requestValue: string; expiresAt: Date }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(samlRequestCorrelations).values(input).onDuplicateKeyUpdate({
    set: { requestValue: input.requestValue, expiresAt: input.expiresAt },
  });
}

export async function getSamlRequestCorrelation(requestId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const item = (
    await db
      .select()
      .from(samlRequestCorrelations)
      .where(eq(samlRequestCorrelations.requestId, requestId))
      .limit(1)
  )[0];
  if (!item || item.expiresAt.getTime() <= Date.now()) {
    if (item) await db.delete(samlRequestCorrelations).where(eq(samlRequestCorrelations.requestId, requestId));
    return undefined;
  }
  return item;
}

export async function deleteSamlRequestCorrelation(requestId: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(samlRequestCorrelations).where(eq(samlRequestCorrelations.requestId, requestId));
}

export async function upsertEmployeeProfileFromEntra(input: {
  userId: number;
  entraUserId: string;
  displayName: string;
  email?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  officeLocation?: string | null;
  phone?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .insert(employeeProfiles)
    .values({
      ...input,
      source: "entra",
      lastSyncedAt: new Date(),
    })
    .onDuplicateKeyUpdate({
      set: {
        entraUserId: input.entraUserId,
        displayName: input.displayName,
        email: input.email ?? null,
        jobTitle: input.jobTitle ?? null,
        department: input.department ?? null,
        officeLocation: input.officeLocation ?? null,
        phone: input.phone ?? null,
        source: "entra",
        lastSyncedAt: new Date(),
      },
    });
}

export async function ensureEmployeeProfileForUser(user: {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existing = await db
    .select()
    .from(employeeProfiles)
    .where(eq(employeeProfiles.userId, user.id))
    .limit(1);
  if (existing[0]) return existing[0];

  await db.insert(employeeProfiles).values({
    userId: user.id,
    entraUserId: user.openId.startsWith("entra:") ? user.openId.split(":").at(-1) : null,
    displayName: user.name || "Welfare Pride Employee",
    email: user.email,
    source: user.openId.startsWith("entra:") ? "entra" : "local",
  });
  const created = await db
    .select()
    .from(employeeProfiles)
    .where(eq(employeeProfiles.userId, user.id))
    .limit(1);
  return created[0];
}

export async function getEmployeeProfileById(profileId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(employeeProfiles)
    .where(eq(employeeProfiles.id, profileId))
    .limit(1);
  return result[0];
}

export async function listEmployeeProfiles() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(employeeProfiles)
    .where(eq(employeeProfiles.isActive, true))
    .orderBy(asc(employeeProfiles.displayName));
}

export async function searchEmployeeProfiles(query: string, limit = 8) {
  const db = await getDb();
  if (!db) return [];
  const escaped = query.replace(/[\\%_]/g, value => `\\${value}`);
  const pattern = `%${escaped}%`;
  return db
    .select({
      id: employeeProfiles.id,
      userId: employeeProfiles.userId,
      displayName: employeeProfiles.displayName,
      email: employeeProfiles.email,
      jobTitle: employeeProfiles.jobTitle,
      department: employeeProfiles.department,
      photoUrl: employeeProfiles.photoUrl,
    })
    .from(employeeProfiles)
    .where(and(
      eq(employeeProfiles.isActive, true),
      or(
        like(employeeProfiles.displayName, pattern),
        like(employeeProfiles.email, pattern),
        like(employeeProfiles.jobTitle, pattern),
        like(employeeProfiles.department, pattern),
      ),
    ))
    .orderBy(asc(employeeProfiles.displayName))
    .limit(Math.min(Math.max(limit, 1), 20));
}

export async function updateOwnEmployeeProfile(
  userId: number,
  patch: { bio?: string | null; phone?: string | null },
) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(employeeProfiles).set(patch).where(eq(employeeProfiles.userId, userId));
  const result = await db
    .select()
    .from(employeeProfiles)
    .where(eq(employeeProfiles.userId, userId))
    .limit(1);
  return result[0];
}

export async function updateEmployeeProfileAsAdmin(
  profileId: number,
  patch: {
    displayName?: string;
    jobTitle?: string | null;
    department?: string | null;
    officeLocation?: string | null;
    bio?: string | null;
    phone?: string | null;
    managerEntraUserId?: string | null;
    birthdayMonth?: number | null;
    birthdayDay?: number | null;
    isActive?: boolean;
  },
) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(employeeProfiles).set(patch).where(eq(employeeProfiles.id, profileId));
  return getEmployeeProfileById(profileId);
}

export async function updateEmployeeProfilePhoto(profileId: number, photoUrl: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(employeeProfiles).set({ photoUrl }).where(eq(employeeProfiles.id, profileId));
  return getEmployeeProfileById(profileId);
}

export async function upsertDirectoryProfileFromEntra(input: {
  entraUserId: string;
  displayName: string;
  email?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  officeLocation?: string | null;
  phone?: string | null;
  managerEntraUserId?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .insert(employeeProfiles)
    .values({ ...input, source: "entra", lastSyncedAt: new Date() })
    .onDuplicateKeyUpdate({
      set: {
        displayName: input.displayName,
        email: input.email ?? null,
        jobTitle: input.jobTitle ?? null,
        department: input.department ?? null,
        officeLocation: input.officeLocation ?? null,
        phone: input.phone ?? null,
        managerEntraUserId: input.managerEntraUserId ?? null,
        source: "entra",
        isActive: true,
        lastSyncedAt: new Date(),
      },
    });
}

export async function listPublishedAnnouncements() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(announcements)
    .where(eq(announcements.status, "published"))
    .orderBy(desc(announcements.isPinned), desc(announcements.publishAt), desc(announcements.createdAt));
}

export async function searchPublishedAnnouncements(query: string, limit = 8) {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  const escaped = query.replace(/[\\%_]/g, value => `\\${value}`);
  const pattern = `%${escaped}%`;
  return db
    .select({
      id: announcements.id,
      title: announcements.title,
      summary: announcements.summary,
      body: announcements.body,
      category: announcements.category,
      publishAt: announcements.publishAt,
    })
    .from(announcements)
    .where(and(
      eq(announcements.status, "published"),
      or(isNull(announcements.publishAt), lte(announcements.publishAt, now)),
      or(isNull(announcements.expiresAt), gt(announcements.expiresAt, now)),
      or(
        like(announcements.title, pattern),
        like(announcements.summary, pattern),
        like(announcements.body, pattern),
        like(announcements.category, pattern),
      ),
    ))
    .orderBy(desc(announcements.isPinned), desc(announcements.publishAt), desc(announcements.createdAt))
    .limit(Math.min(Math.max(limit, 1), 20));
}

export async function listAllAnnouncements() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(announcements).orderBy(desc(announcements.createdAt));
}

export async function createAnnouncement(input: typeof announcements.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(announcements).values(input);
  return Number(result[0].insertId);
}

export async function updateAnnouncement(id: number, patch: Partial<typeof announcements.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(announcements).set(patch).where(eq(announcements.id, id));
}

export async function listPublishedEvents(from: Date, to: Date) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(companyEvents)
    .where(
      and(
        eq(companyEvents.status, "published"),
        lte(companyEvents.startAt, to),
        gte(companyEvents.endAt, from),
      ),
    )
    .orderBy(asc(companyEvents.startAt));
}

export async function getPublishedUpcomingEventById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [event] = await db
    .select()
    .from(companyEvents)
    .where(and(eq(companyEvents.id, id), eq(companyEvents.status, "published"), gte(companyEvents.endAt, new Date())))
    .limit(1);
  return event;
}

export async function listDashboardPinsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(dashboardPins)
    .where(eq(dashboardPins.userId, userId))
    .orderBy(desc(dashboardPins.createdAt));
}

export async function addDashboardPinForUser(userId: number, pinType: "hr_document" | "event", targetKey: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(dashboardPins).values({ userId, pinType, targetKey }).onDuplicateKeyUpdate({ set: { createdAt: new Date() } });
}

export async function removeDashboardPinForUser(userId: number, pinType: "hr_document" | "event", targetKey: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(dashboardPins).where(and(eq(dashboardPins.userId, userId), eq(dashboardPins.pinType, pinType), eq(dashboardPins.targetKey, targetKey)));
}

export async function listAllEvents() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(companyEvents).orderBy(desc(companyEvents.startAt));
}

export async function createCompanyEvent(input: typeof companyEvents.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(companyEvents).values(input);
  return Number(result[0].insertId);
}

export async function updateCompanyEvent(id: number, patch: Partial<typeof companyEvents.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(companyEvents).set(patch).where(eq(companyEvents.id, id));
}

export async function listHolidays(from: string, to: string) {
  const db = await getDb();
  if (!db) return [];
  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate = new Date(`${to}T00:00:00.000Z`);
  return db
    .select()
    .from(holidays)
    .where(and(lte(holidays.startDate, toDate), gte(holidays.endDate, fromDate)))
    .orderBy(asc(holidays.startDate));
}

export async function upsertHoliday(input: {
  externalId: string;
  title: string;
  description?: string | null;
  startDate: string;
  endDate: string;
  isObserved?: boolean;
  sourceUpdatedAt?: Date | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .insert(holidays)
    .values({
      ...input,
      startDate: new Date(`${input.startDate}T00:00:00.000Z`),
      endDate: new Date(`${input.endDate}T00:00:00.000Z`),
      syncedAt: new Date(),
    })
    .onDuplicateKeyUpdate({
      set: {
        title: input.title,
        description: input.description ?? null,
        startDate: new Date(`${input.startDate}T00:00:00.000Z`),
        endDate: new Date(`${input.endDate}T00:00:00.000Z`),
        isObserved: input.isObserved ?? false,
        sourceUpdatedAt: input.sourceUpdatedAt ?? null,
        syncedAt: new Date(),
      },
    });
}

export async function listBirthdayDisplays() {
  const profiles = await listEmployeeProfiles();
  return projectBirthdayDisplays(profiles);
}

export async function listActiveTechnologyEmbeds() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(technologyEmbeds)
    .where(eq(technologyEmbeds.isActive, true))
    .orderBy(asc(technologyEmbeds.sortOrder), asc(technologyEmbeds.title));
}

export async function listAllTechnologyEmbeds() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(technologyEmbeds).orderBy(asc(technologyEmbeds.sortOrder), asc(technologyEmbeds.title));
}

export async function createTechnologyEmbed(input: typeof technologyEmbeds.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(technologyEmbeds).values(input);
  return Number(result[0].insertId);
}

export async function updateTechnologyEmbed(id: number, patch: Partial<typeof technologyEmbeds.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(technologyEmbeds).set(patch).where(eq(technologyEmbeds.id, id));
}

export async function ensureDefaultImportantLinks() {
  const db = await getDb();
  if (!db) return;
  const defaults: Array<typeof importantLinks.$inferInsert> = [
    { title: "Email", description: "Open Outlook on the web.", url: "https://outlook.office.com/mail/", category: "Microsoft 365", iconKey: "mail", sortOrder: 10, isActive: true },
    { title: "Microsoft 365", description: "Launch Microsoft 365 applications.", url: "https://www.microsoft365.com/", category: "Microsoft 365", iconKey: "apps", sortOrder: 20, isActive: true },
    { title: "Corporate Calendar", description: "Open the corporate calendar in Outlook.", url: "https://outlook.office.com/calendar/", category: "Calendar", iconKey: "calendar", sortOrder: 30, isActive: true },
    { title: "Microsoft Teams", description: "Open Microsoft Teams for collaboration.", url: "https://teams.microsoft.com/", category: "Microsoft 365", iconKey: "users", sortOrder: 40, isActive: true },
  ];
  for (const item of defaults) {
    await db.insert(importantLinks).values(item).onDuplicateKeyUpdate({
      set: { id: sql`${importantLinks.id}` },
    });
  }
}

export async function listActiveImportantLinks() {
  await ensureDefaultImportantLinks();
  const db = await getDb();
  if (!db) return [];
  return db.select().from(importantLinks).where(eq(importantLinks.isActive, true)).orderBy(asc(importantLinks.sortOrder), asc(importantLinks.title));
}

export async function listAllImportantLinks() {
  await ensureDefaultImportantLinks();
  const db = await getDb();
  if (!db) return [];
  return db.select().from(importantLinks).orderBy(asc(importantLinks.sortOrder), asc(importantLinks.title));
}

export async function createImportantLink(input: typeof importantLinks.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(importantLinks).values(input);
  return Number(result[0].insertId);
}

export async function updateImportantLink(id: number, patch: Partial<typeof importantLinks.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(importantLinks).set(patch).where(eq(importantLinks.id, id));
}

export async function listEmailTemplates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(emailTemplates).orderBy(desc(emailTemplates.updatedAt), asc(emailTemplates.name));
}

export async function getEmailTemplateById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(emailTemplates).where(eq(emailTemplates.id, id)).limit(1))[0];
}

export async function saveEmailTemplate(input: { id?: number; name: string; eventType: "announcement_published" | "event_published" | "birthday_congratulation" | "manual"; subjectTemplate: string; bodyTemplate: string; isActive: boolean; actorUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  if (input.id) {
    await db.update(emailTemplates).set({ name: input.name, eventType: input.eventType, subjectTemplate: input.subjectTemplate, bodyTemplate: input.bodyTemplate, isActive: input.isActive }).where(eq(emailTemplates.id, input.id));
    return getEmailTemplateById(input.id);
  }
  const result = await db.insert(emailTemplates).values({ name: input.name, eventType: input.eventType, subjectTemplate: input.subjectTemplate, bodyTemplate: input.bodyTemplate, isActive: input.isActive, createdByUserId: input.actorUserId });
  return getEmailTemplateById(Number(result[0].insertId));
}

export async function listEmailDeliveries(limit = 150) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(emailDeliveries).orderBy(desc(emailDeliveries.createdAt)).limit(Math.min(Math.max(limit, 1), 500));
}

export async function getEmailDeliveryById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(emailDeliveries).where(eq(emailDeliveries.id, id)).limit(1))[0];
}

export async function getEmailDeliveryByKey(deliveryKey: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(emailDeliveries).where(eq(emailDeliveries.deliveryKey, deliveryKey)).limit(1))[0];
}

export async function createEmailDelivery(input: typeof emailDeliveries.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(emailDeliveries).values(input);
  return getEmailDeliveryById(Number(result[0].insertId));
}

export async function updateEmailDelivery(id: number, patch: Partial<typeof emailDeliveries.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(emailDeliveries).set(patch).where(eq(emailDeliveries.id, id));
  return getEmailDeliveryById(id);
}

export async function listActiveEmployeeEmailAddresses() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({ email: employeeProfiles.email }).from(employeeProfiles).where(and(eq(employeeProfiles.isActive, true), sql`${employeeProfiles.email} IS NOT NULL`));
  return Array.from(new Set(rows.map(row => row.email?.trim().toLowerCase()).filter((email): email is string => Boolean(email))));
}

export async function listBirthdayEmailRecipients(month: number, day: number) {
  const db = await getDb();
  if (!db) return [] as Array<{ id: number; displayName: string; email: string }>;
  const rows = await db.select({ id: employeeProfiles.id, displayName: employeeProfiles.displayName, email: employeeProfiles.email }).from(employeeProfiles).where(and(eq(employeeProfiles.isActive, true), eq(employeeProfiles.birthdayVisible, true), eq(employeeProfiles.birthdayMonth, month), eq(employeeProfiles.birthdayDay, day), sql`${employeeProfiles.email} IS NOT NULL`));
  return rows.flatMap(row => row.email?.trim() ? [{ id: row.id, displayName: row.displayName, email: row.email.trim().toLowerCase() }] : []);
}

export async function listPublishedContentBlocks(pageKey: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contentBlocks).where(and(eq(contentBlocks.pageKey, pageKey), eq(contentBlocks.isPublished, true))).orderBy(asc(contentBlocks.sortOrder));
}

export async function listAllContentBlocks(pageKey: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contentBlocks).where(eq(contentBlocks.pageKey, pageKey)).orderBy(asc(contentBlocks.sortOrder));
}

export async function upsertContentBlock(input: typeof contentBlocks.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(contentBlocks).values(input).onDuplicateKeyUpdate({ set: {
    eyebrow: input.eyebrow ?? null,
    title: input.title,
    body: input.body,
    mediaUrl: input.mediaUrl ?? null,
    sortOrder: input.sortOrder ?? 0,
    isPublished: input.isPublished ?? true,
    updatedByUserId: input.updatedByUserId ?? null,
  } });
}

export async function listPublishedFounders() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(founders).where(eq(founders.isPublished, true)).orderBy(asc(founders.sortOrder), asc(founders.name));
}

export async function listAllFounders() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(founders).orderBy(asc(founders.sortOrder), asc(founders.name));
}

export async function createFounder(input: typeof founders.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(founders).values(input);
  return Number(result[0].insertId);
}

export async function updateFounder(id: number, patch: Partial<typeof founders.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(founders).set(patch).where(eq(founders.id, id));
}

export async function listPublishedMilestones() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(milestones).where(eq(milestones.isPublished, true)).orderBy(asc(milestones.eventDate), asc(milestones.sortOrder));
}

export async function listAllMilestones() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(milestones).orderBy(asc(milestones.eventDate), asc(milestones.sortOrder));
}

export async function createMilestone(input: typeof milestones.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(milestones).values(input);
  return Number(result[0].insertId);
}

export async function updateMilestone(id: number, patch: Partial<typeof milestones.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(milestones).set(patch).where(eq(milestones.id, id));
}

export async function ensureBuiltInPortalResources() {
  const db = await getDb();
  if (!db) return;
  for (const item of BUILT_IN_PORTAL_RESOURCES) {
    await db.insert(portalResources).values({
      ...item,
      resourceType: "module",
      isSystem: true,
      isPublished: true,
      accessMode: "all_authenticated",
    }).onDuplicateKeyUpdate({
      set: { resourceKey: sql`${portalResources.resourceKey}` },
    });
  }
}

export async function listPortalResources(includeUnpublished = false) {
  await ensureBuiltInPortalResources();
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(portalResources)
    .where(includeUnpublished ? undefined : eq(portalResources.isPublished, true))
    .orderBy(asc(portalResources.navigationGroupOrder), asc(portalResources.navigationGroup), asc(portalResources.sortOrder), asc(portalResources.label));
}

export async function updatePortalResourceOrder(items: Array<{ id: number; navigationGroup: string; navigationGroupOrder: number; sortOrder: number }>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.transaction(async tx => { for (const item of items) await tx.update(portalResources).set({ navigationGroup: item.navigationGroup, navigationGroupOrder: item.navigationGroupOrder, sortOrder: item.sortOrder }).where(eq(portalResources.id, item.id)); });
}

export async function getPortalResourceByKey(resourceKey: string) {
  await ensureBuiltInPortalResources();
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(portalResources).where(eq(portalResources.resourceKey, resourceKey)).limit(1))[0];
}

export async function getPortalResourceByPath(path: string) {
  await ensureBuiltInPortalResources();
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(portalResources).where(eq(portalResources.path, path)).limit(1))[0];
}

export async function getPortalResourceAssignments(resourceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(portalResourceAssignments).where(eq(portalResourceAssignments.resourceId, resourceId)).orderBy(asc(portalResourceAssignments.createdAt));
}

export async function createPortalAccessRequest(input: { resourceId: number; requesterUserId: number; note?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existing = (await db.select().from(portalAccessRequests).where(and(
    eq(portalAccessRequests.resourceId, input.resourceId),
    eq(portalAccessRequests.requesterUserId, input.requesterUserId),
    eq(portalAccessRequests.status, "pending"),
  )).limit(1))[0];
  if (existing) return { request: existing, created: false };
  const result = await db.insert(portalAccessRequests).values({ resourceId: input.resourceId, requesterUserId: input.requesterUserId, note: input.note?.trim() || null });
  const request = (await db.select().from(portalAccessRequests).where(eq(portalAccessRequests.id, Number(result[0].insertId))).limit(1))[0];
  if (!request) throw new Error("Access request could not be created");
  const administrators = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
  if (administrators.length) {
    await db.insert(adminAccessRequestNotifications).values(administrators.map(administrator => ({ accessRequestId: request.id, recipientUserId: administrator.id }))).onDuplicateKeyUpdate({
      set: { accessRequestId: sql`${adminAccessRequestNotifications.accessRequestId}` },
    });
  }
  await appendAccessControlAuditEvent({ action: "portal_access_requested", resourceId: input.resourceId, actorUserId: input.requesterUserId, metadataJson: JSON.stringify({ requestId: request.id }) });
  return { request, created: true };
}

export async function listPortalAccessRequests(limit = 200) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(portalAccessRequests).orderBy(desc(portalAccessRequests.createdAt)).limit(Math.min(Math.max(limit, 1), 200));
}

export async function listAdminAccessRequestNotifications(recipientUserId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: adminAccessRequestNotifications.id,
    accessRequestId: adminAccessRequestNotifications.accessRequestId,
    readAt: adminAccessRequestNotifications.readAt,
    createdAt: adminAccessRequestNotifications.createdAt,
    resourceLabel: portalResources.label,
    requesterName: users.name,
    requesterEmail: users.email,
  }).from(adminAccessRequestNotifications)
    .innerJoin(portalAccessRequests, eq(adminAccessRequestNotifications.accessRequestId, portalAccessRequests.id))
    .innerJoin(portalResources, eq(portalAccessRequests.resourceId, portalResources.id))
    .innerJoin(users, eq(portalAccessRequests.requesterUserId, users.id))
    .where(eq(adminAccessRequestNotifications.recipientUserId, recipientUserId))
    .orderBy(desc(adminAccessRequestNotifications.createdAt))
    .limit(Math.min(Math.max(limit, 1), 50));
}

export async function getUnreadAdminAccessRequestNotificationCount(recipientUserId: number) {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.select({ count: sql<number>`count(*)` }).from(adminAccessRequestNotifications).where(and(
    eq(adminAccessRequestNotifications.recipientUserId, recipientUserId),
    isNull(adminAccessRequestNotifications.readAt),
  ));
  return Number(result?.count || 0);
}

export async function markAdminAccessRequestNotificationsRead(recipientUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(adminAccessRequestNotifications).set({ readAt: new Date() }).where(and(
    eq(adminAccessRequestNotifications.recipientUserId, recipientUserId),
    isNull(adminAccessRequestNotifications.readAt),
  ));
}

export async function reviewPortalAccessRequest(input: { requestId: number; reviewerUserId: number; status: "approved" | "declined" }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const request = (await db.select().from(portalAccessRequests).where(eq(portalAccessRequests.id, input.requestId)).limit(1))[0];
  if (!request) throw new Error("Access request not found");
  if (request.status !== "pending") return request;
  await db.transaction(async tx => {
    await tx.update(portalAccessRequests).set({ status: input.status, reviewedByUserId: input.reviewerUserId, reviewedAt: new Date() }).where(eq(portalAccessRequests.id, input.requestId));
    if (input.status === "approved") {
      await tx.insert(portalResourceAssignments).values({ resourceId: request.resourceId, subjectType: "user", userId: request.requesterUserId, createdByUserId: input.reviewerUserId }).onDuplicateKeyUpdate({ set: { resourceId: request.resourceId } });
    }
  });
  await appendAccessControlAuditEvent({ action: `portal_access_request_${input.status}`, resourceId: request.resourceId, actorUserId: input.reviewerUserId, metadataJson: JSON.stringify({ requestId: request.id, requesterUserId: request.requesterUserId }) });
  return (await db.select().from(portalAccessRequests).where(eq(portalAccessRequests.id, request.id)).limit(1))[0]!;
}

export async function listEntraGroups() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(entraGroups).orderBy(asc(entraGroups.displayName));
}

export async function upsertEntraGroup(input: { groupId: string; displayName: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(entraGroups).values({ ...input, lastSyncedAt: new Date() }).onDuplicateKeyUpdate({
    set: { displayName: input.displayName, lastSyncedAt: new Date() },
  });
}

export async function replaceUserEntraGroupMemberships(userId: number, groups: Array<{ groupId: string; displayName: string }>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const normalized = Array.from(new Map(groups.map(group => [group.groupId, group])).values());
  await db.transaction(async tx => {
    for (const group of normalized) {
      await tx.insert(entraGroups).values({ ...group, lastSyncedAt: new Date() }).onDuplicateKeyUpdate({
        set: { displayName: group.displayName, lastSyncedAt: new Date() },
      });
    }
    await tx.delete(userEntraGroupMemberships).where(eq(userEntraGroupMemberships.userId, userId));
    if (normalized.length) {
      await tx.insert(userEntraGroupMemberships).values(normalized.map(group => ({ userId, entraGroupId: group.groupId, syncedAt: new Date() })));
    }
  });
}

export async function listUserEntraGroupMemberships(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ groupId: entraGroups.groupId, displayName: entraGroups.displayName, syncedAt: userEntraGroupMemberships.syncedAt })
    .from(userEntraGroupMemberships)
    .innerJoin(entraGroups, eq(userEntraGroupMemberships.entraGroupId, entraGroups.groupId))
    .where(eq(userEntraGroupMemberships.userId, userId))
    .orderBy(asc(entraGroups.displayName));
}

export const ENTRA_GROUP_MEMBERSHIP_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function isFreshEntraGroupMembership(syncedAt: Date, now = Date.now()) {
  return syncedAt.getTime() >= now - ENTRA_GROUP_MEMBERSHIP_MAX_AGE_MS;
}

async function userPortalGroupIds(userId: number) {
  const memberships = await listUserEntraGroupMemberships(userId);
  return new Set(memberships.filter(item => isFreshEntraGroupMembership(item.syncedAt)).map(item => item.groupId));
}

export async function canAccessPortalResource(input: { resourceKey: string; userId: number; role: "admin" | "user" }) {
  const resource = await getPortalResourceByKey(input.resourceKey);
  if (!resource?.isPublished) return false;
  if (input.role === "admin" || resource.accessMode === "all_authenticated") return true;
  const [assignments, groupIds] = await Promise.all([getPortalResourceAssignments(resource.id), userPortalGroupIds(input.userId)]);
  return assignments.some(assignment => assignment.userId === input.userId || (assignment.entraGroupId && groupIds.has(assignment.entraGroupId)));
}

export async function listVisiblePortalResources(input: { userId: number; role: "admin" | "user" }) {
  const resources = await listPortalResources(false);
  if (input.role === "admin") return resources;
  const [allAssignments, groupIds] = await Promise.all([
    (async () => {
      const db = await getDb();
      return db ? db.select().from(portalResourceAssignments) : [];
    })(),
    userPortalGroupIds(input.userId),
  ]);
  const assignmentsByResource = new Map<number, typeof allAssignments>();
  for (const assignment of allAssignments) {
    const existing = assignmentsByResource.get(assignment.resourceId) || [];
    existing.push(assignment);
    assignmentsByResource.set(assignment.resourceId, existing);
  }
  return resources.filter(resource => {
    if (resource.accessMode === "all_authenticated") return true;
    return (assignmentsByResource.get(resource.id) || []).some(assignment => assignment.userId === input.userId || (assignment.entraGroupId && groupIds.has(assignment.entraGroupId)));
  });
}

export async function savePortalResource(input: {
  id?: number;
  resourceKey: string;
  resourceType: "module" | "page" | "calendar";
  label: string;
  path: string;
  navigationGroup: string;
  navigationGroupOrder?: number;
  iconKey: string;
  body?: string | null;
  calendarView?: "all" | "events_only";
  accessMode: PortalResourceAccessMode;
  isPublished: boolean;
  sortOrder: number;
  createdByUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  if (input.id) {
    const existing = (await db.select().from(portalResources).where(eq(portalResources.id, input.id)).limit(1))[0];
    if (!existing) throw new Error("Portal resource not found");
    if (existing.isSystem && (input.resourceType !== "module" || input.resourceKey !== existing.resourceKey || input.path !== existing.path)) {
      throw new Error("System module identity cannot be changed");
    }
    await db.update(portalResources).set({
      label: input.label,
      navigationGroup: input.navigationGroup,
      navigationGroupOrder: input.navigationGroupOrder ?? existing.navigationGroupOrder,
      iconKey: input.iconKey,
      body: input.body ?? null,
      calendarView: input.calendarView ?? existing.calendarView,
      accessMode: input.accessMode,
      isPublished: input.isPublished,
      sortOrder: input.sortOrder,
      ...(existing.isSystem ? {} : { resourceKey: input.resourceKey, resourceType: input.resourceType, path: input.path }),
    }).where(eq(portalResources.id, input.id));
    return (await db.select().from(portalResources).where(eq(portalResources.id, input.id)).limit(1))[0];
  }
  const result = await db.insert(portalResources).values({
    resourceKey: input.resourceKey,
    resourceType: input.resourceType,
    label: input.label,
    path: input.path,
    navigationGroup: input.navigationGroup,
    navigationGroupOrder: input.navigationGroupOrder ?? 0,
    iconKey: input.iconKey,
    body: input.body ?? null,
    calendarView: input.calendarView ?? "all",
    accessMode: input.accessMode,
    isPublished: input.isPublished,
    sortOrder: input.sortOrder,
    isSystem: false,
    createdByUserId: input.createdByUserId,
  });
  return (await db.select().from(portalResources).where(eq(portalResources.id, Number(result[0].insertId))).limit(1))[0];
}

export async function replacePortalResourceAssignments(input: {
  resourceId: number;
  assignments: Array<{ subjectType: PortalAssignmentSubjectType; userId?: number; entraGroupId?: string }>;
  actorUserId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.transaction(async tx => {
    await tx.delete(portalResourceAssignments).where(eq(portalResourceAssignments.resourceId, input.resourceId));
    for (const assignment of input.assignments) {
      if (assignment.subjectType === "user" && assignment.userId) {
        await tx.insert(portalResourceAssignments).values({ resourceId: input.resourceId, subjectType: "user", userId: assignment.userId, createdByUserId: input.actorUserId });
      }
      if (assignment.subjectType === "entra_group" && assignment.entraGroupId) {
        await tx.insert(portalResourceAssignments).values({ resourceId: input.resourceId, subjectType: "entra_group", entraGroupId: assignment.entraGroupId, createdByUserId: input.actorUserId });
      }
    }
  });
}

export async function deleteCustomPortalResource(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const resource = (await db.select().from(portalResources).where(eq(portalResources.id, id)).limit(1))[0];
  if (!resource) return;
  if (resource.isSystem) throw new Error("System modules cannot be deleted");
  await db.delete(portalResources).where(eq(portalResources.id, id));
}

export async function appendAccessControlAuditEvent(input: typeof accessControlAuditEvents.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(accessControlAuditEvents).values(input);
  return Number(result[0].insertId);
}

export async function listAccessControlAuditEvents(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(accessControlAuditEvents).orderBy(desc(accessControlAuditEvents.createdAt)).limit(Math.min(Math.max(limit, 1), 200));
}

export const DEFAULT_SECURITY_SETTINGS = {
  allowlistEnabled: false,
  rateLimitRequests: 120,
  rateLimitWindowSeconds: 60,
  autoBlockThreshold: 0,
  autoBlockDurationMinutes: 30,
  alertingEnabled: true,
  highSeverityAlertThreshold: 3,
  highSeverityAlertWindowMinutes: 15,
} as const;

export type SecuritySettingsInput = {
  allowlistEnabled: boolean;
  rateLimitRequests: number;
  rateLimitWindowSeconds: number;
  autoBlockThreshold: number;
  autoBlockDurationMinutes: number;
  alertingEnabled: boolean;
  highSeverityAlertThreshold: number;
  highSeverityAlertWindowMinutes: number;
};

export async function getSecuritySettings() {
  const db = await getDb();
  if (!db) return { id: 1, ...DEFAULT_SECURITY_SETTINGS };
  const [settings] = await db.select().from(securitySettings).where(eq(securitySettings.id, 1)).limit(1);
  return settings || { id: 1, ...DEFAULT_SECURITY_SETTINGS };
}

export async function updateSecuritySettings(input: SecuritySettingsInput & { updatedByUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(securitySettings).values({ id: 1, ...input }).onDuplicateKeyUpdate({
    set: { ...input, updatedAt: new Date() },
  });
  return getSecuritySettings();
}

export async function listSecurityIpPolicies(limit = 500) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(securityIpPolicies).orderBy(desc(securityIpPolicies.isActive), desc(securityIpPolicies.createdAt)).limit(Math.min(Math.max(limit, 1), 500));
}

export async function listActiveSecurityIpPolicies() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(securityIpPolicies).where(and(
    eq(securityIpPolicies.isActive, true),
    or(isNull(securityIpPolicies.expiresAt), gt(securityIpPolicies.expiresAt, new Date())),
  ));
}

export async function upsertSecurityIpPolicy(input: {
  mode: "allow" | "block";
  ipAddress: string;
  label: string;
  expiresAt: Date | null;
  createdByUserId: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(securityIpPolicies).values(input).onDuplicateKeyUpdate({
    set: {
      label: input.label,
      expiresAt: input.expiresAt,
      isActive: true,
      createdByUserId: input.createdByUserId,
      revokedAt: null,
      revokedByUserId: null,
      updatedAt: new Date(),
    },
  });
  return (await db.select().from(securityIpPolicies).where(and(eq(securityIpPolicies.mode, input.mode), eq(securityIpPolicies.ipAddress, input.ipAddress))).limit(1))[0];
}

export async function revokeSecurityIpPolicy(input: { policyId: number; revokedByUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [policy] = await db.select().from(securityIpPolicies).where(eq(securityIpPolicies.id, input.policyId)).limit(1);
  if (!policy) return undefined;
  if (policy.isActive) {
    await db.update(securityIpPolicies).set({ isActive: false, revokedAt: new Date(), revokedByUserId: input.revokedByUserId }).where(eq(securityIpPolicies.id, input.policyId));
  }
  return (await db.select().from(securityIpPolicies).where(eq(securityIpPolicies.id, input.policyId)).limit(1))[0];
}

async function maybeCreateSecurityAlertNotifications(input: { eventId: number; event: typeof securityEvents.$inferInsert }) {
  const alertSeverity = input.event.severity;
  if (alertSeverity !== "high" && alertSeverity !== "critical") return;
  const db = await getDb();
  if (!db) return;
  const settings = await getSecuritySettings();
  if (!settings.alertingEnabled || settings.highSeverityAlertThreshold < 1) return;
  const windowStart = new Date(Date.now() - settings.highSeverityAlertWindowMinutes * 60_000);
  const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(securityEvents).where(and(
    inArray(securityEvents.severity, ["high", "critical"]),
    gte(securityEvents.createdAt, windowStart),
  ));
  const matchedEventCount = Number(countResult?.count || 0);
  if (!shouldTriggerHighSeverityAlert({ alertingEnabled: settings.alertingEnabled, threshold: settings.highSeverityAlertThreshold, matchedEventCount })) return;
  const owners = await db.select({ id: securityEscalationOwners.userId }).from(securityEscalationOwners)
    .innerJoin(users, eq(securityEscalationOwners.userId, users.id)).where(eq(users.role, "admin"));
  const recipients = owners.length ? owners : await db.select({ id: users.id }).from(users).where(eq(users.role, "admin"));
  if (!recipients.length) return;
  await db.insert(securityAlertNotifications).values(recipients.map(recipient => ({
    triggerEventId: input.eventId,
    recipientUserId: recipient.id,
    correlationId: input.event.correlationId,
    eventType: input.event.eventType,
    severity: alertSeverity,
    ipAddress: input.event.ipAddress ?? null,
    matchedEventCount,
    windowMinutes: settings.highSeverityAlertWindowMinutes,
  }))).onDuplicateKeyUpdate({ set: { triggerEventId: input.eventId } });
}

export async function appendSecurityEvent(input: typeof securityEvents.$inferInsert) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.insert(securityEvents).values(input);
  const eventId = Number(result[0].insertId);
  void maybeCreateSecurityAlertNotifications({ eventId, event: input }).catch(error => console.error("[Security Center] Unable to create alert notifications", error));
  return eventId;
}

export type SecurityEventFilters = {
  correlationId?: string;
  ipAddress?: string;
  severity?: "info" | "low" | "medium" | "high" | "critical";
  eventType?: string;
  search?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
};

export async function listSecurityEvents(filters: SecurityEventFilters = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters.correlationId) conditions.push(eq(securityEvents.correlationId, filters.correlationId));
  if (filters.ipAddress) conditions.push(eq(securityEvents.ipAddress, filters.ipAddress));
  if (filters.severity) conditions.push(eq(securityEvents.severity, filters.severity));
  if (filters.eventType) conditions.push(eq(securityEvents.eventType, filters.eventType));
  if (filters.fromDate) conditions.push(gte(securityEvents.createdAt, filters.fromDate));
  if (filters.toDate) conditions.push(lte(securityEvents.createdAt, filters.toDate));
  if (filters.search) {
    const match = `%${filters.search.trim().slice(0, 100)}%`;
    conditions.push(or(
      like(securityEvents.correlationId, match),
      like(securityEvents.ipAddress, match),
      like(securityEvents.eventType, match),
      like(securityEvents.requestPath, match),
    ));
  }
  return db.select({ event: securityEvents, actorName: users.name, actorEmail: users.email })
    .from(securityEvents)
    .leftJoin(users, eq(securityEvents.actorUserId, users.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(securityEvents.createdAt), desc(securityEvents.id))
    .limit(Math.min(Math.max(filters.limit ?? 200, 1), 5_000));
}

export async function getSecurityEventDetail(eventId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [selected] = await db.select({ event: securityEvents, actorName: users.name, actorEmail: users.email })
    .from(securityEvents)
    .leftJoin(users, eq(securityEvents.actorUserId, users.id))
    .where(eq(securityEvents.id, eventId))
    .limit(1);
  if (!selected) return undefined;
  const related = await listSecurityEvents({ correlationId: selected.event.correlationId, limit: 100 });
  return { selected, related };
}

export async function listSecurityAlertNotifications(recipientUserId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(securityAlertNotifications)
    .where(eq(securityAlertNotifications.recipientUserId, recipientUserId))
    .orderBy(desc(securityAlertNotifications.createdAt), desc(securityAlertNotifications.id))
    .limit(Math.min(Math.max(limit, 1), 50));
}

export async function getUnreadSecurityAlertNotificationCount(recipientUserId: number) {
  const db = await getDb();
  if (!db) return 0;
  const [result] = await db.select({ count: sql<number>`count(*)` }).from(securityAlertNotifications).where(and(
    eq(securityAlertNotifications.recipientUserId, recipientUserId),
    isNull(securityAlertNotifications.readAt),
  ));
  return Number(result?.count || 0);
}

export async function markSecurityAlertNotificationsRead(recipientUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(securityAlertNotifications).set({ readAt: new Date() }).where(and(
    eq(securityAlertNotifications.recipientUserId, recipientUserId),
    isNull(securityAlertNotifications.readAt),
  ));
}

export async function listUnreadSecurityEvents(recipientUserId: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  const [cursor] = await db.select().from(securityEventReadCursors).where(eq(securityEventReadCursors.recipientUserId, recipientUserId)).limit(1);
  return db.select({ event: securityEvents, actorName: users.name, actorEmail: users.email }).from(securityEvents)
    .leftJoin(users, eq(securityEvents.actorUserId, users.id))
    .where(gt(securityEvents.id, cursor?.lastReadEventId ?? 0))
    .orderBy(desc(securityEvents.id))
    .limit(Math.min(Math.max(limit, 1), 25));
}

export async function getUnreadSecurityEventCount(recipientUserId: number) {
  const db = await getDb();
  if (!db) return 0;
  const [cursor] = await db.select().from(securityEventReadCursors).where(eq(securityEventReadCursors.recipientUserId, recipientUserId)).limit(1);
  const [result] = await db.select({ count: sql<number>`count(*)` }).from(securityEvents).where(gt(securityEvents.id, cursor?.lastReadEventId ?? 0));
  return Number(result?.count || 0);
}

export async function markSecurityEventsRead(recipientUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [latest] = await db.select({ id: securityEvents.id }).from(securityEvents).orderBy(desc(securityEvents.id)).limit(1);
  const lastReadEventId = latest?.id ?? 0;
  await db.insert(securityEventReadCursors).values({ recipientUserId, lastReadEventId, readAt: new Date() }).onDuplicateKeyUpdate({
    set: { lastReadEventId, readAt: new Date() },
  });
}

export async function listSecurityAdministrators() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.role, "admin")).orderBy(asc(users.name), asc(users.email));
}

export async function listSecurityEscalationOwners() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ userId: securityEscalationOwners.userId, name: users.name, email: users.email, assignedByUserId: securityEscalationOwners.assignedByUserId, createdAt: securityEscalationOwners.createdAt })
    .from(securityEscalationOwners).innerJoin(users, eq(securityEscalationOwners.userId, users.id)).orderBy(asc(users.name), asc(users.email));
}

export async function replaceSecurityEscalationOwners(input: { userIds: number[]; assignedByUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const userIds = Array.from(new Set(input.userIds));
  const eligible = userIds.length ? await db.select({ id: users.id }).from(users).where(and(eq(users.role, "admin"), inArray(users.id, userIds))) : [];
  if (eligible.length !== userIds.length) throw new Error("Only active administrators can be assigned as escalation owners.");
  await db.transaction(async tx => {
    if (!userIds.length) { await tx.delete(securityEscalationOwners); return; }
    await tx.delete(securityEscalationOwners).where(notInArray(securityEscalationOwners.userId, userIds));
    await tx.insert(securityEscalationOwners).values(userIds.map(userId => ({ userId, assignedByUserId: input.assignedByUserId }))).onDuplicateKeyUpdate({ set: { assignedByUserId: input.assignedByUserId, updatedAt: new Date() } });
  });
  return listSecurityEscalationOwners();
}

export async function getSecurityIncidentCase(triggerEventId: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(securityIncidentCases).where(eq(securityIncidentCases.triggerEventId, triggerEventId)).limit(1))[0];
}

async function requireEscalationOwner(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, userId: number) {
  const [owner] = await db.select({ userId: securityEscalationOwners.userId }).from(securityEscalationOwners).where(eq(securityEscalationOwners.userId, userId)).limit(1);
  if (!owner) throw new Error("Select an administrator assigned as a Security Center escalation owner.");
}

export async function acknowledgeCriticalSecurityIncident(input: { triggerEventId: number; ownerUserId: number; acknowledgedByUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [event] = await db.select().from(securityEvents).where(eq(securityEvents.id, input.triggerEventId)).limit(1);
  if (!event || event.severity !== "critical") throw new Error("Only critical security events can be acknowledged as incident cases.");
  await requireEscalationOwner(db, input.ownerUserId);
  const existing = await getSecurityIncidentCase(input.triggerEventId);
  if (existing) return existing;
  const caseReference = `SEC-${event.createdAt.toISOString().slice(0, 10).replaceAll("-", "")}-${event.id}`;
  await db.insert(securityIncidentCases).values({ triggerEventId: event.id, caseReference, ownerUserId: input.ownerUserId, acknowledgedByUserId: input.acknowledgedByUserId });
  return getSecurityIncidentCase(event.id);
}

export async function resolveCriticalSecurityIncident(input: { triggerEventId: number; resolutionNotes: string; resolvedByUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const current = await getSecurityIncidentCase(input.triggerEventId);
  if (!current) throw new Error("A critical incident must be acknowledged before it can be resolved.");
  if (current.status === "resolved") return current;
  await db.update(securityIncidentCases).set({ status: "resolved", resolutionNotes: input.resolutionNotes, resolvedByUserId: input.resolvedByUserId, resolvedAt: new Date(), updatedAt: new Date() }).where(eq(securityIncidentCases.triggerEventId, input.triggerEventId));
  return getSecurityIncidentCase(input.triggerEventId);
}

export async function getSecurityAnalytics(now = new Date()) {
  const windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const rows = await listSecurityEvents({ fromDate: windowStart, toDate: now, limit: 5_000 });
  return buildSecurityAnalytics(rows.map(({ event }) => event), now);
}

export async function getSecurityOverview() {
  const [settings, policies, events] = await Promise.all([
    getSecuritySettings(),
    listSecurityIpPolicies(),
    listSecurityEvents({ limit: 250 }),
  ]);
  const recent = events.filter(({ event }) => event.createdAt.getTime() >= Date.now() - 24 * 60 * 60 * 1000);
  return {
    settings,
    policies,
    events,
    metrics: {
      activeBlocks: policies.filter(policy => policy.mode === "block" && policy.isActive && (!policy.expiresAt || policy.expiresAt.getTime() > Date.now())).length,
      activeAllows: policies.filter(policy => policy.mode === "allow" && policy.isActive && (!policy.expiresAt || policy.expiresAt.getTime() > Date.now())).length,
      rateLimited24h: recent.filter(({ event }) => event.eventType === "rate_limited").length,
      highSeverity24h: recent.filter(({ event }) => event.severity === "high" || event.severity === "critical").length,
    },
  };
}

// TODO: add feature queries here as your schema grows.
