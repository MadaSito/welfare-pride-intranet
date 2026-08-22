# Welfare Pride Intranet: Standalone Deployment Guide

**Audience:** Welfare Pride system administrators and deployment operators  
**Applies to:** Docker containers, Linux VPS deployments, and Azure-ready MySQL TLS configuration  
**Repository context:** [`project-context/`](../project-context/) and [`session-worklogs/`](../session-worklogs/) are committed at the repository root.

> **Security first:** Do not publish the portal until HTTPS, a persistent database, a protected environment file, and a deployment administrator are in place. The fresh-install `admin` / `admin` account is intentionally temporary. Its first sign-in is restricted to password replacement and multi-factor authentication (MFA) enrollment; it cannot access portal content or administration until both steps are complete.

## 1. Deployment model

The Welfare Pride intranet is a standalone Node.js application. WordPress may provide a public-site link to the intranet, but WordPress shared hosting does not host its server-side application runtime. Deploy the intranet on a protected subdomain such as `intranet.example.org`.

| Component | Docker deployment | Native Linux VPS deployment |
| --- | --- | --- |
| Application | `app` container built from `deploy/hostinger/Dockerfile` | Node.js service managed by `systemd` |
| Database | MySQL 8.4 container and named volume | Dedicated MySQL 8 server or managed MySQL service |
| HTTPS | Caddy container and automatically managed certificates | Caddy or Nginx reverse proxy in front of the service |
| Scheduled work | Isolated scheduler container calling the authenticated dispatch route | Root or service-user cron entry calling the authenticated dispatch route |
| Upload persistence | Named Docker volume or configured object storage | Protected local path or configured object storage |

## 2. First-login lifecycle

The installer writes `BOOTSTRAP_DEFAULT_ADMIN=true` for a fresh Docker or native deployment. On the application’s first start, and only if the database has no local credential, the service creates one temporary local administrator.

| Step | Required action |
| --- | --- |
| 1 | Browse to `https://intranet.example.org` and sign in using **username:** `admin` and **password:** `admin`. |
| 2 | Set a new unique password. The portal enforces a minimum of 12 characters including uppercase, lowercase, number, and symbol. |
| 3 | Enroll a TOTP authenticator application by scanning the on-screen QR code, then confirm its six-digit code. |
| 4 | Store the recovery codes offline. Each recovery code is accepted once. |
| 5 | Set `BOOTSTRAP_DEFAULT_ADMIN=false` in `.env`, then restart the application. This is defense in depth; an existing local credential already prevents re-creation. |
| 6 | Open **Integration Settings → Local access** to manage MFA policy for later local accounts and configure optional Microsoft Entra OIDC, OAuth, or SAML sign-in. |

## 3. Required configuration

Copy `deploy/hostinger/environment.template` to `.env` only on the server. Set its permissions to owner read/write only.

```bash
cp deploy/hostinger/environment.template .env
chmod 600 .env
```

| Variable | Requirement |
| --- | --- |
| `DATABASE_URL` | MySQL connection string. Use a dedicated, least-privilege application database account. |
| `JWT_SECRET` | New high-entropy secret, unique to this production deployment. |
| `CRON_SECRET` | Different high-entropy secret used only by the scheduled dispatcher. |
| `BOOTSTRAP_DEFAULT_ADMIN` | `true` only for the initial bootstrap. Change to `false` after the first secure login. |
| `STORAGE_DRIVER` | `local` for persistent local volume/storage, or configure the S3-compatible variables for object storage. |
| `DATABASE_SSL` | Set `true` for Azure Database for MySQL or another provider requiring TLS. |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | Keep `true` in production unless a database provider has documented an explicit certificate-chain exception. |
| `AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY` | Optional server-only OpenAI provider configuration. Never expose the API key to the browser. |

Generate secrets locally on the target host:

```bash
openssl rand -hex 32
```

## 4. Docker installation

Use this route when the target server supports Docker Engine and Docker Compose v2. The stack includes application, MySQL, scheduler, and Caddy services.

```bash
git clone https://github.com/<your-organization>/welfare-pride-intranet.git welfare-pride-intranet
cd welfare-pride-intranet
chmod +x deploy/install.sh
sudo ./deploy/install.sh --mode docker --domain intranet.example.org
```

Confirm service health:

```bash
cd deploy/hostinger
docker compose --env-file ../../.env ps
docker compose --env-file ../../.env logs --tail=100 app
curl --fail --silent https://intranet.example.org/api/healthz
```

The installer creates `.env` only when one does not already exist. It does not overwrite an existing environment file. Docker volumes retain MySQL data, uploads, and Caddy certificate state across container restarts.

## 5. Native Linux VPS installation

Use this route for Ubuntu or another supported Linux VPS that has Node.js 22, Corepack, a reachable MySQL server, and a reverse proxy. Run the command as root only when you want the installer to create and start the `systemd` service.

```bash
git clone https://github.com/<your-organization>/welfare-pride-intranet.git welfare-pride-intranet
cd welfare-pride-intranet
sudo ./deploy/install.sh \
  --mode native \
  --service-user welfarepride \
  --database-url 'mysql://welfare_pride:REPLACE@127.0.0.1:3306/welfare_pride'
```

Before running the installer, create the non-login service account and grant it ownership of the checked-out application directory and upload path:

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin welfarepride
sudo chown -R welfarepride:welfarepride /srv/welfare-pride-intranet
```

Inspect the service after installation:

```bash
sudo systemctl status welfare-pride-intranet
sudo journalctl -u welfare-pride-intranet -n 100 --no-pager
curl --fail --silent http://127.0.0.1:3000/api/healthz
```

Place Caddy or Nginx in front of port `3000`, terminate TLS there, and set the public domain. Do not expose port `3000` directly to the Internet.

## 6. Azure-ready MySQL TLS configuration

For Azure Database for MySQL Flexible Server, create a dedicated production database and set the application to use verified TLS.

```dotenv
DATABASE_URL=mysql://welfare_pride:REPLACE@your-server.mysql.database.azure.com:3306/welfare_pride
DATABASE_SSL=true
DATABASE_SSL_REJECT_UNAUTHORIZED=true
```

The application and migration runner use the same TLS configuration. Keep certificate verification enabled for production connections.

## 7. Scheduled backup dispatch

The scheduler calls the protected dispatch route every minute and performs only due backup work. For a native VPS, create a root-owned cron entry or equivalent timer:

```cron
* * * * * curl --fail --silent --show-error --max-time 55 -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://intranet.example.org/api/cron/dispatch >/dev/null 2>&1
```

Store the secret in a root-readable file or secret manager rather than writing it directly into shared shell history.

## 8. Operations and updates

Pull updates only after reviewing the release notes and backing up the database. The project context and sanitized worklogs are Git-versioned in [`project-context/`](../project-context/) and [`session-worklogs/`](../session-worklogs/).

```bash
git pull --ff-only
corepack pnpm install --frozen-lockfile
corepack pnpm run build
corepack pnpm run db:migrate
sudo systemctl restart welfare-pride-intranet
```

For Docker, use:

```bash
cd deploy/hostinger
docker compose --env-file ../../.env up -d --build
```

Back up the MySQL database, persistent upload storage, `.env` file held outside source control, and the repository itself. Do not commit database dumps, private documents, credentials, raw session records, or browser logs.

## 9. Release acceptance checks

| Check | Expected result |
| --- | --- |
| Health endpoint | `GET /api/healthz` returns HTTP 200 and `{ "ok": true }`. |
| Bootstrap control | `admin` / `admin` works only on a fresh database when `BOOTSTRAP_DEFAULT_ADMIN=true`. |
| Credential rotation | First login cannot access protected routes until a new strong password is saved. |
| MFA | First login requires TOTP enrollment; later local sign-in requires TOTP or a one-time recovery code. |
| Admin policy | **Integration Settings → Local access** lists local accounts and allows MFA requirement policy changes. |
| Data persistence | Application restarts preserve MySQL data and uploads. |
| Secrets | `.env` is not committed, returned through the browser, or stored in project context/worklogs. |
| Source independence | A source scan finds no managed-platform runtime URL, package, or injected configuration dependency. |

## 10. Support files

| File or folder | Purpose |
| --- | --- |
| `deploy/install.sh` | Single installer entry point for Docker, native Linux, and managed Node modes. |
| `deploy/hostinger/environment.template` | Production environment-variable contract. |
| `docs/credential-rotation-notice.md` | Secret rotation and source-package hygiene requirements. |
| `project-context/` | Rebuild-ready product and architecture context. |
| `session-worklogs/` | Sanitized, versioned implementation decision summaries. |
| `docs/welfare-pride-recreation-master-prompt.md` | Reusable reconstruction prompt and feature inventory. |

## References

[1]: https://learn.microsoft.com/en-us/azure/mysql/flexible-server/connect-nodejs "Azure Database for MySQL Flexible Server: Connect with Node.js"
[2]: https://docs.docker.com/engine/install/ "Docker Engine installation"
[3]: https://nodejs.org/en/download/package-manager "Node.js package-manager installation guidance"
