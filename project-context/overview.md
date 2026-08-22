# Welfare Pride Intranet: Standalone Context Overview

## Product purpose

Welfare Pride is a private employee intranet that centralizes people, news, calendars, HR resources, company information, secure technology embeds, multi-cloud backup administration, and an OpenAI-first, permission-aware assistant. The portal is designed to be self-hosted on Docker, Linux VPS infrastructure, Azure containers, or comparable Node.js-capable hosting.

## Core architecture

The application uses React and TypeScript in the browser, Express and typed RPC procedures on the server, MySQL through Drizzle ORM, and encrypted server-side integration settings. Application sessions are revocable, database-backed, HTTP-only cookies. The local authentication path supports a temporary fresh-install bootstrap account, mandatory first-login password rotation, TOTP MFA, recovery codes, and administrator-managed MFA requirements. Microsoft Entra OIDC, OAuth, and SAML remain optional integrations configured after local access is established.

## Security boundaries

SharePoint remains the authorization authority for HR documents. The portal never reproduces document permissions in application data. Secrets are encrypted at rest with authenticated encryption, plaintext secrets are not returned to browsers, diagnostics are sanitized, and the AI assistant retrieves only published company content and documents authorized for the requesting user. Local bootstrap credentials are created only when the database has no local credential and `BOOTSTRAP_DEFAULT_ADMIN=true`; portal access is blocked until the bootstrap password is replaced and MFA enrollment is complete.

## Branding and UX

Use the exact Welfare Pride name, source-controlled logo assets, Roboto typography, primary blue `#5A92C9`, and orange `#D58240`. The user experience is a responsive dashboard with clear loading, empty, error, hover, focus, and reduced-motion states.

## Deployment posture

Deploy the application behind HTTPS with a persistent MySQL database and persistent object or filesystem storage. Use `deploy/install.sh` for the Docker, native Linux, or managed Node installer entry point. Use a protected custom subdomain such as `intranet.example.org`; WordPress can link to the intranet but does not host its server-side runtime.
