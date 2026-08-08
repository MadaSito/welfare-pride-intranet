import * as db from "../db";
import { decryptJson } from "../security/encryption";
import { getMicrosoftApplicationToken } from "./microsoftGraph";
import type { MicrosoftPublicConfig, MicrosoftSecrets } from "./contracts";

export function sanitizeDiagnosticError(error: unknown) {
  const message = error instanceof Error ? error.message : "Connection failed";
  return message.replace(/(secret|token|password|key)=([^&\s]+)/gi, "$1=[redacted]").slice(0, 800);
}

async function loadMicrosoftConfiguration() {
  const setting = await db.getIntegrationSettingByProvider("microsoft_entra");
  if (!setting) throw new Error("Microsoft Entra ID is not configured");
  const publicConfig = setting.publicConfigJson ? JSON.parse(setting.publicConfigJson) as MicrosoftPublicConfig : {};
  const secrets = setting.encryptedSecrets ? decryptJson<MicrosoftSecrets>(setting.encryptedSecrets) : {};
  if (!publicConfig.tenantId || !publicConfig.clientId || !secrets.clientSecret) throw new Error("Tenant ID, Client ID, and Client Secret are required");
  return { publicConfig, secrets };
}

export async function testMicrosoftGraphConnection() {
  const started = Date.now();
  const testedAt = new Date();
  try {
    const { accessToken, publicConfig } = await getMicrosoftApplicationToken();
    const base = (publicConfig.graphBaseUrl || "https://graph.microsoft.com/v1.0").replace(/\/$/, "");
    const response = await fetch(`${base}/users?$top=1&$select=id`, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error(`Microsoft Graph returned HTTP ${response.status}`);
    return { provider: "microsoft_graph", target: base, status: "success" as const, message: "Microsoft Graph token acquisition and directory read succeeded.", durationMs: Date.now() - started, testedAt };
  } catch (error) {
    return { provider: "microsoft_graph", target: "Microsoft Graph", status: "failure" as const, message: sanitizeDiagnosticError(error), durationMs: Date.now() - started, testedAt };
  }
}

export async function testSharePointRestConnection() {
  const started = Date.now();
  const testedAt = new Date();
  try {
    const { publicConfig, secrets } = await loadMicrosoftConfiguration();
    if (!publicConfig.sharePointSiteUrl) throw new Error("SharePoint Site URL is required");
    const siteUrl = new URL(publicConfig.sharePointSiteUrl);
    const tokenResponse = await fetch(`https://login.microsoftonline.com/${publicConfig.tenantId}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: publicConfig.clientId!, client_secret: secrets.clientSecret!, grant_type: "client_credentials", scope: `${siteUrl.origin}/.default` }),
    });
    if (!tokenResponse.ok) throw new Error(`SharePoint token acquisition returned HTTP ${tokenResponse.status}`);
    const tokenBody = await tokenResponse.json() as { access_token?: string };
    if (!tokenBody.access_token) throw new Error("SharePoint token response did not include an access token");
    const response = await fetch(`${publicConfig.sharePointSiteUrl.replace(/\/$/, "")}/_api/web?$select=Id,Title`, { headers: { authorization: `Bearer ${tokenBody.access_token}`, accept: "application/json;odata=nometadata" } });
    if (!response.ok) throw new Error(`SharePoint REST API returned HTTP ${response.status}`);
    return { provider: "sharepoint", target: publicConfig.sharePointSiteUrl, status: "success" as const, message: "SharePoint REST API site read succeeded.", durationMs: Date.now() - started, testedAt };
  } catch (error) {
    return { provider: "sharepoint", target: "SharePoint REST API", status: "failure" as const, message: sanitizeDiagnosticError(error), durationMs: Date.now() - started, testedAt };
  }
}
