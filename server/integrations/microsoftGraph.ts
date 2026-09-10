import type { DirectoryNode } from "../../shared/domain";
import * as db from "../db";
import { decryptJson, encryptJson } from "../security/encryption";
import type { MicrosoftPublicConfig, MicrosoftSecrets } from "./contracts";

type GraphUser = {
  id: string;
  displayName?: string;
  mail?: string;
  userPrincipalName?: string;
  jobTitle?: string;
  department?: string;
  officeLocation?: string;
  businessPhones?: string[];
  mobilePhone?: string;
  manager?: { id?: string } | null;
};

type GraphCollection<T> = {
  value: T[];
  "@odata.nextLink"?: string;
};

type GraphGroup = {
  id?: string;
  displayName?: string;
};

const DEFAULT_DELEGATED_SCOPES = "openid profile email offline_access User.Read User.ReadBasic.All GroupMember.Read.All Sites.Read.All";

async function loadGraphConfiguration() {
  const setting = await db.getIntegrationSettingByProvider("microsoft_entra");
  if (!setting) throw new Error("Microsoft Entra ID is not configured");
  const publicConfig = setting.publicConfigJson
    ? (JSON.parse(setting.publicConfigJson) as MicrosoftPublicConfig)
    : {};
  const secrets = setting.encryptedSecrets
    ? decryptJson<MicrosoftSecrets>(setting.encryptedSecrets)
    : {};
  if (!publicConfig.tenantId || !publicConfig.clientId || !secrets.clientSecret) {
    throw new Error("Microsoft Entra ID credentials are incomplete");
  }
  return { publicConfig, secrets };
}

export async function getMicrosoftApplicationToken() {
  const { publicConfig, secrets } = await loadGraphConfiguration();
  const tokenResponse = await fetch(
    `https://login.microsoftonline.com/${publicConfig.tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: publicConfig.clientId!,
        client_secret: secrets.clientSecret!,
        grant_type: "client_credentials",
        scope: "https://graph.microsoft.com/.default",
      }),
    },
  );
  if (!tokenResponse.ok) {
    throw new Error(`Microsoft Entra token request failed with status ${tokenResponse.status}`);
  }
  const body = (await tokenResponse.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("Microsoft Entra token response did not include an access token");
  return { accessToken: body.access_token, publicConfig };
}

export async function discoverSharePointSite(siteUrl: string) {
  const parsed = new URL(siteUrl);
  if (parsed.protocol !== "https:" || !/\.sharepoint\.com$/i.test(parsed.hostname) || !parsed.pathname.startsWith("/sites/")) throw new Error("Use an HTTPS SharePoint site URL in the form https://tenant.sharepoint.com/sites/SiteName.");
  const { accessToken, publicConfig } = await getMicrosoftApplicationToken();
  const base = (publicConfig.graphBaseUrl || "https://graph.microsoft.com/v1.0").replace(/\/$/, "");
  const siteResponse = await fetch(`${base}/sites/${encodeURIComponent(parsed.hostname)}:${parsed.pathname}`, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!siteResponse.ok) throw new Error(siteResponse.status === 403 ? "Microsoft Graph cannot read this SharePoint site. Grant Sites.Read.All application permission and administrator consent." : `SharePoint site lookup failed with status ${siteResponse.status}.`);
  const site = await siteResponse.json() as { id?: string; displayName?: string; webUrl?: string };
  if (!site.id) throw new Error("Microsoft Graph did not return a SharePoint site ID.");
  const drivesResponse = await fetch(`${base}/sites/${encodeURIComponent(site.id)}/drives?$select=id,name,webUrl,driveType`, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!drivesResponse.ok) throw new Error(`SharePoint document-library lookup failed with status ${drivesResponse.status}.`);
  const drives = ((await drivesResponse.json()) as { value?: Array<{ id?: string; name?: string; webUrl?: string; driveType?: string }> }).value || [];
  const libraries = drives.filter(drive => drive.id && (drive.driveType === "documentLibrary" || !drive.driveType)).map(drive => ({ id: drive.id!, name: drive.name || "Document library", webUrl: drive.webUrl || null }));
  const preferred = libraries.find(library => /human\s*resources|\bhr\b/i.test(library.name)) || (libraries.length === 1 ? libraries[0] : undefined);
  return { siteId: site.id, siteUrl: site.webUrl || siteUrl, siteName: site.displayName || parsed.pathname.split("/").filter(Boolean).pop() || "SharePoint site", libraries, recommendedLibraryId: preferred?.id || null };
}

export async function getDelegatedMicrosoftAccessToken(userId: number) {
  const session = await db.getMicrosoftOauthSession(userId);
  if (!session) throw new Error("Sign in with Microsoft Entra ID to access SharePoint documents");
  const tokenSet = decryptJson<{ accessToken: string; refreshToken?: string; tokenType?: string }>(
    session.encryptedTokenSet,
  );
  if (session.accessTokenExpiresAt && session.accessTokenExpiresAt.getTime() > Date.now() + 120_000) {
    return tokenSet.accessToken;
  }
  if (!tokenSet.refreshToken) throw new Error("Microsoft authorization expired; sign in with Microsoft Entra ID again");

  const { publicConfig, secrets } = await loadGraphConfiguration();
  const refreshResponse = await fetch(
    `https://login.microsoftonline.com/${publicConfig.tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: publicConfig.clientId!,
        client_secret: secrets.clientSecret!,
        grant_type: "refresh_token",
        refresh_token: tokenSet.refreshToken,
        scope: publicConfig.graphScopes || DEFAULT_DELEGATED_SCOPES,
      }),
    },
  );
  if (!refreshResponse.ok) {
    throw new Error(`Microsoft delegated authorization refresh failed with status ${refreshResponse.status}`);
  }
  const refreshed = (await refreshResponse.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };
  if (!refreshed.access_token) throw new Error("Microsoft refresh response did not include an access token");
  await db.upsertMicrosoftOauthSession({
    userId,
    tenantId: publicConfig.tenantId!,
    encryptedTokenSet: encryptJson({
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token || tokenSet.refreshToken,
      tokenType: refreshed.token_type || tokenSet.tokenType,
    }),
    scopes: refreshed.scope || session.scopes,
    accessTokenExpiresAt: new Date(Date.now() + (refreshed.expires_in || 3600) * 1000),
  });
  return refreshed.access_token;
}

export async function fetchGraphDirectory(): Promise<DirectoryNode[]> {
  const { accessToken, publicConfig } = await getMicrosoftApplicationToken();
  const graphBaseUrl = (publicConfig.graphBaseUrl || "https://graph.microsoft.com/v1.0").replace(/\/$/, "");
  let nextUrl: string | undefined = `${graphBaseUrl}/users?$top=250&$select=id,displayName,mail,userPrincipalName,jobTitle,department,officeLocation,businessPhones,mobilePhone&$expand=manager($select=id)`;
  const people: DirectoryNode[] = [];

  while (nextUrl && people.length < 5000) {
    const response = await fetch(nextUrl, {
      headers: { authorization: `Bearer ${accessToken}`, consistencyLevel: "eventual" },
    });
    if (!response.ok) throw new Error(`Microsoft Graph directory request failed with status ${response.status}`);
    const collection = (await response.json()) as GraphCollection<GraphUser>;
    for (const user of collection.value) {
      people.push({
        id: user.id,
        profileId: null,
        displayName: user.displayName || user.mail || user.userPrincipalName || "Unnamed employee",
        jobTitle: user.jobTitle ?? null,
        department: user.department ?? null,
        email: user.mail || user.userPrincipalName || null,
        phone: user.mobilePhone || user.businessPhones?.[0] || null,
        officeLocation: user.officeLocation ?? null,
        photoUrl: null,
        managerId: user.manager?.id ?? null,
      });
    }
    nextUrl = collection["@odata.nextLink"];
  }
  return people;
}

export async function synchronizeGraphDirectory() {
  const people = await fetchGraphDirectory();
  for (const person of people) {
    await db.upsertDirectoryProfileFromEntra({
      entraUserId: person.id,
      displayName: person.displayName,
      email: person.email,
      jobTitle: person.jobTitle,
      department: person.department,
      officeLocation: person.officeLocation,
      phone: person.phone,
      managerEntraUserId: person.managerId,
    });
  }
  return { synchronized: people.length };
}

export async function synchronizeDelegatedEntraGroupMemberships(userId: number) {
  const accessToken = await getDelegatedMicrosoftAccessToken(userId);
  const { publicConfig } = await loadGraphConfiguration();
  const graphBaseUrl = (publicConfig.graphBaseUrl || "https://graph.microsoft.com/v1.0").replace(/\/$/, "");
  const baseOrigin = new URL(graphBaseUrl).origin;
  let nextUrl: string | undefined = `${graphBaseUrl}/me/memberOf/microsoft.graph.group?$select=id,displayName&$top=100`;
  const groups = new Map<string, { groupId: string; displayName: string }>();

  while (nextUrl && groups.size < 1_000) {
    const parsed = new URL(nextUrl);
    if (parsed.origin !== baseOrigin) throw new Error("Microsoft Graph returned an unexpected group-membership pagination origin");
    const response = await fetch(parsed, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!response.ok) {
      throw new Error(response.status === 403
        ? "Microsoft Entra group membership permission is not granted. Add delegated GroupMember.Read.All and grant consent."
        : `Microsoft Graph group membership request failed with status ${response.status}`);
    }
    const page = (await response.json()) as GraphCollection<GraphGroup>;
    for (const group of page.value) {
      if (group.id) groups.set(group.id, { groupId: group.id, displayName: group.displayName?.trim() || group.id });
    }
    nextUrl = page["@odata.nextLink"];
  }

  await db.replaceUserEntraGroupMemberships(userId, Array.from(groups.values()));
  return { synchronized: groups.size };
}
