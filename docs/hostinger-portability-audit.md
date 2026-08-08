# Welfare Pride Hostinger Portability Audit

**Target:** A standalone Welfare Pride intranet with no production dependency on Manus, hosted beside the existing Hostinger WordPress site.

## Hostinger architecture options

Hostinger currently supports server-side Express applications on **Business Web Hosting** and **Cloud** plans through its Node.js Web App deployment flow. Hostinger documents Node.js 18, 20, 22, and 24 support, GitHub or ZIP deployment, environment variables, process restart controls, and Express as a supported backend.[1] Hostinger recommends creating a subdomain as an independent website when it should operate as a standalone application.[2]

| Approach | Tradeoffs | Cost | Setup complexity |
| --- | --- | --- | --- |
| **Managed Node.js app on `intranet.yourdomain.com`** | Keeps WordPress on the main domain and deploys the intranet as a separate Hostinger website. Simplest operations, but requires a Business or Cloud plan and uses Hostinger’s supported Node build/runtime controls. | Included only when the existing plan supports Node.js; otherwise requires a plan change. | Moderate |
| **Hostinger VPS with Docker or a Node process manager** | Provides full control over Node, MySQL, reverse proxy, cron, and storage. WordPress can remain on its current plan or be moved separately. Requires server patching, backups, firewall, and monitoring. | Separate VPS subscription and ongoing administration. | High |

The preferred path is the **managed Node.js application on a protected subdomain** when the user’s current Hostinger plan is Business or Cloud. If the existing WordPress plan does not expose **Add Website → Deploy Web App**, the portable Docker/VPS package is the fallback. The intranet should not be rewritten as a WordPress theme or plugin because its persistent Express API, typed authorization layer, Microsoft token handling, background schedules, and multi-cloud operations are a separate application workload.

## Hostinger capabilities confirmed

| Requirement | Hostinger support |
| --- | --- |
| Express/React full-stack runtime | Supported on Business and Cloud Node.js Web Apps.[1] |
| Independent intranet subdomain | Supported as a separately managed website.[2] |
| MySQL | Hostinger documents MySQL creation and `DATABASE_URL` access for Node applications.[3] |
| Runtime secrets | Environment variables can be added during deployment and edited through redeployment settings; secrets do not need to be committed.[4] |
| Scheduled callbacks | Hostinger supports UTC cron jobs with custom commands.[5] |
| Full Docker/root access | Available through Hostinger VPS rather than managed web hosting.[6] |

## Manus dependency inventory

| Current dependency | Location | Portable replacement |
| --- | --- | --- |
| Manus OAuth and owner identity | `server/_core/oauth.ts`, `server/_core/sdk.ts`, client unauthorized redirect | Local owner setup and login, plus optional Entra OIDC/SAML |
| Manus Forge APIs | `_core/llm.ts`, image, voice, map, data, and notification helpers | Remove unused helpers; add a configurable OpenAI-compatible AI adapter only for the requested assistant |
| Manus Heartbeat | `_core/heartbeat.ts`, backup administrator router | Database-backed schedules invoked by Hostinger cron or a VPS worker |
| Manus storage proxy and injected S3 | `server/storage.ts`, `_core/storageProxy.ts`, profile/company uploads | Environment-configured S3-compatible storage with filesystem development fallback |
| Managed runtime build plugin and debug collector | Removed proprietary build plugin and generated debug assets | Standard Vite configuration and ordinary application logs |
| Manus analytics placeholders | `client/index.html` | Remove; analytics becomes optional and provider-neutral |
| Manus browser session bridge | `client/src/main.tsx` session storage bridge | Standard secure HTTP-only application session cookie |
| Hosted platform asset URLs | External managed-storage logo references | Package approved Welfare Pride assets in portable source storage |
| Managed environment variables | `_core/env.ts` | Documented `.env.example` and Hostinger environment variables |
| Managed database migration execution | project-only tooling | Drizzle migration CLI and an idempotent deployment migration command |

Files under `_core` that provide unused template integrations will be removed from the application build or left unreferenced only if the development scaffold requires them temporarily. The final dependency scan must find no production import, URL, environment variable, route, asset reference, plugin, or user-facing text tied to Manus.

## Portable operating model

The standalone application will use a standard MySQL database, secure HTTP-only sessions, local administrator bootstrap, optional Entra OIDC/SAML, S3-compatible object storage, and a provider-neutral AI endpoint. Hostinger’s MySQL guide supports either separate database variables or a single `DATABASE_URL`; the existing application already uses the latter.[3]

Scheduled backup validation will expose a signed internal endpoint protected by a dedicated cron secret. On managed Hostinger hosting, a UTC cron command can call that endpoint. On VPS, the same endpoint can be invoked through system cron or a small worker. This avoids an in-process timer and keeps schedules portable.[5]

## References

[1]: https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/ "How to add a Node.js Web App in Hostinger"
[2]: https://www.hostinger.com/support/1583405-how-to-create-and-delete-subdomains-in-hostinger/ "How to create a subdomain in Hostinger"
[3]: https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/ "Connecting a Hostinger MySQL database to a Node.js application"
[4]: https://www.hostinger.com/support/how-to-add-environment-variables-during-node-js-application-deployment/ "How to add environment variables during Node.js deployment"
[5]: https://www.hostinger.com/support/1583465-how-to-set-up-a-cron-job-at-hostinger/ "How to set up a cron job at Hostinger"
[6]: https://www.hostinger.com/support/node-js-hosting-options-at-hostinger/ "Node.js hosting options at Hostinger"
