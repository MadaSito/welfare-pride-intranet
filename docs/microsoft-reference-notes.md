# Microsoft Deployment Reference Notes

The following official Microsoft sources were reviewed on August 8, 2026 for the Welfare Pride rollout guide.

1. [Register an application with the Microsoft identity platform](https://learn.microsoft.com/en-us/graph/auth-register-app-v2). A server-rendered web application should be registered in the intended tenant, normally as a single-tenant line-of-business application for an internal portal. Under **Authentication**, add a **Web** platform and the application redirect URI. Microsoft documents certificate credentials as preferable to client secrets for production confidential clients; the current Welfare Pride settings support a client secret and should therefore be governed by rotation and least-privilege controls.

2. [Redirect URI (reply URL) restrictions](https://learn.microsoft.com/en-us/entra/identity-platform/reply-url). Production redirect URIs should use HTTPS and must exactly match registered values, including path case. Development and production registrations should be separated, unnecessary development redirects should not remain exposed in production, and wildcard redirect URIs should be avoided.

3. [Scopes and permissions in the Microsoft identity platform](https://learn.microsoft.com/en-us/entra/identity-platform/scopes-oidc). OIDC uses `openid`; `email` and `profile` enrich identity data; `offline_access` is required on v2 authorization-code requests when a refresh token is needed. Microsoft recommends least privilege, and permissions such as `User.Read.All` require administrator consent. Client-credentials requests use the resource `/.default` scope.

4. [Configure SAML-based single sign-on using Microsoft Graph](https://learn.microsoft.com/en-us/graph/application-saml-sso-configure-api). Microsoft Entra supports SAML alongside OIDC and OAuth. A SAML enterprise application must define an entity identifier and assertion consumer service URL, use SAML as the preferred SSO mode, configure emitted claims, and have a token-signing certificate. The guide notes that service-provider-initiated and identity-provider-initiated flows have distinct configuration considerations.

5. [Node SAML](https://github.com/node-saml/node-saml). The maintained service-provider library requires the IdP public signing certificate for incoming assertion validation, supports SHA-256, validates assertion time bounds, and can validate `InResponseTo`. It warns that an in-memory request cache is unsuitable for multi-instance applications; Welfare Pride uses a durable database-backed correlation cache.
