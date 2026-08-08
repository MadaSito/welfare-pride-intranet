import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type StorageDriver = "local" | "s3";

function storageDriver(): StorageDriver {
  const configured = process.env.STORAGE_DRIVER?.toLowerCase();
  if (configured === "local" || configured === "s3") return configured;
  return process.env.NODE_ENV === "production" ? "s3" : "local";
}

function normalizeKey(relKey: string) {
  const normalized = relKey.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.split("/").some(part => part === ".." || part === ".")) throw new Error("Invalid storage key");
  return normalized;
}

function appendHashSuffix(relKey: string) {
  const hash = randomUUID().replace(/-/g, "").slice(0, 10);
  const lastDot = relKey.lastIndexOf(".");
  return lastDot === -1 ? `${relKey}_${hash}` : `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function localStorageRoot() {
  return path.resolve(process.env.LOCAL_STORAGE_PATH || path.join(process.cwd(), "data", "uploads"));
}

function localFilePath(key: string) {
  const root = localStorageRoot();
  const resolved = path.resolve(root, normalizeKey(key));
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error("Invalid storage path");
  return resolved;
}

function getS3Config() {
  const bucket = process.env.STORAGE_BUCKET;
  const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) throw new Error("S3 storage is not configured. Set STORAGE_BUCKET, STORAGE_ACCESS_KEY_ID, and STORAGE_SECRET_ACCESS_KEY.");
  const endpoint = process.env.STORAGE_ENDPOINT || undefined;
  const region = process.env.STORAGE_REGION || "us-east-1";
  return {
    bucket,
    client: new S3Client({
      region,
      endpoint,
      forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === "true",
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

function sameOriginUrl(key: string) {
  return `/api/files/${normalizeKey(key).split("/").map(encodeURIComponent).join("/")}`;
}

export async function storagePut(relKey: string, data: Buffer | Uint8Array | string, contentType = "application/octet-stream") {
  const key = appendHashSuffix(normalizeKey(relKey));
  const body = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  if (storageDriver() === "local") {
    const destination = localFilePath(key);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, body);
  } else {
    const { bucket, client } = getS3Config();
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
  }
  return { key, url: sameOriginUrl(key) };
}

export async function storageGet(relKey: string) {
  const key = normalizeKey(relKey);
  return { key, url: sameOriginUrl(key) };
}

export async function storageGetSignedUrl(relKey: string) {
  const key = normalizeKey(relKey);
  if (storageDriver() === "local") return sameOriginUrl(key);
  const { bucket, client } = getS3Config();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 300 });
}

export async function storageReadLocal(relKey: string) {
  if (storageDriver() !== "local") throw new Error("Local storage is not active");
  return readFile(localFilePath(relKey));
}

export function isLocalStorage() {
  return storageDriver() === "local";
}
