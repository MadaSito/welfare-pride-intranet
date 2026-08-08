import { createHash, randomBytes } from "node:crypto";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { SAML, ValidateInResponseTo, type Profile } from "@node-saml/node-saml";
import { COOKIE_NAME } from "../../shared/const";
import * as db from "../db";
import { decryptJson, encryptJson } from "../security/encryption";
import type { MicrosoftPublicConfig, MicrosoftSecrets } from "../integrations/contracts";
import { getSessionCookieOptions } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import { DatabaseSamlCacheProvider } from "./samlCache";

const STATE_COOKIE = "__Host-wp_entra_state";
const VERIFIER_COOKIE = "__Host-wp_entra_verifier";
const NONCE_COOKIE = "__Host-wp_entra_nonce";
const CORRELATION_MAX_AGE_MS = 10 * 60 * 1000;
const ENTRA_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

type MicrosoftTokenResponse = {
  access_token: string;
  refresh_token?: string;
  id_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
};

type GraphMe = {
  id: string;
  displayName?: string;
  mail?: string;
  userPrincipalName?: string;
  jobTitle?: string;
  department?: string;
  officeLocation?: string;
  businessPhones?: string[];
  mobilePhone?: string;
};

function getPublicBaseUrl(req: Request) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const forwardedHost = req.headers["x-forwarded-host"];
  const protocol = typeof forwardedProto === "string" ? forwardedProto.split(",")[0] : req.protocol;
  const host = typeof forwardedHost === "string" ? forwardedHost.split(",")[0] : req.get("host");
  return `${protocol}://${host}`;
}

async function loadMicrosoftConfiguration() {
  const setting = await db.getIntegrationSettingByProvider("microsoft_entra");
  if (!setting) return null;
  const publicConfig = setting.publicConfigJson
    ? (JSON.parse(setting.publicConfigJson) as MicrosoftPublicConfig)
    : {};
  const secrets = setting.encryptedSecrets
    ? decryptJson<MicrosoftSecrets>(setting.encryptedSecrets)
    : {};
  return { publicConfig, secrets };
}

async function loadOidcConfiguration() {
  const configuration = await loadMicrosoftConfiguration();
  if (!configuration?.publicConfig.tenantId || !configuration.publicConfig.clientId || !configuration.secrets.clientSecret) return null;
  return configuration;
}

async function loadSamlConfiguration() {
  const configuration = await loadMicrosoftConfiguration();
  if (!configuration?.publicConfig.tenantId || !configuration.secrets.samlCertificate) return null;
  return configuration;
}

function profileValue(profile: Profile, keys: string[]) {
  for (const key of keys) {
    const value = profile[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) return value[0].trim();
  }
  return null;
}

function createSamlServiceProvider(req: Request, configuration: NonNullable<Awaited<ReturnType<typeof loadSamlConfiguration>>>) {
  const { publicConfig, secrets } = configuration;
  const baseUrl = getPublicBaseUrl(req);
  const callbackUrl = publicConfig.samlCallbackUrl || `${baseUrl}/api/auth/microsoft/saml/acs`;
  const issuer = publicConfig.samlIssuer || `${baseUrl}/api/auth/microsoft/saml/metadata`;
  return new SAML({
    callbackUrl,
    issuer,
    audience: issuer,
    entryPoint: publicConfig.samlEntryPoint || `https://login.microsoftonline.com/${publicConfig.tenantId}/saml2`,
    idpIssuer: publicConfig.samlIdpIssuer || `https://sts.windows.net/${publicConfig.tenantId}/`,
    idpCert: secrets.samlCertificate!,
    identifierFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    signatureAlgorithm: "sha256",
    digestAlgorithm: "sha256",
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: false,
    validateInResponseTo: ValidateInResponseTo.always,
    requestIdExpirationPeriodMs: CORRELATION_MAX_AGE_MS,
    cacheProvider: new DatabaseSamlCacheProvider(),
    acceptedClockSkewMs: 120_000,
    maxAssertionAgeMs: 5 * 60_000,
    disableRequestedAuthnContext: true,
  });
}

function clearCorrelationCookies(res: Response) {
  const options = { path: "/", secure: true, sameSite: "lax" as const };
  res.clearCookie(STATE_COOKIE, options);
  res.clearCookie(VERIFIER_COOKIE, options);
  res.clearCookie(NONCE_COOKIE, options);
}

function redirectWithAuthError(res: Response, code: string) {
  clearCorrelationCookies(res);
  res.redirect(302, `/?authError=${encodeURIComponent(code)}`);
}

export function registerMicrosoftAuthRoutes(app: Express) {
  app.get("/api/auth/microsoft/status", async (_req, res) => {
    try {
      const config = await loadMicrosoftConfiguration();
      const oidcConfigured = Boolean(config?.publicConfig.tenantId && config.publicConfig.clientId && config.secrets.clientSecret);
      const samlConfigured = Boolean(config?.publicConfig.tenantId && config.secrets.samlCertificate);
      res.json({
        configured: oidcConfigured || samlConfigured,
        protocols: { oidc: oidcConfigured, oauth2: oidcConfigured, saml2: samlConfigured, silentSignIn: oidcConfigured },
      });
    } catch {
      res.json({ configured: false, protocols: { oidc: false, oauth2: false, saml2: false, silentSignIn: false } });
    }
  });

  app.get("/api/auth/microsoft/saml/metadata", async (req, res) => {
    try {
      const configuration = await loadSamlConfiguration();
      if (!configuration) return res.status(404).type("text/plain").send("Microsoft Entra SAML is not configured");
      const metadata = createSamlServiceProvider(req, configuration).generateServiceProviderMetadata(null, null);
      return res.status(200).type("application/samlmetadata+xml").send(metadata);
    } catch (error) {
      console.error("[MicrosoftSAML] Metadata generation failed", error instanceof Error ? error.message : "Unknown error");
      return res.status(500).type("text/plain").send("SAML metadata generation failed");
    }
  });

  app.get("/api/auth/microsoft/saml/start", async (req, res) => {
    try {
      const configuration = await loadSamlConfiguration();
      if (!configuration) return redirectWithAuthError(res, "saml_not_configured");
      const destination = await createSamlServiceProvider(req, configuration).getAuthorizeUrlAsync("/", req.get("host"), {});
      return res.redirect(302, destination);
    } catch (error) {
      console.error("[MicrosoftSAML] Sign-in request failed", error instanceof Error ? error.message : "Unknown error");
      return redirectWithAuthError(res, "saml_sign_in_failed");
    }
  });

  app.post("/api/auth/microsoft/saml/acs", async (req, res) => {
    try {
      const configuration = await loadSamlConfiguration();
      if (!configuration) return redirectWithAuthError(res, "saml_not_configured");
      const encodedResponse = typeof req.body?.SAMLResponse === "string" ? req.body.SAMLResponse : null;
      if (!encodedResponse) return redirectWithAuthError(res, "invalid_saml_response");
      const result = await createSamlServiceProvider(req, configuration).validatePostResponseAsync({ SAMLResponse: encodedResponse });
      const profile = result.profile;
      if (!profile || result.loggedOut) return redirectWithAuthError(res, "invalid_saml_response");

      const tenantId = configuration.publicConfig.tenantId!;
      const assertionTenant = profileValue(profile, ["http://schemas.microsoft.com/identity/claims/tenantid", "tenantid"]);
      if (assertionTenant && assertionTenant.toLowerCase() !== tenantId.toLowerCase()) throw new Error("SAML assertion tenant mismatch");
      const email = profileValue(profile, ["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn", "email", "mail"]) || profile.nameID;
      const displayName = profileValue(profile, ["http://schemas.microsoft.com/identity/claims/displayname", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name", "displayName"]) || email;
      const objectId = profileValue(profile, ["http://schemas.microsoft.com/identity/claims/objectidentifier", "objectidentifier"]) || createHash("sha256").update(profile.nameID).digest("hex");
      const openId = `entra:${tenantId}:${objectId}`;

      await db.upsertUser({ openId, name: displayName, email, loginMethod: "microsoft_entra_saml", lastSignedIn: new Date() });
      const user = await db.getUserByOpenId(openId);
      if (!user) throw new Error("Authenticated Welfare Pride SAML user could not be provisioned");
      await db.upsertEmployeeProfileFromEntra({
        userId: user.id,
        entraUserId: objectId,
        displayName,
        email,
        jobTitle: profileValue(profile, ["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/jobtitle", "jobTitle"]),
        department: profileValue(profile, ["department"]),
        officeLocation: profileValue(profile, ["officeLocation"]),
        phone: profileValue(profile, ["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/mobilephone", "mobilePhone"]),
      });
      const sessionToken = await sdk.createSessionToken(openId, { name: displayName, expiresInMs: ENTRA_SESSION_MAX_AGE_MS });
      res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req), maxAge: ENTRA_SESSION_MAX_AGE_MS });
      return res.redirect(302, "/");
    } catch (error) {
      console.error("[MicrosoftSAML] Assertion validation failed", error instanceof Error ? error.message : "Unknown error");
      return redirectWithAuthError(res, "saml_sign_in_failed");
    }
  });

  app.get("/api/auth/microsoft/start", async (req, res) => {
    const configuration = await loadOidcConfiguration();
    if (!configuration) {
      redirectWithAuthError(res, "microsoft_not_configured");
      return;
    }

    const { publicConfig } = configuration;
    const mode = req.query.mode === "silent" ? "silent" : "interactive";
    const state = randomBytes(32).toString("base64url");
    const verifier = randomBytes(48).toString("base64url");
    const nonce = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const redirectUri = publicConfig.redirectUri || `${getPublicBaseUrl(req)}/api/auth/microsoft/callback`;
    const scope = publicConfig.graphScopes || "openid profile email offline_access User.Read User.ReadBasic.All";
    const authority = publicConfig.authorityUrl || `https://login.microsoftonline.com/${publicConfig.tenantId}`;
    const authorizeUrl = new URL(`${authority.replace(/\/$/, "")}/oauth2/v2.0/authorize`);
    authorizeUrl.search = new URLSearchParams({
      client_id: publicConfig.clientId!,
      response_type: "code",
      redirect_uri: redirectUri,
      response_mode: "query",
      scope,
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: "S256",
      ...(mode === "silent" ? { prompt: "none" } : { prompt: "select_account" }),
    }).toString();

    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      path: "/",
      maxAge: CORRELATION_MAX_AGE_MS,
    };
    res.cookie(STATE_COOKIE, state, cookieOptions);
    res.cookie(VERIFIER_COOKIE, verifier, cookieOptions);
    res.cookie(NONCE_COOKIE, nonce, cookieOptions);
    res.redirect(302, authorizeUrl.toString());
  });

  app.get("/api/auth/microsoft/callback", async (req, res) => {
    const oauthError = typeof req.query.error === "string" ? req.query.error : null;
    if (oauthError) {
      redirectWithAuthError(res, oauthError === "interaction_required" || oauthError === "login_required" ? "interaction_required" : "microsoft_sign_in_failed");
      return;
    }

    const code = typeof req.query.code === "string" ? req.query.code : null;
    const returnedState = typeof req.query.state === "string" ? req.query.state : null;
    const cookies = parseCookieHeader(req.headers.cookie ?? "");
    if (!code || !returnedState || returnedState !== cookies[STATE_COOKIE] || !cookies[VERIFIER_COOKIE] || !cookies[NONCE_COOKIE]) {
      redirectWithAuthError(res, "invalid_authentication_state");
      return;
    }

    try {
      const configuration = await loadOidcConfiguration();
      if (!configuration) {
        redirectWithAuthError(res, "microsoft_not_configured");
        return;
      }
      const { publicConfig, secrets } = configuration;
      const redirectUri = publicConfig.redirectUri || `${getPublicBaseUrl(req)}/api/auth/microsoft/callback`;
      const authority = publicConfig.authorityUrl || `https://login.microsoftonline.com/${publicConfig.tenantId}`;
      const tokenUrl = `${authority.replace(/\/$/, "")}/oauth2/v2.0/token`;
      const tokenResponse = await fetch(tokenUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: publicConfig.clientId!,
          client_secret: secrets.clientSecret!,
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          code_verifier: cookies[VERIFIER_COOKIE],
          scope: publicConfig.graphScopes || "openid profile email offline_access User.Read User.ReadBasic.All",
        }),
      });
      if (!tokenResponse.ok) throw new Error(`Microsoft token exchange failed with status ${tokenResponse.status}`);
      const tokenSet = (await tokenResponse.json()) as MicrosoftTokenResponse;

      const tenantId = publicConfig.tenantId!;
      const issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;
      const jwks = createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`));
      const { payload } = await jwtVerify(tokenSet.id_token, jwks, {
        algorithms: ["RS256"],
        audience: publicConfig.clientId,
        issuer,
      });
      if (payload.nonce !== cookies[NONCE_COOKIE] || payload.tid !== tenantId) {
        throw new Error("Microsoft identity token correlation failed");
      }

      const graphBaseUrl = (publicConfig.graphBaseUrl || "https://graph.microsoft.com/v1.0").replace(/\/$/, "");
      const graphResponse = await fetch(`${graphBaseUrl}/me?$select=id,displayName,mail,userPrincipalName,jobTitle,department,officeLocation,businessPhones,mobilePhone`, {
        headers: { authorization: `Bearer ${tokenSet.access_token}` },
      });
      if (!graphResponse.ok) throw new Error(`Microsoft Graph profile request failed with status ${graphResponse.status}`);
      const graphUser = (await graphResponse.json()) as GraphMe;
      const displayName = graphUser.displayName || String(payload.name || graphUser.userPrincipalName || "Welfare Pride Employee");
      const email = graphUser.mail || graphUser.userPrincipalName || (typeof payload.preferred_username === "string" ? payload.preferred_username : null);
      const entraObjectId = graphUser.id || String(payload.oid || payload.sub);
      const openId = `entra:${tenantId}:${entraObjectId}`;

      await db.upsertUser({ openId, name: displayName, email, loginMethod: "microsoft_entra_oidc", lastSignedIn: new Date() });
      const user = await db.getUserByOpenId(openId);
      if (!user) throw new Error("Authenticated Welfare Pride user could not be provisioned");

      await db.upsertEmployeeProfileFromEntra({
        userId: user.id,
        entraUserId: entraObjectId,
        displayName,
        email,
        jobTitle: graphUser.jobTitle ?? null,
        department: graphUser.department ?? null,
        officeLocation: graphUser.officeLocation ?? null,
        phone: graphUser.mobilePhone || graphUser.businessPhones?.[0] || null,
      });
      await db.upsertMicrosoftOauthSession({
        userId: user.id,
        tenantId,
        encryptedTokenSet: encryptJson({
          accessToken: tokenSet.access_token,
          refreshToken: tokenSet.refresh_token,
          tokenType: tokenSet.token_type,
        }),
        scopes: tokenSet.scope ?? null,
        accessTokenExpiresAt: new Date(Date.now() + tokenSet.expires_in * 1000),
      });

      const sessionToken = await sdk.createSessionToken(openId, { name: displayName, expiresInMs: ENTRA_SESSION_MAX_AGE_MS });
      res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req), maxAge: ENTRA_SESSION_MAX_AGE_MS });
      clearCorrelationCookies(res);
      res.redirect(302, "/");
    } catch (error) {
      console.error("[MicrosoftAuth] Callback failed", error instanceof Error ? error.message : "Unknown error");
      redirectWithAuthError(res, "microsoft_sign_in_failed");
    }
  });
}
