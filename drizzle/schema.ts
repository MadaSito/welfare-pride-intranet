import {
  boolean,
  date,
  foreignKey,
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

export const entraGroups = mysqlTable(
  "entra_groups",
  {
    groupId: varchar("groupId", { length: 128 }).primaryKey(),
    displayName: varchar("displayName", { length: 240 }).notNull(),
    lastSyncedAt: timestamp("lastSyncedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("entra_groups_display_name_idx").on(table.displayName)],
);

export const userEntraGroupMemberships = mysqlTable(
  "user_entra_group_memberships",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    entraGroupId: varchar("entraGroupId", { length: 128 })
      .notNull(),
    syncedAt: timestamp("syncedAt").defaultNow().notNull(),
  },
  table => [
    foreignKey({
      columns: [table.entraGroupId],
      foreignColumns: [entraGroups.groupId],
      name: "uegm_group_fk",
    }).onDelete("cascade"),
    uniqueIndex("user_entra_group_memberships_unique").on(table.userId, table.entraGroupId),
    index("user_entra_group_memberships_group_idx").on(table.entraGroupId),
  ],
);

export const portalResources = mysqlTable(
  "portal_resources",
  {
    id: int("id").autoincrement().primaryKey(),
    resourceKey: varchar("resourceKey", { length: 140 }).notNull(),
    resourceType: mysqlEnum("resourceType", ["module", "page"]).notNull(),
    label: varchar("label", { length: 160 }).notNull(),
    path: varchar("path", { length: 220 }).notNull(),
    navigationGroup: varchar("navigationGroup", { length: 120 }).default("Workplace").notNull(),
    iconKey: varchar("iconKey", { length: 64 }).default("file-text").notNull(),
    body: text("body"),
    accessMode: mysqlEnum("accessMode", ["all_authenticated", "restricted"])
      .default("all_authenticated")
      .notNull(),
    isPublished: boolean("isPublished").default(true).notNull(),
    isSystem: boolean("isSystem").default(false).notNull(),
    sortOrder: int("sortOrder").default(0).notNull(),
    createdByUserId: int("createdByUserId").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("portal_resources_key_unique").on(table.resourceKey),
    uniqueIndex("portal_resources_path_unique").on(table.path),
    index("portal_resources_published_sort_idx").on(table.isPublished, table.navigationGroup, table.sortOrder),
  ],
);

export const portalResourceAssignments = mysqlTable(
  "portal_resource_assignments",
  {
    id: int("id").autoincrement().primaryKey(),
    resourceId: int("resourceId")
      .notNull()
      .references(() => portalResources.id, { onDelete: "cascade" }),
    subjectType: mysqlEnum("subjectType", ["user", "entra_group"]).notNull(),
    userId: int("userId").references(() => users.id, { onDelete: "cascade" }),
    entraGroupId: varchar("entraGroupId", { length: 128 }).references(() => entraGroups.groupId, { onDelete: "cascade" }),
    createdByUserId: int("createdByUserId").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("portal_resource_assignments_user_unique").on(table.resourceId, table.userId),
    uniqueIndex("portal_resource_assignments_group_unique").on(table.resourceId, table.entraGroupId),
    index("portal_resource_assignments_resource_idx").on(table.resourceId),
  ],
);

export const portalAccessRequests = mysqlTable(
  "portal_access_requests",
  {
    id: int("id").autoincrement().primaryKey(),
    resourceId: int("resourceId")
      .notNull()
      .references(() => portalResources.id, { onDelete: "cascade" }),
    requesterUserId: int("requesterUserId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    note: varchar("note", { length: 500 }),
    status: mysqlEnum("status", ["pending", "approved", "declined"]).default("pending").notNull(),
    reviewedByUserId: int("reviewedByUserId").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("portal_access_requests_resource_status_idx").on(table.resourceId, table.status, table.createdAt),
    index("portal_access_requests_requester_status_idx").on(table.requesterUserId, table.status, table.createdAt),
  ],
);

export const adminAccessRequestNotifications = mysqlTable(
  "admin_access_request_notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    accessRequestId: int("accessRequestId").notNull(),
    recipientUserId: int("recipientUserId").notNull(),
    readAt: timestamp("readAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    foreignKey({
      columns: [table.accessRequestId],
      foreignColumns: [portalAccessRequests.id],
      name: "aarn_request_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.recipientUserId],
      foreignColumns: [users.id],
      name: "aarn_recipient_fk",
    }).onDelete("cascade"),
    uniqueIndex("admin_request_notifications_unique").on(table.accessRequestId, table.recipientUserId),
    index("admin_request_notifications_unread_idx").on(table.recipientUserId, table.readAt, table.createdAt),
  ],
);

export const accessControlAuditEvents = mysqlTable(
  "access_control_audit_events",
  {
    id: int("id").autoincrement().primaryKey(),
    action: varchar("action", { length: 120 }).notNull(),
    resourceId: int("resourceId").references(() => portalResources.id, { onDelete: "set null" }),
    actorUserId: int("actorUserId").references(() => users.id, { onDelete: "set null" }),
    metadataJson: text("metadataJson"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("access_control_audit_events_resource_created_idx").on(table.resourceId, table.createdAt)],
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

export const securitySettings = mysqlTable(
  "security_settings",
  {
    id: int("id").primaryKey(),
    allowlistEnabled: boolean("allowlistEnabled").default(false).notNull(),
    rateLimitRequests: int("rateLimitRequests").default(120).notNull(),
    rateLimitWindowSeconds: int("rateLimitWindowSeconds").default(60).notNull(),
    autoBlockThreshold: int("autoBlockThreshold").default(0).notNull(),
    autoBlockDurationMinutes: int("autoBlockDurationMinutes").default(30).notNull(),
    alertingEnabled: boolean("alertingEnabled").default(true).notNull(),
    highSeverityAlertThreshold: int("highSeverityAlertThreshold").default(3).notNull(),
    highSeverityAlertWindowMinutes: int("highSeverityAlertWindowMinutes").default(15).notNull(),
    updatedByUserId: int("updatedByUserId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    foreignKey({
      columns: [table.updatedByUserId],
      foreignColumns: [users.id],
      name: "ss_updated_fk",
    }).onDelete("set null"),
  ],
);

export const securityIpPolicies = mysqlTable(
  "security_ip_policies",
  {
    id: int("id").autoincrement().primaryKey(),
    mode: mysqlEnum("mode", ["allow", "block"]).notNull(),
    ipAddress: varchar("ipAddress", { length: 45 }).notNull(),
    label: varchar("label", { length: 160 }).notNull(),
    expiresAt: timestamp("expiresAt"),
    isActive: boolean("isActive").default(true).notNull(),
    createdByUserId: int("createdByUserId"),
    revokedAt: timestamp("revokedAt"),
    revokedByUserId: int("revokedByUserId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    foreignKey({
      columns: [table.createdByUserId],
      foreignColumns: [users.id],
      name: "sip_created_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.revokedByUserId],
      foreignColumns: [users.id],
      name: "sip_revoked_fk",
    }).onDelete("set null"),
    uniqueIndex("security_ip_policies_mode_ip_unique").on(table.mode, table.ipAddress),
    index("security_ip_policies_active_idx").on(table.isActive, table.mode, table.expiresAt),
  ],
);

export const securityEvents = mysqlTable(
  "security_events",
  {
    id: int("id").autoincrement().primaryKey(),
    correlationId: varchar("correlationId", { length: 64 }).notNull(),
    eventType: varchar("eventType", { length: 120 }).notNull(),
    severity: mysqlEnum("severity", ["info", "low", "medium", "high", "critical"]).notNull(),
    ipAddress: varchar("ipAddress", { length: 45 }),
    method: varchar("method", { length: 12 }),
    requestPath: varchar("requestPath", { length: 240 }),
    userAgentHash: varchar("userAgentHash", { length: 64 }),
    actorUserId: int("actorUserId"),
    detailsJson: text("detailsJson"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    foreignKey({
      columns: [table.actorUserId],
      foreignColumns: [users.id],
      name: "se_actor_fk",
    }).onDelete("set null"),
    index("security_events_corr_created_idx").on(table.correlationId, table.createdAt),
    index("security_events_ip_created_idx").on(table.ipAddress, table.createdAt),
    index("security_events_severity_created_idx").on(table.severity, table.createdAt),
    index("security_events_type_created_idx").on(table.eventType, table.createdAt),
  ],
);

export const securityAlertNotifications = mysqlTable(
  "security_alert_notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    triggerEventId: int("triggerEventId").notNull(),
    recipientUserId: int("recipientUserId").notNull(),
    correlationId: varchar("correlationId", { length: 64 }).notNull(),
    eventType: varchar("eventType", { length: 120 }).notNull(),
    severity: mysqlEnum("severity", ["high", "critical"]).notNull(),
    ipAddress: varchar("ipAddress", { length: 45 }),
    matchedEventCount: int("matchedEventCount").notNull(),
    windowMinutes: int("windowMinutes").notNull(),
    readAt: timestamp("readAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    foreignKey({
      columns: [table.triggerEventId],
      foreignColumns: [securityEvents.id],
      name: "san_event_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.recipientUserId],
      foreignColumns: [users.id],
      name: "san_recipient_fk",
    }).onDelete("cascade"),
    uniqueIndex("security_alert_notif_unique").on(table.triggerEventId, table.recipientUserId),
    index("security_alert_notif_unread_idx").on(table.recipientUserId, table.readAt, table.createdAt),
  ],
);

export const securityEventReadCursors = mysqlTable(
  "security_event_read_cursors",
  {
    recipientUserId: int("recipientUserId").primaryKey(),
    lastReadEventId: int("lastReadEventId").default(0).notNull(),
    readAt: timestamp("readAt").defaultNow().notNull(),
  },
  table => [
    foreignKey({ columns: [table.recipientUserId], foreignColumns: [users.id], name: "serc_recipient_fk" }).onDelete("cascade"),
  ],
);

export const securityEscalationOwners = mysqlTable(
  "security_escalation_owners",
  {
    userId: int("userId").primaryKey(),
    assignedByUserId: int("assignedByUserId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    foreignKey({ columns: [table.userId], foreignColumns: [users.id], name: "seo_user_fk" }).onDelete("cascade"),
    foreignKey({ columns: [table.assignedByUserId], foreignColumns: [users.id], name: "seo_assigned_fk" }).onDelete("restrict"),
  ],
);

export const securityIncidentCases = mysqlTable(
  "security_incident_cases",
  {
    id: int("id").autoincrement().primaryKey(),
    triggerEventId: int("triggerEventId").notNull(),
    caseReference: varchar("caseReference", { length: 80 }).notNull(),
    status: mysqlEnum("status", ["acknowledged", "resolved"]).default("acknowledged").notNull(),
    ownerUserId: int("ownerUserId"),
    acknowledgedByUserId: int("acknowledgedByUserId").notNull(),
    acknowledgedAt: timestamp("acknowledgedAt").defaultNow().notNull(),
    resolutionNotes: text("resolutionNotes"),
    resolvedByUserId: int("resolvedByUserId"),
    resolvedAt: timestamp("resolvedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    foreignKey({ columns: [table.triggerEventId], foreignColumns: [securityEvents.id], name: "sic_event_fk" }).onDelete("cascade"),
    foreignKey({ columns: [table.ownerUserId], foreignColumns: [users.id], name: "sic_owner_fk" }).onDelete("set null"),
    foreignKey({ columns: [table.acknowledgedByUserId], foreignColumns: [users.id], name: "sic_ack_fk" }).onDelete("restrict"),
    foreignKey({ columns: [table.resolvedByUserId], foreignColumns: [users.id], name: "sic_resolved_fk" }).onDelete("set null"),
    uniqueIndex("security_incident_case_event_unique").on(table.triggerEventId),
    uniqueIndex("security_incident_case_ref_unique").on(table.caseReference),
    index("security_incident_case_status_idx").on(table.status, table.updatedAt),
  ],
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
export type EntraGroup = typeof entraGroups.$inferSelect;
export type PortalResource = typeof portalResources.$inferSelect;
export type PortalResourceAssignment = typeof portalResourceAssignments.$inferSelect;
export type AdminAccessRequestNotification = typeof adminAccessRequestNotifications.$inferSelect;
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
export type SecuritySettings = typeof securitySettings.$inferSelect;
export type SecurityIpPolicy = typeof securityIpPolicies.$inferSelect;
export type SecurityEvent = typeof securityEvents.$inferSelect;
export type SecurityAlertNotification = typeof securityAlertNotifications.$inferSelect;
export type SecurityEventReadCursor = typeof securityEventReadCursors.$inferSelect;
export type SecurityEscalationOwner = typeof securityEscalationOwners.$inferSelect;
export type SecurityIncidentCase = typeof securityIncidentCases.$inferSelect;
