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
        scope: publicConfig.graphScopes || "openid profile email offline_access User.Read User.ReadBasic.All Sites.Read.All",
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
