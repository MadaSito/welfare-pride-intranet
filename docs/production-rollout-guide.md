# Welfare Pride Intranet Production Rollout Guide

**Author:** Welfare Pride Technical Team  
**Prepared for:** Welfare Pride  
**Application:** Welfare Pride employee intranet

## 1. Deployment boundaries

The portal is ready for a controlled production rollout after an authorized Welfare Pride administrator completes the external service configuration. The code, schema, and branded interface are implemented; Microsoft Entra, SharePoint, and cloud providers remain intentionally unconfigured because tenant identifiers, credentials, site identifiers, and storage accounts must come from Welfare Pride.

Deploy the reviewed release to the protected Hostinger subdomain by following [`hostinger-deployment.md`](hostinger-deployment.md). Record the resulting production origin as `PORTAL_BASE_URL`. Use one canonical HTTPS origin for production and avoid carrying development callbacks into the production Entra registration. Microsoft requires redirect URIs to match registered values and recommends separating development and production registrations; production web callbacks should use HTTPS.[1]

| Portal endpoint | Production value |
| --- | --- |
| OIDC callback | `PORTAL_BASE_URL/api/auth/microsoft/callback` |
| SAML assertion consumer service | `PORTAL_BASE_URL/api/auth/microsoft/saml/acs` |
| SAML service-provider metadata | `PORTAL_BASE_URL/api/auth/microsoft/saml/metadata` |
| Authentication readiness | `PORTAL_BASE_URL/api/auth/microsoft/status` |
| Scheduled backup dispatcher | `PORTAL_BASE_URL/api/cron/dispatch` |

## 2. Microsoft Entra OIDC and OAuth 2.0 registration

Create a Microsoft Entra **App registration** in the Welfare Pride tenant. For an employee-only portal, choose **Accounts in this organizational directory only**, which Microsoft describes as the single-tenant line-of-business option.[2] Under **Authentication**, add a **Web** platform and register the exact OIDC callback above. Do not enable implicit grant; the portal uses the authorization-code flow with PKCE, state, and nonce validation.

Create a client secret and copy its value immediately. Enter the Tenant ID, Application (client) ID, and client-secret value in **Administration → Integration Settings**. The current release authenticates its confidential Graph client with a secret. Microsoft recommends certificate or federated credentials over client secrets for production confidential clients,[2] so Welfare Pride should apply a short validity period, assign an owner, record the expiration date, and schedule rotation. Saved secrets are encrypted with AES-256-GCM and are never returned to the browser after submission.

Use the following production settings:

| Integration Settings field | Required value |
| --- | --- |
| Tenant ID | Welfare Pride Microsoft Entra tenant ID |
| Client ID | App registration Application (client) ID |
| Client Secret | Newly created secret **value**, not its identifier |
| Authority URL | `https://login.microsoftonline.com` |
| OIDC Redirect URI | `PORTAL_BASE_URL/api/auth/microsoft/callback` |
| Graph Base URL | `https://graph.microsoft.com/v1.0` |
| Delegated Graph Scopes | `openid profile email offline_access User.Read User.ReadBasic.All Sites.Read.All` |

The `openid` scope is required for OIDC identity, while `profile` and `email` provide profile claims. The portal requests `offline_access` so it can refresh delegated Microsoft access for SharePoint document browsing; Microsoft documents that v2 authorization-code requests must explicitly include `offline_access` when refresh tokens are needed.[3]

## 3. Microsoft Graph API permissions

Add Microsoft Graph permissions to the app registration and grant tenant administrator consent. Use the smallest permission set that passes Welfare Pride security review. The application-token directory and holiday operations use the app registration’s statically granted **Application** permissions through `https://graph.microsoft.com/.default`; the HR repository uses the signed-in employee’s **Delegated** token so SharePoint continues to decide what that employee may access.[3]

| Permission type | Permission | Portal purpose |
| --- | --- | --- |
| Delegated | `User.Read` | Signed-in employee identity and profile |
| Delegated | `User.ReadBasic.All` | Basic directory discovery where permitted |
| Delegated | `Sites.Read.All` | Employee-authorized HR library browse and search |
| Application | `User.Read.All` | Directory fields and manager relationships for the live org chart |
| Application | `Sites.Read.All` | Company holiday list synchronization |

If Welfare Pride policy does not permit tenant-wide `User.Read.All`, test whether a narrower permission and reduced field set meets the organization-chart requirement. Microsoft identifies `User.Read.All` as an administrator-restricted permission and recommends least privilege for every application.[3]

After consent, save Integration Settings and run **Test Microsoft Graph**. A successful diagnostic confirms client authentication and Graph reachability; it does not replace functional checks of directory fields, consent policy, or individual SharePoint authorization.

## 4. SAML 2.0 enterprise application

Create or configure a Microsoft Entra **Enterprise application** for SAML. Set the basic SAML configuration to the values below. Microsoft’s SAML guidance requires an entity identifier, assertion consumer service URL, SAML SSO mode, claim configuration, and a token-signing certificate.[4]

| Entra SAML setting | Welfare Pride value |
| --- | --- |
| Identifier / Entity ID | The Integration Settings **Service Provider Entity ID**, or the metadata URL when left at its default |
| Reply URL / ACS | `PORTAL_BASE_URL/api/auth/microsoft/saml/acs` |
| Sign-on URL | `PORTAL_BASE_URL/api/auth/microsoft/saml/start` |
| Relay State | Leave blank unless Welfare Pride establishes a documented route policy |

Configure claims for tenant ID, object ID, display name, email or user principal name, job title, department, office location, and mobile phone when those attributes are approved for the portal. The application requires a stable identity from object ID or Name ID and accepts standard Microsoft claim URIs for email, tenant, object identifier, display name, and mobile phone.

Download the active **Certificate (Base64)** from Entra and paste only the public signing certificate into **Entra SAML Signing Certificate**. Never paste a private key. Enter the Entra Login URL as the SAML Sign-in URL and the Entra Identifier as the Identity Provider Issuer. Open the portal metadata endpoint to verify the final entity ID and ACS values before assigning a pilot group.

The portal validates signed assertions, time bounds, audience, issuer, tenant, and `InResponseTo`. SAML request correlation is stored in the database so validation remains consistent across autoscaled instances; the Node SAML project specifically cautions that an in-memory cache is inappropriate for multi-instance deployments.[5]

## 5. Silent and pass-through authentication

The **Use existing work session** control sends an OIDC authorization request with `prompt=none`. If the browser already has an eligible Microsoft session and Conditional Access permits it, Entra can complete authentication without another interactive prompt. If no reusable session exists, the portal returns to the sign-in page and the employee can choose interactive OIDC or SAML. Microsoft Entra—not the portal—remains responsible for passwordless authentication, Windows session federation, MFA, Conditional Access, and device-compliance policy.

Welfare Pride application sessions have a twelve-hour maximum age. Microsoft access and refresh tokens remain encrypted server-side and are never exposed to portal JavaScript.

## 6. SharePoint configuration

Identify the SharePoint site, holiday list, and HR document library used by the portal. Enter the following values in Integration Settings:

| Field | Source |
| --- | --- |
| SharePoint Site URL | Canonical Welfare Pride site URL |
| SharePoint Site ID | Microsoft Graph site identifier |
| Holiday List ID | List identifier containing approved company holidays |
| HR Document Library / Drive ID | Drive identifier for the HR library |

The holiday list should provide `Title`, `Description`, `StartDate`, `EndDate`, `IsObserved`, and `Modified` fields. Holiday synchronization uses application access and stores a portal projection for calendar display.

HR document browsing is different by design: every query uses the signed-in employee’s delegated token against the configured SharePoint drive. Welfare Pride does not reproduce SharePoint ACLs, groups, or item-level permissions in the portal. If a user cannot access a file through SharePoint, the portal must not grant access. Run **Test SharePoint REST API**, then validate the HR page with at least one standard employee and one authorized HR administrator.

## 7. Technology embeds

Administrators may add only HTTPS applications with an exact hostname allowlist. Local, private-network, and mismatched hosts are rejected. Active origins are incorporated into the production `frame-src` Content Security Policy, and each iframe uses a restrictive sandbox. The external application must also permit embedding through its own `Content-Security-Policy: frame-ancestors` or `X-Frame-Options` policy. If it refuses framing, use the portal’s separate-window path rather than weakening the portal security boundary.

## 8. Multi-cloud backup destinations

Configure destinations under **Administration → Backup Center**. Secret values are encrypted and redacted after save. Start with **Test connection**, then use **Dry run**. A dry run performs write, read, SHA-256 verification, and cleanup. A retained backup run writes a compact control-plane manifest, not an unrestricted bulk export of the source tenant.

| Provider | Public configuration | Secret configuration |
| --- | --- | --- |
| SharePoint / OneDrive | Drive ID and folder path | Microsoft application credentials from Integration Settings |
| Google Drive | Client ID and folder path | Client secret and refresh token |
| AWS S3 | Region, bucket, optional endpoint, folder path | Access key ID and secret access key |
| Wasabi | Region, bucket, endpoint, folder path | Access key ID and secret access key |
| Backblaze B2 | Region, bucket, S3 endpoint, folder path | Application key ID and application key |
| Azure Blob Storage | Container and folder path | Connection string |

Restore controls intentionally perform checksum-verified retrieval validation and record an audit event. They do not overwrite SharePoint, OneDrive, or another source system automatically. Treat full content restoration as a governed recovery procedure with destination-specific review, legal retention checks, and a dedicated worker sized for the data volume.

## 9. Administrator and content setup

Create the first local owner account immediately after deployment, before the intranet URL is shared. Setup then closes automatically. Promote additional administrators only through controlled user-role management and test the standard-user denial screen for every `/admin/*` route. The server independently enforces the administrator role for all sensitive procedures.

Before launch, Welfare Pride administrators should publish approved About content, founder biographies and milestones, announcements, events, Technology links, and employee-facing Important Links. The portal intentionally does not fabricate company history, founder details, or employee-generated testimonials.

## 10. Pilot and production checklist

| Gate | Acceptance evidence |
| --- | --- |
| Domain and TLS | One canonical HTTPS production origin |
| OIDC | Interactive and silent flow tested with pilot accounts |
| SAML | Metadata imported, signed assertion accepted, unassigned user denied by Entra policy |
| Conditional Access | MFA and device policies validated by Welfare Pride security |
| Graph | Directory and manager relationships load using approved application permissions |
| SharePoint holidays | Approved list synchronizes and date ranges display correctly |
| HR documents | Standard and HR users see only SharePoint-authorized results |
| Birthday privacy | Month and day display; year is absent from API and UI |
| Technology | Approved host embeds or opens separately without CSP relaxation |
| Backups | Each enabled destination passes test and dry run; restore verification succeeds |
| Administration | Standard employees cannot open or call administrator operations |
| Operations | Client secret, SAML certificate, and storage-key owners and rotation dates are recorded |

Launch with a small pilot group, collect authorization and content feedback, then expand assignment in Entra. Keep the portal unlisted from public audiences and review audit events, failed diagnostics, certificate expiration, secret rotation, backup schedules, and restore tests on a documented operational cadence.

## References

[1]: https://learn.microsoft.com/en-us/entra/identity-platform/reply-url "Redirect URI (reply URL) restrictions — Microsoft Learn"
[2]: https://learn.microsoft.com/en-us/graph/auth-register-app-v2 "Register an application with the Microsoft identity platform — Microsoft Learn"
[3]: https://learn.microsoft.com/en-us/entra/identity-platform/scopes-oidc "Scopes and permissions in the Microsoft identity platform — Microsoft Learn"
[4]: https://learn.microsoft.com/en-us/graph/application-saml-sso-configure-api "Configure SAML-based single sign-on using Microsoft Graph — Microsoft Learn"
[5]: https://github.com/node-saml/node-saml "Node SAML — GitHub"
