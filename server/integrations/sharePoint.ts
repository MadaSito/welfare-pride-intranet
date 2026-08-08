import * as db from "../db";
import { getDelegatedMicrosoftAccessToken, getMicrosoftApplicationToken } from "./microsoftGraph";
import { PDFParse } from "pdf-parse";
import * as mammoth from "mammoth";

type SharePointHolidayFields = {
  Title?: string;
  Description?: string;
  StartDate?: string;
  EndDate?: string;
  IsObserved?: boolean;
  Modified?: string;
};

type SharePointListItem = {
  id: string;
  fields?: SharePointHolidayFields;
};

type SharePointListResponse = {
  value: SharePointListItem[];
  "@odata.nextLink"?: string;
};

function dateOnly(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export async function synchronizeSharePointHolidays() {
  const { accessToken, publicConfig } = await getMicrosoftApplicationToken();
  if (!publicConfig.sharePointSiteId || !publicConfig.holidayListId) {
    throw new Error("SharePoint Site ID and Holiday List ID are required");
  }
  const graphBaseUrl = (publicConfig.graphBaseUrl || "https://graph.microsoft.com/v1.0").replace(/\/$/, "");
  let nextUrl: string | undefined = `${graphBaseUrl}/sites/${encodeURIComponent(publicConfig.sharePointSiteId)}/lists/${encodeURIComponent(publicConfig.holidayListId)}/items?$top=200&$expand=fields`;
  let synchronized = 0;

  while (nextUrl && synchronized < 5000) {
    const response = await fetch(nextUrl, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error(`SharePoint holiday list request failed with status ${response.status}`);
    const collection = (await response.json()) as SharePointListResponse;
    for (const item of collection.value) {
      const fields = item.fields || {};
      const startDate = dateOnly(fields.StartDate);
      const endDate = dateOnly(fields.EndDate || fields.StartDate);
      if (!fields.Title || !startDate || !endDate) continue;
      await db.upsertHoliday({
        externalId: item.id,
        title: fields.Title,
        description: fields.Description ?? null,
        startDate,
        endDate,
        isObserved: fields.IsObserved ?? false,
        sourceUpdatedAt: fields.Modified ? new Date(fields.Modified) : null,
      });
      synchronized += 1;
    }
    nextUrl = collection["@odata.nextLink"];
  }
  return { synchronized };
}

export type SharePointDocument = {
  id: string;
  name: string;
  webUrl: string;
  size: number;
  mimeType: string | null;
  lastModifiedAt: Date | null;
  category: string;
  isFolder: boolean;
};

type SharePointDriveItem = {
  id: string;
  name: string;
  webUrl?: string;
  size?: number;
  lastModifiedDateTime?: string;
  file?: { mimeType?: string };
  folder?: { childCount?: number };
  parentReference?: { path?: string };
};

function categoryFromParentPath(path: string | undefined) {
  if (!path) return "General";
  const segments = path.split(":").at(-1)?.split("/").filter(Boolean) || [];
  return segments.at(-1) || "General";
}

export async function listAuthorizedSharePointDocuments(input: {
  userId: number;
  query?: string;
  category?: string;
}) {
  const accessToken = await getDelegatedMicrosoftAccessToken(input.userId);
  const setting = await db.getIntegrationSettingByProvider("sharepoint") || await db.getIntegrationSettingByProvider("microsoft_entra");
  if (!setting?.publicConfigJson) throw new Error("SharePoint is not configured");
  const publicConfig = JSON.parse(setting.publicConfigJson) as { graphBaseUrl?: string; sharePointSiteId?: string; hrLibraryId?: string };
  if (!publicConfig.sharePointSiteId || !publicConfig.hrLibraryId) throw new Error("SharePoint Site ID and HR Library ID are required");
  const graphBaseUrl = (publicConfig.graphBaseUrl || "https://graph.microsoft.com/v1.0").replace(/\/$/, "");
  const base = `${graphBaseUrl}/sites/${encodeURIComponent(publicConfig.sharePointSiteId)}/drives/${encodeURIComponent(publicConfig.hrLibraryId)}`;
  const escapedQuery = (input.query || "").replace(/'/g, "''");
  let nextUrl: string | undefined = escapedQuery
    ? `${base}/root/search(q='${encodeURIComponent(escapedQuery)}')?$top=200&$select=id,name,webUrl,size,lastModifiedDateTime,file,folder,parentReference`
    : `${base}/root/children?$top=200&$select=id,name,webUrl,size,lastModifiedDateTime,file,folder,parentReference`;
  const items: SharePointDocument[] = [];

  while (nextUrl && items.length < 1000) {
    const response = await fetch(nextUrl, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error(`SharePoint document request failed with status ${response.status}`);
    const collection = (await response.json()) as { value: SharePointDriveItem[]; "@odata.nextLink"?: string };
    for (const item of collection.value) {
      if (!item.webUrl) continue;
      const category = categoryFromParentPath(item.parentReference?.path);
      if (input.category && input.category !== "all" && input.category !== category) continue;
      items.push({
        id: item.id,
        name: item.name,
        webUrl: item.webUrl,
        size: item.size || 0,
        mimeType: item.file?.mimeType || null,
        lastModifiedAt: item.lastModifiedDateTime ? new Date(item.lastModifiedDateTime) : null,
        category,
        isFolder: Boolean(item.folder),
      });
    }
    nextUrl = collection["@odata.nextLink"];
  }
  return items;
}

export async function getAuthorizedSharePointDocument(input: { userId: number; documentId: string }) {
  const accessToken = await getDelegatedMicrosoftAccessToken(input.userId);
  const setting = await db.getIntegrationSettingByProvider("sharepoint") || await db.getIntegrationSettingByProvider("microsoft_entra");
  if (!setting?.publicConfigJson) throw new Error("SharePoint is not configured");
  const publicConfig = JSON.parse(setting.publicConfigJson) as { graphBaseUrl?: string; sharePointSiteId?: string; hrLibraryId?: string };
  if (!publicConfig.sharePointSiteId || !publicConfig.hrLibraryId) throw new Error("SharePoint Site ID and HR Library ID are required");
  const graphBaseUrl = (publicConfig.graphBaseUrl || "https://graph.microsoft.com/v1.0").replace(/\/$/, "");
  const url = `${graphBaseUrl}/sites/${encodeURIComponent(publicConfig.sharePointSiteId)}/drives/${encodeURIComponent(publicConfig.hrLibraryId)}/items/${encodeURIComponent(input.documentId)}?$select=id,name,webUrl,size,lastModifiedDateTime,file,folder,parentReference`;
  const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  if (response.status === 404 || response.status === 403) return null;
  if (!response.ok) throw new Error(`SharePoint document request failed with status ${response.status}`);
  const item = (await response.json()) as SharePointDriveItem;
  if (!item.webUrl) return null;
  return {
    id: item.id,
    name: item.name,
    webUrl: item.webUrl,
    size: item.size || 0,
    mimeType: item.file?.mimeType || null,
    lastModifiedAt: item.lastModifiedDateTime ? new Date(item.lastModifiedDateTime) : null,
    category: categoryFromParentPath(item.parentReference?.path),
    isFolder: Boolean(item.folder),
  } satisfies SharePointDocument;
}

function normalizeExtractedText(value: string, limit = 18_000) {
  const normalized = value.replace(/\0/g, "").replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit)}\n[content truncated]` : normalized;
}

function htmlToText(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export async function getAuthorizedSharePointDocumentText(input: { userId: number; documentId: string }) {
  const document = await getAuthorizedSharePointDocument(input);
  if (!document || document.isFolder) return null;
  if (document.size > 8_000_000) return { document, text: "", extractionStatus: "too_large" as const };

  const accessToken = await getDelegatedMicrosoftAccessToken(input.userId);
  const setting = await db.getIntegrationSettingByProvider("sharepoint") || await db.getIntegrationSettingByProvider("microsoft_entra");
  if (!setting?.publicConfigJson) throw new Error("SharePoint is not configured");
  const publicConfig = JSON.parse(setting.publicConfigJson) as { graphBaseUrl?: string; sharePointSiteId?: string; hrLibraryId?: string };
  if (!publicConfig.sharePointSiteId || !publicConfig.hrLibraryId) throw new Error("SharePoint Site ID and HR Library ID are required");
  const graphBaseUrl = (publicConfig.graphBaseUrl || "https://graph.microsoft.com/v1.0").replace(/\/$/, "");
  const url = `${graphBaseUrl}/sites/${encodeURIComponent(publicConfig.sharePointSiteId)}/drives/${encodeURIComponent(publicConfig.hrLibraryId)}/items/${encodeURIComponent(input.documentId)}/content`;
  const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(20_000), redirect: "follow" });
  if (!response.ok) throw new Error(`SharePoint document content request failed with status ${response.status}`);
  const body = Buffer.from(await response.arrayBuffer());
  if (body.byteLength > 8_000_000) return { document, text: "", extractionStatus: "too_large" as const };
  const mimeType = (document.mimeType || response.headers.get("content-type") || "").toLowerCase();
  const extension = document.name.toLowerCase().split(".").pop() || "";

  try {
    if (mimeType.includes("pdf") || extension === "pdf") {
      const parser = new PDFParse({ data: new Uint8Array(body) });
      try {
        const result = await parser.getText();
        return { document, text: normalizeExtractedText(result.text), extractionStatus: "extracted" as const };
      } finally {
        await parser.destroy();
      }
    }
    if (mimeType.includes("wordprocessingml") || extension === "docx") {
      const result = await mammoth.extractRawText({ buffer: body });
      return { document, text: normalizeExtractedText(result.value), extractionStatus: "extracted" as const };
    }
    if (mimeType.startsWith("text/") || ["txt", "md", "csv", "html", "htm"].includes(extension)) {
      const value = body.toString("utf8");
      return { document, text: normalizeExtractedText(extension === "html" || extension === "htm" || mimeType.includes("html") ? htmlToText(value) : value), extractionStatus: "extracted" as const };
    }
    return { document, text: "", extractionStatus: "unsupported" as const };
  } catch {
    return { document, text: "", extractionStatus: "failed" as const };
  }
}
