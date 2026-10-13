# Hostinger Deployment Guide for the Welfare Pride Intranet

The Welfare Pride intranet is a **standalone Node.js application**. Keep the existing WordPress site on the primary domain and deploy the intranet on a protected subdomain such as `intranet.example.org`. Hostinger supports Express-based Node.js web applications on eligible Business and Cloud plans, and it supports independent websites on subdomains.[1] [2]

> Do not upload this application as a WordPress theme, iframe it into a public page, or merge its tables into the WordPress database. Its secure sessions, Microsoft tokens, SharePoint delegation, scheduled backups, and AI retrieval require an isolated server runtime and database.

| Hostinger environment | Recommended path | Application location |
| --- | --- | --- |
| Business or Cloud plan with **Deploy Web App** | Managed Node.js deployment | Separate Hostinger website on `intranet.example.org` |
| WordPress plan without Node.js Web Apps | Hostinger VPS | Docker Compose stack on `intranet.example.org` |
| Existing managed WordPress site plus separate VPS | Recommended split architecture | WordPress remains unchanged; DNS for `intranet` points to the VPS |

## 1. DNS and application isolation

Create `intranet.example.org` as a separate website or point its DNS `A` record to the VPS public IP. Hostinger documents creating a subdomain as an independently managed website.[2] Create a **dedicated MySQL database and database user** for the intranet; do not grant the intranet account access to WordPress tables. Hostinger documents connecting Node.js applications to its MySQL service through connection variables or a database URL.[3]

## 2. Required secrets

Use `deploy/hostinger/environment.template` only as a reference. Store real values in Hostinger’s environment-variable interface or a root-readable `.env` file on a VPS. Hostinger supports adding environment variables to managed Node.js deployments.[4]

| Variable | Purpose | Required |
| --- | --- | --- |
| `DATABASE_URL` | Dedicated MySQL connection URL | Yes |
| `JWT_SECRET` | AES-256-GCM key derivation for saved integration secrets | Yes; at least 32 random bytes |
| `CRON_SECRET` | Bearer token for `/api/cron/dispatch` | Yes when backup schedules are enabled |
| `STORAGE_*` | S3-compatible profile and company image storage | Required on managed hosting; optional on a single VPS using a persistent volume |
| `AI_*` | Optional environment-based AI provider settings | Optional; can be configured in the administrator UI |

Generate independent values with `openssl rand -hex 32`. Never reuse the WordPress salts, WordPress database password, Microsoft client secret, or an AI provider key for any of these values.

## 3. Managed Hostinger Node.js deployment

Use this path only when hPanel offers **Add Website → Deploy Web App**. Hostinger’s managed flow supports current Node.js versions, GitHub or ZIP deployment, build commands, start commands, and environment variables.[1]

| Setting | Value |
| --- | --- |
| Node.js version | 22 |
| Install command | `corepack enable && pnpm install --frozen-lockfile` |
| Build command | `pnpm build` |
| Output directory | `dist` |
| Entry file | `dist/hostinger-entry.js` |
| Application port | Read automatically from `PORT` |

Hostinger's current build-settings page resolves the entry file from the repository root, so enter `dist/hostinger-entry.js`. The project build creates that file; it applies the bundled Drizzle migrations before launching `dist/index.js`. Do not use the generic `index.js` default because there is no server entry point in the repository root.

Add all required environment variables in hPanel before the first start. Use an S3-compatible object store because managed deployments can replace application files during releases. After deployment, configure a Hostinger UTC cron job that invokes the scheduler endpoint at least every five minutes.[5]

```bash
curl --fail --silent --show-error --max-time 55 \
  -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://intranet.example.org/api/cron/dispatch
```

## 4. Hostinger VPS Docker deployment

The Docker path runs the application, a dedicated MySQL 8.4 database, a one-minute scheduler, and Caddy with automatic TLS. Full container control requires a VPS rather than ordinary managed WordPress hosting.[6]

```bash
git clone YOUR_PRIVATE_REPOSITORY_URL welfare-pride-intranet
cd welfare-pride-intranet
chmod +x deploy/hostinger/install.sh deploy/hostinger/entrypoint.sh deploy/hostinger/backup.sh
sudo deploy/hostinger/install.sh --mode docker --domain intranet.example.org
```

The installer generates `.env` with mode `600`, creates independent database and application secrets, builds the containers, applies migrations, and starts TLS. Before running it, point the subdomain DNS record to the VPS and allow inbound TCP ports `80` and `443`. Do not expose MySQL or the Node application port publicly.

Use the included backup command from a root-owned cron entry:

```bash
cd /path/to/welfare-pride-intranet && deploy/hostinger/backup.sh
```

The script creates compressed database and upload archives, records SHA-256 checksums, and removes files older than `BACKUP_RETENTION_DAYS` (default 30). Copy those archives to a separate encrypted destination; a backup retained only on the same VPS is not disaster recovery.

## 5. First login before Microsoft Entra is configured

Open `https://intranet.example.org`. The sign-in screen detects that no owner exists and shows **Create first owner account**. Enter the owner’s name, email, and a strong password. The server creates the first local administrator and a revocable secure session, then permanently closes setup because a local credential now exists. Complete this step immediately after deployment and before sharing the intranet URL.

Sign in locally, open **Administration → Integration Settings**, and configure Microsoft Entra OIDC or SAML, Microsoft Graph, SharePoint, and the optional AI provider. Local owner login remains the break-glass path when Entra configuration is unavailable.

## 6. WordPress connection

WordPress should link to the intranet rather than host it. Zip `deploy/wordpress/welfare-pride-intranet-link`, upload it under **Plugins → Add New → Upload Plugin**, activate it, and set the intranet URL under **Settings → Welfare Pride Intranet**. Add `[welfare_pride_intranet_link]` to a private employee landing page or add the subdomain URL directly to the WordPress navigation menu.

The companion plugin does not share WordPress sessions or passwords with the intranet. Employees authenticate with Microsoft Entra or a portal-local account. This separation prevents WordPress plugins, themes, and public-site cookies from becoming part of the intranet’s security boundary.

## 7. Post-deployment checks

Confirm that `https://intranet.example.org/api/healthz` returns `{"ok":true}`, HTTPS redirects correctly, the local owner can sign in and sign out, Integration Settings is administrator-only, database migrations report no pending changes, profile photo uploads persist after a restart, and the cron dispatch returns an authenticated success response. Then configure Entra redirect and SAML callback URLs using the final `https://intranet.example.org` origin.

## References

[1]: https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/ "How to add a Node.js Web App in Hostinger"
[2]: https://www.hostinger.com/support/1583405-how-to-create-and-delete-subdomains-in-hostinger/ "How to create a subdomain in Hostinger"
[3]: https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/ "Connecting a Hostinger MySQL database to a Node.js application"
[4]: https://www.hostinger.com/support/how-to-add-environment-variables-during-node-js-application-deployment/ "How to add environment variables during Node.js deployment"
[5]: https://www.hostinger.com/support/1583465-how-to-set-up-a-cron-job-at-hostinger/ "How to set up a cron job at Hostinger"
[6]: https://www.hostinger.com/support/node-js-hosting-options-at-hostinger/ "Node.js hosting options at Hostinger"
