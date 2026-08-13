import { and, asc, desc, eq, gt, gte, isNull, like, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2";
import {
  employeeProfiles,
  announcements,
  companyEvents,
  dashboardPins,
  holidays,
  technologyEmbeds,
  importantLinks,
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
} from "../drizzle/schema";
import { projectBirthdayDisplays } from "./privacy/birthdays";

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
  passwordHash: string;
  passwordSalt: string;
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
      email: input.email,
      passwordHash: input.passwordHash,
      passwordSalt: input.passwordSalt,
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

export async function createAppSessionRecord(input: {
  userId: number;
  tokenHash: string;
  expiresAt: Date;
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

// TODO: add feature queries here as your schema grows.
