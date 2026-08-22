import {
  boolean,
  date,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Stable identity key for local or Microsoft Entra users. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const localCredentials = mysqlTable(
  "local_credentials",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: varchar("passwordHash", { length: 256 }).notNull(),
    passwordSalt: varchar("passwordSalt", { length: 128 }).notNull(),
    failedAttempts: int("failedAttempts").default(0).notNull(),
    lockedUntil: timestamp("lockedUntil"),
    totpSecretEncrypted: text("totpSecretEncrypted"),
    recoveryCodesEncrypted: text("recoveryCodesEncrypted"),
    mfaEnabled: boolean("mfaEnabled").default(false).notNull(),
    mfaRequired: boolean("mfaRequired").default(false).notNull(),
    mfaEnrolledAt: timestamp("mfaEnrolledAt"),
    mustChangePassword: boolean("mustChangePassword").default(false).notNull(),
    passwordChangedAt: timestamp("passwordChangedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("local_credentials_user_unique").on(table.userId),
    uniqueIndex("local_credentials_email_unique").on(table.email),
  ],
);

export const appSessions = mysqlTable(
  "app_sessions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
    revokedAt: timestamp("revokedAt"),
    authState: mysqlEnum("authState", ["full", "password_change_required", "mfa_enrollment_required", "mfa_verification_required"])
      .default("full")
      .notNull(),
    userAgentHash: varchar("userAgentHash", { length: 64 }),
    ipHash: varchar("ipHash", { length: 64 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("app_sessions_token_hash_unique").on(table.tokenHash),
    index("app_sessions_user_expiry_idx").on(table.userId, table.expiresAt),
  ],
);

export type LocalCredential = typeof localCredentials.$inferSelect;
export type AppSession = typeof appSessions.$inferSelect;

export const employeeProfiles = mysqlTable(
  "employee_profiles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").references(() => users.id, { onDelete: "set null" }),
    entraUserId: varchar("entraUserId", { length: 128 }),
    displayName: varchar("displayName", { length: 200 }).notNull(),
    email: varchar("email", { length: 320 }),
    jobTitle: varchar("jobTitle", { length: 200 }),
    department: varchar("department", { length: 200 }),
    officeLocation: varchar("officeLocation", { length: 200 }),
    bio: text("bio"),
    phone: varchar("phone", { length: 64 }),
    photoUrl: text("photoUrl"),
    managerEntraUserId: varchar("managerEntraUserId", { length: 128 }),
    birthdayMonth: int("birthdayMonth"),
    birthdayDay: int("birthdayDay"),
    source: mysqlEnum("source", ["local", "entra", "hybrid"])
      .default("local")
      .notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    lastSyncedAt: timestamp("lastSyncedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("employee_profiles_user_id_unique").on(table.userId),
    uniqueIndex("employee_profiles_entra_id_unique").on(table.entraUserId),
    index("employee_profiles_department_idx").on(table.department),
  ]
);

export const microsoftOauthSessions = mysqlTable(
  "microsoft_oauth_sessions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tenantId: varchar("tenantId", { length: 64 }).notNull(),
    encryptedTokenSet: text("encryptedTokenSet").notNull(),
    scopes: text("scopes"),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("microsoft_oauth_sessions_user_unique").on(table.userId)],
);

export const samlRequestCorrelations = mysqlTable("saml_request_correlations", {
  requestId: varchar("requestId", { length: 160 }).primaryKey(),
  requestValue: text("requestValue").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const announcements = mysqlTable(
  "announcements",
  {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 240 }).notNull(),
    slug: varchar("slug", { length: 260 }).notNull(),
    summary: text("summary"),
    body: text("body").notNull(),
    category: varchar("category", { length: 100 }).default("Company").notNull(),
    status: mysqlEnum("status", ["draft", "published", "archived"])
      .default("draft")
      .notNull(),
    isPinned: boolean("isPinned").default(false).notNull(),
    publishAt: timestamp("publishAt"),
    expiresAt: timestamp("expiresAt"),
    authorUserId: int("authorUserId").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("announcements_slug_unique").on(table.slug),
    index("announcements_status_publish_idx").on(table.status, table.publishAt),
  ]
);

export const companyEvents = mysqlTable(
  "company_events",
  {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 240 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 100 }).default("Company").notNull(),
    location: varchar("location", { length: 240 }),
    meetingUrl: text("meetingUrl"),
    startAt: timestamp("startAt").notNull(),
    endAt: timestamp("endAt").notNull(),
    isAllDay: boolean("isAllDay").default(false).notNull(),
    status: mysqlEnum("status", ["draft", "published", "cancelled", "archived"])
      .default("draft")
      .notNull(),
    authorUserId: int("authorUserId").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("company_events_range_idx").on(table.startAt, table.endAt)],
);

export const dashboardPins = mysqlTable(
  "dashboard_pins",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pinType: mysqlEnum("pinType", ["hr_document", "event"]).notNull(),
    targetKey: varchar("targetKey", { length: 255 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("dashboard_pins_user_type_target_unique").on(table.userId, table.pinType, table.targetKey),
    index("dashboard_pins_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const holidays = mysqlTable(
  "holidays",
  {
    id: int("id").autoincrement().primaryKey(),
    externalId: varchar("externalId", { length: 180 }),
    title: varchar("title", { length: 240 }).notNull(),
    description: text("description"),
    startDate: date("startDate").notNull(),
    endDate: date("endDate").notNull(),
    isObserved: boolean("isObserved").default(false).notNull(),
    sourceUpdatedAt: timestamp("sourceUpdatedAt"),
    syncedAt: timestamp("syncedAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("holidays_external_id_unique").on(table.externalId),
    index("holidays_date_range_idx").on(table.startDate, table.endDate),
  ]
);

export const importantLinks = mysqlTable(
  "important_links",
  {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description"),
    url: text("url").notNull(),
    category: varchar("category", { length: 100 }).default("Resources").notNull(),
    iconKey: varchar("iconKey", { length: 64 }).default("link").notNull(),
    sortOrder: int("sortOrder").default(0).notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdByUserId: int("createdByUserId").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("important_links_title_unique").on(table.title),
    index("important_links_category_sort_idx").on(table.category, table.sortOrder),
  ],
);

export const contentBlocks = mysqlTable(
  "content_blocks",
  {
    id: int("id").autoincrement().primaryKey(),
    pageKey: varchar("pageKey", { length: 80 }).notNull(),
    sectionKey: varchar("sectionKey", { length: 120 }).notNull(),
    eyebrow: varchar("eyebrow", { length: 160 }),
    title: varchar("title", { length: 240 }).notNull(),
    body: text("body").notNull(),
    mediaUrl: text("mediaUrl"),
    sortOrder: int("sortOrder").default(0).notNull(),
    isPublished: boolean("isPublished").default(true).notNull(),
    updatedByUserId: int("updatedByUserId").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("content_blocks_page_section_unique").on(table.pageKey, table.sectionKey),
    index("content_blocks_page_sort_idx").on(table.pageKey, table.sortOrder),
  ]
);

export const founders = mysqlTable(
  "founders",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    title: varchar("title", { length: 200 }),
    bio: text("bio").notNull(),
    photoUrl: text("photoUrl"),
    sortOrder: int("sortOrder").default(0).notNull(),
    isPublished: boolean("isPublished").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("founders_sort_idx").on(table.sortOrder)],
);

export const milestones = mysqlTable(
  "milestones",
  {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 240 }).notNull(),
    description: text("description").notNull(),
    eventDate: date("eventDate").notNull(),
    sortOrder: int("sortOrder").default(0).notNull(),
    isPublished: boolean("isPublished").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("milestones_date_idx").on(table.eventDate)],
);

export const technologyEmbeds = mysqlTable(
  "technology_embeds",
  {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    url: text("url").notNull(),
    allowedHostname: varchar("allowedHostname", { length: 253 }).notNull(),
    sortOrder: int("sortOrder").default(0).notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdByUserId: int("createdByUserId").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("technology_embeds_sort_idx").on(table.sortOrder)],
);

export const integrationSettings = mysqlTable(
  "integration_settings",
  {
    id: int("id").autoincrement().primaryKey(),
    provider: varchar("provider", { length: 64 }).notNull(),
    displayName: varchar("displayName", { length: 160 }).notNull(),
    publicConfigJson: text("publicConfigJson"),
    encryptedSecrets: text("encryptedSecrets"),
    secretMaskJson: text("secretMaskJson"),
    status: mysqlEnum("status", ["unconfigured", "configured", "connected", "degraded", "error"])
      .default("unconfigured")
      .notNull(),
    lastTestedAt: timestamp("lastTestedAt"),
    updatedByUserId: int("updatedByUserId").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("integration_settings_provider_unique").on(table.provider)],
);

export const connectionDiagnostics = mysqlTable(
  "connection_diagnostics",
  {
    id: int("id").autoincrement().primaryKey(),
    provider: varchar("provider", { length: 64 }).notNull(),
    target: varchar("target", { length: 240 }).notNull(),
    status: mysqlEnum("status", ["success", "failure", "unconfigured"]).notNull(),
    message: text("message").notNull(),
    durationMs: int("durationMs").default(0).notNull(),
    testedByUserId: int("testedByUserId").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("connection_diagnostics_provider_created_idx").on(table.provider, table.createdAt)],
);

export const backupDestinations = mysqlTable(
  "backup_destinations",
  {
    id: int("id").autoincrement().primaryKey(),
    provider: varchar("provider", { length: 64 }).notNull(),
    displayName: varchar("displayName", { length: 160 }).notNull(),
    publicConfigJson: text("publicConfigJson"),
    encryptedSecrets: text("encryptedSecrets"),
    secretMaskJson: text("secretMaskJson"),
    isEnabled: boolean("isEnabled").default(false).notNull(),
    status: mysqlEnum("status", ["unconfigured", "configured", "connected", "degraded", "error"])
      .default("unconfigured")
      .notNull(),
    lastTestedAt: timestamp("lastTestedAt"),
    scheduleCron: varchar("scheduleCron", { length: 120 }),
    scheduleEnabled: boolean("scheduleEnabled").default(false).notNull(),
    lastScheduledDispatchAt: timestamp("lastScheduledDispatchAt"),
    /** Retained only for a non-destructive migration from the former managed scheduler. */
    scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
    createdByUserId: int("createdByUserId").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("backup_destinations_provider_name_unique").on(table.provider, table.displayName),
    index("backup_destinations_task_uid_idx").on(table.scheduleCronTaskUid),
    index("backup_destinations_schedule_idx").on(table.scheduleEnabled, table.lastScheduledDispatchAt),
  ]
);

export const backupRuns = mysqlTable(
  "backup_runs",
  {
    id: int("id").autoincrement().primaryKey(),
    destinationId: int("destinationId")
      .notNull()
      .references(() => backupDestinations.id, { onDelete: "restrict" }),
    runType: mysqlEnum("runType", ["dry_run", "backup"]).notNull(),
    status: mysqlEnum("status", ["pending", "running", "succeeded", "failed"])
      .default("pending")
      .notNull(),
    artifactName: varchar("artifactName", { length: 240 }),
    checksumSha256: varchar("checksumSha256", { length: 64 }),
    byteSize: int("byteSize"),
    message: text("message"),
    startedAt: timestamp("startedAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
    triggeredByUserId: int("triggeredByUserId").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("backup_runs_destination_started_idx").on(table.destinationId, table.startedAt)],
);

export const restoreRuns = mysqlTable(
  "restore_runs",
  {
    id: int("id").autoincrement().primaryKey(),
    backupRunId: int("backupRunId")
      .notNull()
      .references(() => backupRuns.id, { onDelete: "restrict" }),
    destinationId: int("destinationId")
      .notNull()
      .references(() => backupDestinations.id, { onDelete: "restrict" }),
    status: mysqlEnum("status", ["pending", "running", "succeeded", "failed", "blocked"])
      .default("pending")
      .notNull(),
    confirmationValue: varchar("confirmationValue", { length: 160 }).notNull(),
    message: text("message"),
    requestedByUserId: int("requestedByUserId")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    startedAt: timestamp("startedAt"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("restore_runs_backup_created_idx").on(table.backupRunId, table.createdAt)],
);

export const operationAuditEvents = mysqlTable(
  "operation_audit_events",
  {
    id: int("id").autoincrement().primaryKey(),
    entityType: mysqlEnum("entityType", ["backup_run", "restore_run", "backup_destination"]).notNull(),
    entityId: int("entityId").notNull(),
    eventType: varchar("eventType", { length: 80 }).notNull(),
    status: varchar("status", { length: 40 }).notNull(),
    message: text("message").notNull(),
    metadataJson: text("metadataJson"),
    actorUserId: int("actorUserId").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("operation_audit_entity_created_idx").on(table.entityType, table.entityId, table.createdAt)],
);

export type EmployeeProfile = typeof employeeProfiles.$inferSelect;
export type InsertEmployeeProfile = typeof employeeProfiles.$inferInsert;
export type MicrosoftOauthSession = typeof microsoftOauthSessions.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type CompanyEvent = typeof companyEvents.$inferSelect;
export type DashboardPin = typeof dashboardPins.$inferSelect;
export type Holiday = typeof holidays.$inferSelect;
export type ImportantLink = typeof importantLinks.$inferSelect;
export type ContentBlock = typeof contentBlocks.$inferSelect;
export type Founder = typeof founders.$inferSelect;
export type Milestone = typeof milestones.$inferSelect;
export type TechnologyEmbed = typeof technologyEmbeds.$inferSelect;
export type IntegrationSetting = typeof integrationSettings.$inferSelect;
export type ConnectionDiagnostic = typeof connectionDiagnostics.$inferSelect;
export type BackupDestination = typeof backupDestinations.$inferSelect;
export type BackupRun = typeof backupRuns.$inferSelect;
export type RestoreRun = typeof restoreRuns.$inferSelect;
export type OperationAuditEvent = typeof operationAuditEvents.$inferSelect;
