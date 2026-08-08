import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { parse as parseCookie } from "cookie";
import { z } from "zod";
import * as db from "../db";
import { createHeartbeatJob, deleteHeartbeatJob, updateHeartbeatJob } from "../_core/heartbeat";
import { adminProcedure, router } from "../_core/trpc";
import { configuredSecretMask, decryptJson, encryptJson } from "../security/encryption";
import { executeBackupRun, executeRestoreVerification, testBackupDestination } from "../integrations/backupAdapters";
import { testMicrosoftGraphConnection, testSharePointRestConnection } from "../integrations/diagnostics";
import type { BackupPublicConfig, BackupSecrets, MicrosoftPublicConfig, MicrosoftSecrets } from "../integrations/contracts";

const connectionStatus = z.enum(["unconfigured", "configured", "connected", "degraded", "error"]);
const backupProvider = z.enum(["sharepoint", "onedrive", "google_drive", "aws_s3", "wasabi", "backblaze_b2", "azure_blob"]);
const optionalText = z.string().trim().max(2000).optional();
const optionalSecret = z.string().trim().max(20000).optional();

function publicIntegration(setting: Awaited<ReturnType<typeof db.getIntegrationSettingByProvider>>) {
  if (!setting) return null;
  return { id: setting.id, provider: setting.provider, displayName: setting.displayName, publicConfig: setting.publicConfigJson ? JSON.parse(setting.publicConfigJson) : {}, secretMask: setting.secretMaskJson ? JSON.parse(setting.secretMaskJson) : {}, status: setting.status, lastTestedAt: setting.lastTestedAt, updatedAt: setting.updatedAt };
}

function publicDestination(destination: NonNullable<Awaited<ReturnType<typeof db.getBackupDestinationById>>>) {
  return { id: destination.id, provider: destination.provider, displayName: destination.displayName, publicConfig: destination.publicConfigJson ? JSON.parse(destination.publicConfigJson) : {}, secretMask: destination.secretMaskJson ? JSON.parse(destination.secretMaskJson) : {}, isEnabled: destination.isEnabled, status: destination.status, lastTestedAt: destination.lastTestedAt, scheduleCronTaskUid: destination.scheduleCronTaskUid, updatedAt: destination.updatedAt };
}

async function persistDiagnostic(result: { provider: string; target: string; status: "success" | "failure" | "unconfigured"; message: string; durationMs: number; testedAt: Date }, userId: number) {
  await db.createConnectionDiagnostic({ provider: result.provider, target: result.target, status: result.status, message: result.message, durationMs: result.durationMs, testedByUserId: userId, createdAt: result.testedAt });
  return result;
}

export const adminSettingsRouter = router({
  overview: adminProcedure.query(async () => ({ microsoft: publicIntegration(await db.getIntegrationSettingByProvider("microsoft_entra")), diagnostics: await db.listConnectionDiagnostics(80) })),
  saveMicrosoft: adminProcedure.input(z.object({
    tenantId: z.string().trim().min(1).max(128), clientId: z.string().trim().min(1).max(128), clientSecret: optionalSecret,
    authorityUrl: optionalText, redirectUri: optionalText, graphBaseUrl: optionalText, graphScopes: optionalText,
    samlEntryPoint: optionalText, samlIssuer: optionalText, samlIdpIssuer: optionalText, samlCallbackUrl: optionalText, samlCertificate: optionalSecret,
    sharePointSiteUrl: optionalText, sharePointSiteId: optionalText, holidayListId: optionalText, hrLibraryId: optionalText,
  })).mutation(async ({ ctx, input }) => {
    const existing = await db.getIntegrationSettingByProvider("microsoft_entra");
    const previousSecrets = existing?.encryptedSecrets ? decryptJson<MicrosoftSecrets>(existing.encryptedSecrets) : {};
    const secrets: MicrosoftSecrets = { ...previousSecrets, ...(input.clientSecret ? { clientSecret: input.clientSecret } : {}), ...(input.samlCertificate ? { samlCertificate: input.samlCertificate } : {}) };
    if (!secrets.clientSecret) throw new TRPCError({ code: "BAD_REQUEST", message: "Client Secret is required for initial configuration." });
    const { clientSecret: _clientSecret, samlCertificate: _samlCertificate, ...publicInput } = input;
    const publicConfig: MicrosoftPublicConfig = {
      tenantId: publicInput.tenantId, clientId: publicInput.clientId,
      authorityUrl: publicInput.authorityUrl || "https://login.microsoftonline.com",
      redirectUri: publicInput.redirectUri || null || undefined,
      graphBaseUrl: publicInput.graphBaseUrl || "https://graph.microsoft.com/v1.0",
      graphScopes: publicInput.graphScopes || "openid profile email offline_access User.Read User.ReadBasic.All Sites.Read.All",
      samlEntryPoint: publicInput.samlEntryPoint || `https://login.microsoftonline.com/${publicInput.tenantId}/saml2`,
      samlIssuer: publicInput.samlIssuer || undefined,
      samlIdpIssuer: publicInput.samlIdpIssuer || `https://sts.windows.net/${publicInput.tenantId}/`,
      samlCallbackUrl: publicInput.samlCallbackUrl || undefined,
      sharePointSiteUrl: publicInput.sharePointSiteUrl || undefined, sharePointSiteId: publicInput.sharePointSiteId || undefined,
      holidayListId: publicInput.holidayListId || undefined, hrLibraryId: publicInput.hrLibraryId || undefined,
    };
    const encryptedSecrets = encryptJson(secrets); const secretMaskJson = JSON.stringify(configuredSecretMask(secrets));
    await db.upsertIntegrationSetting({ provider: "microsoft_entra", displayName: "Microsoft Entra ID and Graph", publicConfigJson: JSON.stringify(publicConfig), encryptedSecrets, secretMaskJson, status: "configured", updatedByUserId: ctx.user.id });
    await db.upsertIntegrationSetting({ provider: "sharepoint", displayName: "Microsoft SharePoint", publicConfigJson: JSON.stringify(publicConfig), secretMaskJson, status: "configured", updatedByUserId: ctx.user.id });
    return publicIntegration(await db.getIntegrationSettingByProvider("microsoft_entra"));
  }),
  testMicrosoftGraph: adminProcedure.mutation(async ({ ctx }) => { const result = await persistDiagnostic(await testMicrosoftGraphConnection(), ctx.user.id); await db.updateIntegrationConnectionStatus("microsoft_entra", result.status === "success" ? "connected" : "error"); return result; }),
  testSharePointRest: adminProcedure.mutation(async ({ ctx }) => { const result = await persistDiagnostic(await testSharePointRestConnection(), ctx.user.id); await db.updateIntegrationConnectionStatus("sharepoint", result.status === "success" ? "connected" : "error"); return result; }),
});

const destinationPublicConfig = z.object({ clientId: optionalText, endpoint: optionalText, region: optionalText, bucket: optionalText, container: optionalText, driveId: optionalText, folderPath: optionalText, accountName: optionalText });
const destinationSecrets = z.object({ accessKeyId: optionalText, secretAccessKey: optionalText, applicationKeyId: optionalText, applicationKey: optionalText, connectionString: optionalText, refreshToken: optionalText, clientSecret: optionalText });

export const backupsRouter = router({
  overview: adminProcedure.query(async () => ({ destinations: (await db.listBackupDestinations()).map(item => publicDestination(item)), runs: await db.listBackupRuns(100), restores: await db.listRestoreRuns(100), auditEvents: await db.listOperationAuditEvents(200) })),
  saveDestination: adminProcedure.input(z.object({ id: z.number().int().positive().optional(), provider: backupProvider, displayName: z.string().trim().min(1).max(160), publicConfig: destinationPublicConfig, secrets: destinationSecrets, isEnabled: z.boolean(), status: connectionStatus.optional() })).mutation(async ({ ctx, input }) => {
    const existing = input.id ? await db.getBackupDestinationById(input.id) : undefined;
    const previousSecrets = existing?.encryptedSecrets ? decryptJson<BackupSecrets>(existing.encryptedSecrets) : {};
    const submittedSecrets = Object.fromEntries(Object.entries(input.secrets).filter(([, value]) => typeof value === "string" && value.length > 0)) as BackupSecrets;
    const secrets = { ...previousSecrets, ...submittedSecrets };
    const destination = await db.upsertBackupDestination({ provider: input.provider, displayName: input.displayName, publicConfigJson: JSON.stringify(input.publicConfig satisfies BackupPublicConfig), encryptedSecrets: Object.keys(secrets).length ? encryptJson(secrets) : existing?.encryptedSecrets, secretMaskJson: JSON.stringify(configuredSecretMask(secrets)), isEnabled: input.isEnabled, status: existing?.status || "configured", createdByUserId: ctx.user.id });
    if (!destination) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Backup destination could not be saved." });
    return publicDestination(destination);
  }),
  testDestination: adminProcedure.input(z.object({ destinationId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const destination = await db.getBackupDestinationById(input.destinationId); if (!destination) throw new TRPCError({ code: "NOT_FOUND", message: "Backup destination not found." }); const result = await testBackupDestination(destination); await persistDiagnostic(result, ctx.user.id); await db.updateBackupDestinationConnectionStatus(destination.id, result.status === "success" ? "connected" : "error"); return result; }),
  run: adminProcedure.input(z.object({ destinationId: z.number().int().positive(), runType: z.enum(["dry_run", "backup"]) })).mutation(async ({ ctx, input }) => { const destination = await db.getBackupDestinationById(input.destinationId); if (!destination) throw new TRPCError({ code: "NOT_FOUND", message: "Backup destination not found." }); if (!destination.isEnabled) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Enable the destination before running backup operations." }); try { return await executeBackupRun(destination, input.runType, ctx.user.id); } catch (error) { throw new TRPCError({ code: "PRECONDITION_FAILED", message: error instanceof Error ? error.message : "Backup operation failed." }); } }),
  restore: adminProcedure.input(z.object({ backupRunId: z.number().int().positive(), confirmationValue: z.literal("RESTORE") })).mutation(async ({ ctx, input }) => { const run = await db.getBackupRunById(input.backupRunId); if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Backup run not found." }); const destination = await db.getBackupDestinationById(run.destinationId); if (!destination) throw new TRPCError({ code: "NOT_FOUND", message: "Backup destination not found." }); const restoreId = await db.createRestoreRun({ backupRunId: run.id, destinationId: destination.id, status: "running", confirmationValue: input.confirmationValue, requestedByUserId: ctx.user.id, startedAt: new Date() }); await db.appendOperationAuditEvent({ entityType: "restore_run", entityId: restoreId, eventType: "restore_verification_started", status: "running", message: `Restore verification started for backup run ${run.id}.`, metadataJson: JSON.stringify({ backupRunId: run.id, destinationId: destination.id, artifactName: run.artifactName }), actorUserId: ctx.user.id }); try { const result = await executeRestoreVerification(destination, run); const message = `Checksum-verified ${result.byteSize} bytes from ${result.reference}. Source overwrite is intentionally not performed by the portal control plane.`; await db.updateRestoreRun(restoreId, { status: "succeeded", message, completedAt: new Date() }); await db.appendOperationAuditEvent({ entityType: "restore_run", entityId: restoreId, eventType: "restore_verification_completed", status: "succeeded", message, metadataJson: JSON.stringify({ backupRunId: run.id, destinationId: destination.id, byteSize: result.byteSize, reference: result.reference }), actorUserId: ctx.user.id }); return { restoreId, ...result }; } catch (error) { const message = error instanceof Error ? error.message : "Restore verification failed."; await db.updateRestoreRun(restoreId, { status: "failed", message, completedAt: new Date() }); await db.appendOperationAuditEvent({ entityType: "restore_run", entityId: restoreId, eventType: "restore_verification_failed", status: "failed", message, metadataJson: JSON.stringify({ backupRunId: run.id, destinationId: destination.id }), actorUserId: ctx.user.id }); throw new TRPCError({ code: "PRECONDITION_FAILED", message }); } }),
  schedule: adminProcedure.input(z.object({ destinationId: z.number().int().positive(), cron: z.string().trim().refine(value => { const parts = value.split(/\s+/); return parts.length === 6 && parts[0] === "0"; }, "Use a six-field UTC cron expression with seconds set to 0.") })).mutation(async ({ ctx, input }) => { const destination = await db.getBackupDestinationById(input.destinationId); if (!destination) throw new TRPCError({ code: "NOT_FOUND", message: "Backup destination not found." }); const sessionToken = parseCookie(ctx.req.headers.cookie || "")[COOKIE_NAME] || ""; if (!sessionToken) throw new TRPCError({ code: "UNAUTHORIZED", message: "An authenticated browser session is required to create a schedule." }); if (destination.scheduleCronTaskUid) { const result = await updateHeartbeatJob(destination.scheduleCronTaskUid, { cron: input.cron, enable: true }, sessionToken); return { taskUid: destination.scheduleCronTaskUid, nextExecutionAt: result.nextExecutionAt }; } const result = await createHeartbeatJob({ name: `welfare-pride-backup-${destination.id}`, cron: input.cron, path: "/api/scheduled/backup", description: `Scheduled backup validation for ${destination.displayName}` }, sessionToken); await db.setBackupDestinationScheduleTaskUid(destination.id, result.taskUid); return result; }),
  setScheduleEnabled: adminProcedure.input(z.object({ destinationId: z.number().int().positive(), enabled: z.boolean() })).mutation(async ({ ctx, input }) => { const destination = await db.getBackupDestinationById(input.destinationId); if (!destination?.scheduleCronTaskUid) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This destination does not have a schedule." }); const sessionToken = parseCookie(ctx.req.headers.cookie || "")[COOKIE_NAME] || ""; await updateHeartbeatJob(destination.scheduleCronTaskUid, { enable: input.enabled }, sessionToken); return { success: true } as const; }),
  deleteSchedule: adminProcedure.input(z.object({ destinationId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const destination = await db.getBackupDestinationById(input.destinationId); if (!destination?.scheduleCronTaskUid) return { success: true } as const; const sessionToken = parseCookie(ctx.req.headers.cookie || "")[COOKIE_NAME] || ""; await deleteHeartbeatJob(destination.scheduleCronTaskUid, sessionToken); await db.setBackupDestinationScheduleTaskUid(destination.id, null); return { success: true } as const; }),
});
