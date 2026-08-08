import * as db from "../db";
import { getDelegatedMicrosoftAccessToken, getMicrosoftApplicationToken } from "./microsoftGraph";

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
