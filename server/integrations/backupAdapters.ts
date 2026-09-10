import { createHash, randomBytes } from "node:crypto";
import { BlobServiceClient } from "@azure/storage-blob";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { BackupDestination } from "../../drizzle/schema";
import type { BackupProvider, ConnectionDiagnosticResult } from "../../shared/domain";
import * as db from "../db";
import { decryptJson, encryptJson } from "../security/encryption";
import { getMicrosoftApplicationToken } from "./microsoftGraph";
import type { BackupAdapter, BackupPublicConfig, BackupSecrets } from "./contracts";
import { backupScopeLabel, normalizeLocalRetentionDays } from "../backups/backupPolicy";

type StoredArtifact = { reference: string; body: Buffer };

interface OperationalBackupAdapter extends BackupAdapter {
  putArtifact(artifactName: string, body: Buffer): Promise<string>;
  readArtifact(artifactName: string): Promise<StoredArtifact>;
  deleteArtifact(artifactName: string): Promise<void>;
}

export function checksum(body: Buffer) {
  return createHash("sha256").update(body).digest("hex");
}

function parseDestination(destination: BackupDestination) {
  const publicConfig = destination.publicConfigJson
    ? (JSON.parse(destination.publicConfigJson) as BackupPublicConfig)
    : {};
  const secrets = destination.encryptedSecrets
    ? decryptJson<BackupSecrets>(destination.encryptedSecrets)
    : {};
  return { publicConfig, secrets };
}

function normalizePath(value?: string) {
  return (value || "welfare-pride-backups").replace(/^\/+|\/+$/g, "");
}

function sanitizedError(error: unknown) {
  const message = error instanceof Error ? error.message : "Connection failed";
  return message.replace(/(secret|token|password|key)=([^&\s]+)/gi, "$1=[redacted]").slice(0, 800);
}

function localBackupDirectory() { return process.env.BACKUP_LOCAL_DIR || path.join(process.cwd(), "data", "backups"); }
function safeLocalArtifactName(name: string) { return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_"); }

async function writeLocalArtifact(name: string, body: Buffer) {
  const directory = localBackupDirectory();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const safeName = safeLocalArtifactName(name);
  await writeFile(path.join(directory, safeName), body, { mode: 0o600 });
  return safeName;
}

async function purgeExpiredLocalArtifacts(destination: BackupDestination) {
  const retentionDays = normalizeLocalRetentionDays(destination.localRetentionDays);
  const expired = await db.listExpiredLocalBackupRuns(destination.id, new Date(Date.now() - retentionDays * 86400_000));
  for (const run of expired) {
    if (!run.localArtifactPath) continue;
    await unlink(path.join(localBackupDirectory(), safeLocalArtifactName(run.localArtifactPath))).catch(() => undefined);
    await db.updateBackupRun(run.id, { localArtifactPath: null });
  }
}

export async function readLocalBackupArtifact(run: NonNullable<Awaited<ReturnType<typeof db.getBackupRunById>>>) {
  if (!run.localArtifactPath) throw new Error("A local downloadable copy is no longer retained for this backup run.");
  return readFile(path.join(localBackupDirectory(), safeLocalArtifactName(run.localArtifactPath)));
}

function diagnostic(
  provider: BackupProvider,
  target: string,
  status: "success" | "failure" | "unconfigured",
  message: string,
  startedAt: number,
): ConnectionDiagnosticResult {
  return { provider, target, status, message, durationMs: Date.now() - startedAt, testedAt: new Date() };
}

class S3CompatibleAdapter implements OperationalBackupAdapter {
  readonly provider: BackupProvider;
  private client: S3Client;
  private bucket: string;
  private prefix: string;

  constructor(provider: BackupProvider, config: BackupPublicConfig, secrets: BackupSecrets) {
    this.provider = provider;
    if (!config.bucket || !secrets.accessKeyId || !secrets.secretAccessKey) {
      throw new Error("Bucket, access key ID, and secret access key are required");
    }
    this.bucket = config.bucket;
    this.prefix = normalizePath(config.folderPath);
    this.client = new S3Client({
      region: config.region || "us-east-1",
      endpoint: config.endpoint || undefined,
      forcePathStyle: provider === "backblaze_b2",
      credentials: { accessKeyId: secrets.accessKeyId, secretAccessKey: secrets.secretAccessKey },
    });
  }

  private key(name: string) { return `${this.prefix}/${name}`; }

  async testConnection(): Promise<ConnectionDiagnosticResult> {
    const started = Date.now();
    try {
      await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: this.prefix, MaxKeys: 1 }));
      return diagnostic(this.provider, this.bucket, "success", "Storage bucket is reachable with the configured credentials.", started);
    } catch (error) {
      return diagnostic(this.provider, this.bucket, "failure", sanitizedError(error), started);
    }
  }

  async putArtifact(name: string, body: Buffer) {
    const key = this.key(name);
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: "application/json", ChecksumSHA256: body.length ? createHash("sha256").update(body).digest("base64") : undefined }));
    return `s3://${this.bucket}/${key}`;
  }

  async readArtifact(name: string) {
    const key = this.key(name);
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!result.Body) throw new Error("Storage provider returned an empty object body");
    return { reference: `s3://${this.bucket}/${key}`, body: Buffer.from(await result.Body.transformToByteArray()) };
  }

  async deleteArtifact(name: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.key(name) }));
  }

  async dryRun(input: { artifactName: string; body: Buffer; checksumSha256: string }) {
    const reference = await this.putArtifact(input.artifactName, input.body);
    try {
      const downloaded = await this.readArtifact(input.artifactName);
      const verified = checksum(downloaded.body) === input.checksumSha256;
      return { verified, remoteReference: reference, message: verified ? "Write, read, and checksum verification succeeded." : "Checksum verification failed." };
    } finally {
      await this.deleteArtifact(input.artifactName).catch(() => undefined);
    }
  }
}

class AzureBlobAdapter implements OperationalBackupAdapter {
  readonly provider: BackupProvider = "azure_blob";
  private container;
  private prefix: string;

  constructor(config: BackupPublicConfig, secrets: BackupSecrets) {
    if (!config.container || !secrets.connectionString) throw new Error("Container and Azure connection string are required");
    this.container = BlobServiceClient.fromConnectionString(secrets.connectionString).getContainerClient(config.container);
    this.prefix = normalizePath(config.folderPath);
  }

  private name(name: string) { return `${this.prefix}/${name}`; }

  async testConnection(): Promise<ConnectionDiagnosticResult> {
    const started = Date.now();
    try {
      const iterator = this.container.listBlobsFlat({ prefix: this.prefix }).byPage({ maxPageSize: 1 });
      await iterator.next();
      return diagnostic(this.provider, this.container.containerName, "success", "Azure Blob container is reachable with the configured connection string.", started);
    } catch (error) {
      return diagnostic(this.provider, this.container.containerName, "failure", sanitizedError(error), started);
    }
  }

  async putArtifact(name: string, body: Buffer) {
    const blobName = this.name(name);
    await this.container.getBlockBlobClient(blobName).uploadData(body, { blobHTTPHeaders: { blobContentType: "application/json" } });
    return `${this.container.url}/${blobName}`;
  }

  async readArtifact(name: string) {
    const blob = this.container.getBlockBlobClient(this.name(name));
    const response = await blob.download();
    const chunks: Buffer[] = [];
    if (!response.readableStreamBody) throw new Error("Azure Blob returned an empty response body");
    for await (const chunk of response.readableStreamBody) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return { reference: blob.url, body: Buffer.concat(chunks) };
  }

  async deleteArtifact(name: string) { await this.container.deleteBlob(this.name(name)); }

  async dryRun(input: { artifactName: string; body: Buffer; checksumSha256: string }) {
    const reference = await this.putArtifact(input.artifactName, input.body);
    try {
      const downloaded = await this.readArtifact(input.artifactName);
      const verified = checksum(downloaded.body) === input.checksumSha256;
      return { verified, remoteReference: reference, message: verified ? "Write, read, and checksum verification succeeded." : "Checksum verification failed." };
    } finally {
      await this.deleteArtifact(input.artifactName).catch(() => undefined);
    }
  }
}

async function googleAccessToken(config: BackupPublicConfig, secrets: BackupSecrets) {
  if (!config.clientId || !secrets.clientSecret || !secrets.refreshToken) throw new Error("Google client ID, client secret, and refresh token are required");
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: config.clientId, client_secret: secrets.clientSecret, refresh_token: secrets.refreshToken, grant_type: "refresh_token" }) });
  if (!response.ok) throw new Error(`Google OAuth refresh failed with status ${response.status}`);
  const body = await response.json() as { access_token?: string };
  if (!body.access_token) throw new Error("Google OAuth response did not include an access token");
  return body.access_token;
}

class GoogleDriveAdapter implements OperationalBackupAdapter {
  readonly provider: BackupProvider = "google_drive";
  private config: BackupPublicConfig;
  private secrets: BackupSecrets;
  private artifacts = new Map<string, string>();

  constructor(config: BackupPublicConfig, secrets: BackupSecrets) { this.config = config; this.secrets = secrets; }

  async testConnection(): Promise<ConnectionDiagnosticResult> {
    const started = Date.now();
    try {
      const token = await googleAccessToken(this.config, this.secrets);
      const url = this.config.driveId ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(this.config.driveId)}?fields=id,name,capabilities&supportsAllDrives=true` : "https://www.googleapis.com/drive/v3/about?fields=user";
      const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(`Google Drive request failed with status ${response.status}`);
      return diagnostic(this.provider, this.config.driveId || "Google Drive", "success", "Google Drive is reachable and the target folder is accessible.", started);
    } catch (error) { return diagnostic(this.provider, this.config.driveId || "Google Drive", "failure", sanitizedError(error), started); }
  }

  async putArtifact(name: string, body: Buffer) {
    const token = await googleAccessToken(this.config, this.secrets);
    const boundary = `wp_${randomBytes(8).toString("hex")}`;
    const metadata = { name, mimeType: "application/json", ...(this.config.driveId ? { parents: [this.config.driveId] } : {}) };
    const multipart = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n`),
      body,
      Buffer.from(`\r\n--${boundary}--`),
    ]);
    const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": `multipart/related; boundary=${boundary}` }, body: multipart });
    if (!response.ok) throw new Error(`Google Drive upload failed with status ${response.status}`);
    const result = await response.json() as { id?: string };
    if (!result.id) throw new Error("Google Drive upload response did not include a file ID");
    this.artifacts.set(name, result.id);
    return `gdrive://${result.id}`;
  }

  private async fileId(name: string) {
    const cached = this.artifacts.get(name);
    if (cached) return cached;
    const token = await googleAccessToken(this.config, this.secrets);
    const parentClause = this.config.driveId ? ` and '${this.config.driveId.replace(/'/g, "\\'")}' in parents` : "";
    const query = encodeURIComponent(`name='${name.replace(/'/g, "\\'")}'${parentClause} and trashed=false`);
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`, { headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Google Drive lookup failed with status ${response.status}`);
    const result = await response.json() as { files?: Array<{ id: string }> };
    if (!result.files?.[0]) throw new Error("Backup artifact was not found in Google Drive");
    return result.files[0].id;
  }

  async readArtifact(name: string) {
    const token = await googleAccessToken(this.config, this.secrets);
    const id = await this.fileId(name);
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`, { headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Google Drive download failed with status ${response.status}`);
    return { reference: `gdrive://${id}`, body: Buffer.from(await response.arrayBuffer()) };
  }

  async deleteArtifact(name: string) {
    const token = await googleAccessToken(this.config, this.secrets);
    const id = await this.fileId(name);
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?supportsAllDrives=true`, { method: "DELETE", headers: { authorization: `Bearer ${token}` } });
    if (!response.ok && response.status !== 404) throw new Error(`Google Drive delete failed with status ${response.status}`);
    this.artifacts.delete(name);
  }

  async dryRun(input: { artifactName: string; body: Buffer; checksumSha256: string }) {
    const reference = await this.putArtifact(input.artifactName, input.body);
    try { const downloaded = await this.readArtifact(input.artifactName); const verified = checksum(downloaded.body) === input.checksumSha256; return { verified, remoteReference: reference, message: verified ? "Write, read, and checksum verification succeeded." : "Checksum verification failed." }; }
    finally { await this.deleteArtifact(input.artifactName).catch(() => undefined); }
  }
}

class MicrosoftDriveAdapter implements OperationalBackupAdapter {
  readonly provider: BackupProvider;
  private config: BackupPublicConfig;
  constructor(provider: BackupProvider, config: BackupPublicConfig) { this.provider = provider; this.config = config; if (!config.driveId) throw new Error("Microsoft drive or document library ID is required"); }
  private async context() { const { accessToken, publicConfig } = await getMicrosoftApplicationToken(); const baseUrl = (publicConfig.graphBaseUrl || "https://graph.microsoft.com/v1.0").replace(/\/$/, ""); const driveBase = this.provider === "sharepoint" && this.config.accountName ? `${baseUrl}/sites/${encodeURIComponent(this.config.accountName)}/drives/${encodeURIComponent(this.config.driveId!)}` : `${baseUrl}/drives/${encodeURIComponent(this.config.driveId!)}`; return { accessToken, driveBase }; }
  private path(name: string) { return [normalizePath(this.config.folderPath), name].filter(Boolean).map(part => part.split("/").map(encodeURIComponent).join("/")).join("/"); }
  async testConnection(): Promise<ConnectionDiagnosticResult> { const started = Date.now(); try { const { accessToken, driveBase } = await this.context(); const response = await fetch(`${driveBase}/root?$select=id,name,webUrl`, { headers: { authorization: `Bearer ${accessToken}` } }); if (!response.ok) throw new Error(`Microsoft Graph drive request failed with status ${response.status}`); return diagnostic(this.provider, this.config.driveId || "Microsoft drive", "success", "Microsoft drive is reachable with the configured application permissions.", started); } catch (error) { return diagnostic(this.provider, this.config.driveId || "Microsoft drive", "failure", sanitizedError(error), started); } }
  async putArtifact(name: string, body: Buffer) { const { accessToken, driveBase } = await this.context(); const path = this.path(name); const response = await fetch(`${driveBase}/root:/${path}:/content`, { method: "PUT", headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" }, body: new Uint8Array(body) }); if (!response.ok) throw new Error(`Microsoft Graph upload failed with status ${response.status}`); const item = await response.json() as { id?: string; webUrl?: string }; return item.webUrl || `graph-drive://${item.id || path}`; }
  async readArtifact(name: string) { const { accessToken, driveBase } = await this.context(); const path = this.path(name); const response = await fetch(`${driveBase}/root:/${path}:/content`, { headers: { authorization: `Bearer ${accessToken}` }, redirect: "follow" }); if (!response.ok) throw new Error(`Microsoft Graph download failed with status ${response.status}`); return { reference: `graph-drive://${path}`, body: Buffer.from(await response.arrayBuffer()) }; }
  async deleteArtifact(name: string) { const { accessToken, driveBase } = await this.context(); const path = this.path(name); const response = await fetch(`${driveBase}/root:/${path}`, { method: "DELETE", headers: { authorization: `Bearer ${accessToken}` } }); if (!response.ok && response.status !== 404) throw new Error(`Microsoft Graph delete failed with status ${response.status}`); }
  async dryRun(input: { artifactName: string; body: Buffer; checksumSha256: string }) { const reference = await this.putArtifact(input.artifactName, input.body); try { const downloaded = await this.readArtifact(input.artifactName); const verified = checksum(downloaded.body) === input.checksumSha256; return { verified, remoteReference: reference, message: verified ? "Write, read, and checksum verification succeeded." : "Checksum verification failed." }; } finally { await this.deleteArtifact(input.artifactName).catch(() => undefined); } }
}

export function createBackupAdapter(destination: BackupDestination): OperationalBackupAdapter {
  const { publicConfig, secrets } = parseDestination(destination);
  const provider = destination.provider as BackupProvider;
  if (["aws_s3", "wasabi", "backblaze_b2"].includes(provider)) return new S3CompatibleAdapter(provider, publicConfig, secrets);
  if (provider === "azure_blob") return new AzureBlobAdapter(publicConfig, secrets);
  if (provider === "google_drive") return new GoogleDriveAdapter(publicConfig, secrets);
  if (provider === "sharepoint" || provider === "onedrive") return new MicrosoftDriveAdapter(provider, publicConfig);
  throw new Error(`Unsupported backup provider: ${provider}`);
}

export async function testBackupDestination(destination: BackupDestination) {
  return createBackupAdapter(destination).testConnection();
}

export async function executeBackupRun(destination: BackupDestination, runType: "dry_run" | "backup", triggeredByUserId?: number | null) {
  const artifactName = `welfare-pride-${destination.backupScope}-${runType}-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(4).toString("hex")}.wpbackup.json`;
  const snapshot = await db.buildBackupSnapshot(destination.backupScope);
  const body = Buffer.from(encryptJson({ ...snapshot, brand: "Welfare Pride", destination: { provider: destination.provider, displayName: destination.displayName }, runType, verificationNonce: randomBytes(16).toString("hex") }));
  const checksumSha256 = checksum(body);
  const runId = await db.createBackupRun({ destinationId: destination.id, runType, status: "running", artifactName, backupScope: destination.backupScope, checksumSha256, byteSize: body.byteLength, triggeredByUserId: triggeredByUserId ?? null });
  await db.appendOperationAuditEvent({ entityType: "backup_run", entityId: runId, eventType: "run_started", status: "running", message: `${runType === "dry_run" ? "Dry run" : "Backup manifest"} started for ${destination.displayName}.`, metadataJson: JSON.stringify({ destinationId: destination.id, provider: destination.provider, artifactName, checksumSha256 }), actorUserId: triggeredByUserId ?? null });
  try {
    const adapter = createBackupAdapter(destination);
    if (runType === "dry_run") {
      const result = await adapter.dryRun({ artifactName, body, checksumSha256 });
      if (!result.verified) throw new Error(result.message);
      await db.updateBackupRun(runId, { status: "succeeded", message: `${result.message} Test artifact was deleted.`, completedAt: new Date() });
      await db.appendOperationAuditEvent({ entityType: "backup_run", entityId: runId, eventType: "dry_run_completed", status: "succeeded", message: `${result.message} Test artifact was deleted.`, metadataJson: JSON.stringify({ destinationId: destination.id, provider: destination.provider, checksumSha256 }), actorUserId: triggeredByUserId ?? null });
    } else {
      const reference = await adapter.putArtifact(artifactName, body);
      const downloaded = await adapter.readArtifact(artifactName);
      if (checksum(downloaded.body) !== checksumSha256) throw new Error("Retained backup snapshot checksum verification failed");
      const localArtifactPath = await writeLocalArtifact(artifactName, body);
      await db.updateBackupRun(runId, { status: "succeeded", localArtifactPath, message: `Encrypted ${backupScopeLabel(destination.backupScope)} snapshot checksum-verified at ${reference}; a locally retained encrypted copy is available until the ${normalizeLocalRetentionDays(destination.localRetentionDays)}-day policy expires.`, completedAt: new Date() });
      await purgeExpiredLocalArtifacts(destination);
      await db.appendOperationAuditEvent({ entityType: "backup_run", entityId: runId, eventType: "encrypted_backup_retained", status: "succeeded", message: `Encrypted ${destination.backupScope} snapshot checksum-verified at ${reference}.`, metadataJson: JSON.stringify({ destinationId: destination.id, provider: destination.provider, artifactName, checksumSha256, byteSize: body.byteLength, localRetentionDays: destination.localRetentionDays }), actorUserId: triggeredByUserId ?? null });
    }
  } catch (error) {
    await db.updateBackupRun(runId, { status: "failed", message: sanitizedError(error), completedAt: new Date() });
    await db.appendOperationAuditEvent({ entityType: "backup_run", entityId: runId, eventType: "run_failed", status: "failed", message: sanitizedError(error), metadataJson: JSON.stringify({ destinationId: destination.id, provider: destination.provider, artifactName }), actorUserId: triggeredByUserId ?? null });
    throw error;
  }
  return db.getBackupRunById(runId);
}

export async function executeRestoreVerification(destination: BackupDestination, run: NonNullable<Awaited<ReturnType<typeof db.getBackupRunById>>>) {
  if (run.runType !== "backup" || run.status !== "succeeded" || !run.artifactName || !run.checksumSha256) throw new Error("Only successful retained backup manifests can be restore-verified");
  const downloaded = await createBackupAdapter(destination).readArtifact(run.artifactName);
  const verified = checksum(downloaded.body) === run.checksumSha256;
  if (!verified) throw new Error("Restore verification checksum mismatch");
  return { verified, byteSize: downloaded.body.byteLength, reference: downloaded.reference };
}
