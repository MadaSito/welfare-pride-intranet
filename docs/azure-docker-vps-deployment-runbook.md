# Welfare Pride Intranet — Azure, Docker, and VPS Deployment Runbook

## Purpose and deployment choice

This runbook deploys the **standalone Welfare Pride intranet** outside any development or preview environment. It supports three production paths: Azure Container Apps for a managed container platform, Docker Compose for a self-managed server, and a native Node.js service on a Linux VPS.

| Path | Best fit | Operational responsibility | Recommended for 25 users |
| --- | --- | --- | --- |
| Azure Container Apps | Managed Azure deployment with independent scaling, managed ingress, and Azure services | Azure subscription, managed database, storage, secrets, and monitoring | **Preferred Azure path** |
| Docker Compose on VPS | Single-server deployment with bundled MySQL, Caddy TLS, scheduler, and uploads volume | OS patching, backups, firewall, uptime, and Docker updates | Strong low-complexity option |
| Native Node.js on VPS | Existing Node.js and MySQL operations standards | OS, Node.js, systemd, reverse proxy, database, and scheduler | Use only when Docker is not permitted |

> **Important bootstrap condition.** The first local owner account is intentionally tokenless. Create it immediately after the first deployment and **before sharing the intranet URL**. The first successful owner submission closes the setup path permanently at the database layer.

## Repository and portability status

The source repository has a configured `user_github` remote. At the deployment audit, local `main` and GitHub `main` both pointed to commit `6f9178efb921a282b1fcc9ae0ea8cab286b25346`; the repository is synchronized at that point. This runbook and Azure TLS support are delivered in a later commit, so use the latest GitHub `main` after the accompanying release checkpoint is saved.

The application source and runtime package are standalone. Active server, client, shared, deployment, script, package, and build files were scanned for proprietary managed-platform identifiers, URLs, storage paths, and environment variables; none were found. The application requires only standard Node.js, MySQL, object or file storage, a scheduler, and optional Microsoft and AI providers that Welfare Pride configures.

## 1. Preflight checklist

Install the following tools on the deployment workstation. Azure Container Registry builds can run in Azure, but Docker remains useful for local image validation and the VPS path.

| Requirement | Azure Container Apps | Docker/VPS |
| --- | --- | --- |
| Source checkout | Git and GitHub access | Git and GitHub access |
| Runtime | Azure CLI with current `containerapp` extension | Docker Engine and Compose v2, or Node.js 22 with Corepack |
| Database | Azure Database for MySQL – Flexible Server | MySQL 8.4 or the bundled Compose database |
| Persistent uploads | Azure Files volume or S3-compatible object storage | Named Docker volume, Azure Files/NFS mount, or S3-compatible object storage |
| DNS/TLS | Azure Container Apps ingress and custom domain | DNS plus Caddy in Docker mode, or Nginx/Caddy in native mode |

The portal listens on port `3000` inside the container and exposes a no-auth health endpoint at `/api/healthz`. Do not expose port `3000` directly to the internet when a reverse proxy or Azure ingress terminates TLS.

## 2. Shared production configuration

Start from `deploy/hostinger/environment.template`. Do not commit `.env`, database URLs, API keys, or integration credentials. Use a password manager, Azure Key Vault, or your server’s secret store.

| Variable | Required | Azure production value |
| --- | --- | --- |
| `NODE_ENV` | Yes | `production` |
| `PORT` | Yes | `3000` |
| `DATABASE_URL` | Yes | MySQL connection URL for the Welfare Pride database |
| `DATABASE_SSL` | Azure MySQL | `true` |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | Azure MySQL | `true` |
| `DATABASE_CONNECTION_LIMIT` | Recommended | `4` for the initial 25-user profile |
| `JWT_SECRET` | Yes | A unique random secret of at least 32 bytes |
| `CRON_SECRET` | If backup schedules are enabled | A different random secret |
| `STORAGE_DRIVER` | Yes | `local` with an Azure Files mount, or `s3` with compatible object storage |
| `LOCAL_STORAGE_PATH` | When `local` | `/mnt/welfare-pride-uploads` on Azure; `/app/data/uploads` in bundled Docker Compose |
| `RUN_MIGRATIONS_ON_START` | Yes | `false` for multi-replica Azure deployments; run migrations as a one-off job |
| `AI_*` | Optional | Configure only if using the assistant; the admin interface can also store encrypted provider settings |

Azure Database for MySQL supports TLS connections and Microsoft’s Node.js guidance uses the server’s fully qualified name with TLS configuration.[1] This release adds `DATABASE_SSL=true` and verified certificate handling for both the application runtime and `scripts/migrate.mjs`. Keep `DATABASE_SSL_REJECT_UNAUTHORIZED=true` in production.

## 3. Azure Container Apps deployment

### 3.1 Create the resource group and Container Apps environment

Sign in and install the current Azure Container Apps extension. Azure requires the `Microsoft.App` and `Microsoft.OperationalInsights` resource providers for a Container Apps environment.[2]

```bash
az login
az extension add --name containerapp --upgrade
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights

export AZ_SUBSCRIPTION="<subscription-id>"
export AZ_RG="welfare-pride-prod-rg"
export AZ_LOCATION="eastus"
export ACA_ENV="welfare-pride-prod"
export ACA_APP="welfare-pride-intranet"
az account set --subscription "$AZ_SUBSCRIPTION"

az group create --name "$AZ_RG" --location "$AZ_LOCATION"
az containerapp env create \
  --name "$ACA_ENV" \
  --resource-group "$AZ_RG" \
  --location "$AZ_LOCATION"
```

Container Apps provides HTTP ingress, TLS termination, an application FQDN, HTTP/1.1 and HTTP/2 without requiring a separate load balancer or public IP resource.[3]

### 3.2 Create an Azure Container Registry and build the image

Use a lowercase, globally unique registry name. Azure Container Registry’s Standard tier is adequate for most standard image workflows, and its documentation recommends retaining the actual `loginServer` output because protected DNS labels can add a suffix.[4]

```bash
export ACR_NAME="<globally-unique-lowercase-registry-name>"
export IMAGE_TAG="$(git rev-parse --short HEAD)"

az acr create \
  --resource-group "$AZ_RG" \
  --name "$ACR_NAME" \
  --sku Standard \
  --role-assignment-mode rbac-abac \
  --dnl-scope TenantReuse

export ACR_LOGIN_SERVER="$(az acr show --resource-group "$AZ_RG" --name "$ACR_NAME" --query loginServer --output tsv)"

# Build in Azure Container Registry; no local Docker daemon is required for this option.
az acr build \
  --registry "$ACR_NAME" \
  --image "welfare-pride:${IMAGE_TAG}" \
  --file deploy/hostinger/Dockerfile \
  .
```

### 3.3 Configure private image pull with a user-assigned managed identity

Use a user-assigned identity rather than registry administrator credentials. Azure documents managed identity image pulls as the way to avoid administrative registry credentials and recommends user-assigned identities where practical.[5]

```bash
export IDENTITY_NAME="welfare-pride-acr-pull"
az identity create --resource-group "$AZ_RG" --name "$IDENTITY_NAME"

export IDENTITY_ID="$(az identity show --resource-group "$AZ_RG" --name "$IDENTITY_NAME" --query id --output tsv)"
export IDENTITY_PRINCIPAL_ID="$(az identity show --resource-group "$AZ_RG" --name "$IDENTITY_NAME" --query principalId --output tsv)"
export ACR_ID="$(az acr show --resource-group "$AZ_RG" --name "$ACR_NAME" --query id --output tsv)"

# Use AcrPull for a non-ABAC registry, or Container Registry Repository Reader for an ABAC-enabled registry.
az role assignment create \
  --assignee "$IDENTITY_PRINCIPAL_ID" \
  --scope "$ACR_ID" \
  --role "Container Registry Repository Reader"

az acr config authentication-as-arm update --registry "$ACR_NAME" --status enabled
```

### 3.4 Provision Azure Database for MySQL

In the Azure portal, create **Azure Database for MySQL – Flexible Server** in the same region. Create a dedicated `welfare_pride` database and a least-privilege database user. Use private networking where the organization already has an Azure virtual network; otherwise, permit only the minimum required client and Container Apps network access during initial setup, then tighten firewall rules.

Set the production database URL in a secure shell session only:

```bash
export DATABASE_URL='mysql://<user>:<url-encoded-password>@<server>.mysql.database.azure.com:3306/welfare_pride'
export JWT_SECRET="$(openssl rand -hex 32)"
export CRON_SECRET="$(openssl rand -hex 32)"
```

### 3.5 Configure persistent portal uploads

The portal’s current file adapter supports `local` and S3-compatible storage. It does **not** treat Azure Blob Storage as an S3 endpoint. For Azure Container Apps, use an **Azure Files** mount with `STORAGE_DRIVER=local`; Azure documents Azure Files mounts as persistent and accessible across replicas, revisions, and container apps.[6]

Create a classic Azure file share in an Azure Storage account, then add it to the Container Apps environment under **Settings → Storage mounts**. Create a new app revision and mount that share at `/mnt/welfare-pride-uploads`. Configure the following application values:

```text
STORAGE_DRIVER=local
LOCAL_STORAGE_PATH=/mnt/welfare-pride-uploads
```

Do not use ephemeral container storage for profile or company uploads: it is removed when a container shuts down or restarts.[6]

### 3.6 Create a manual migration job

For Azure deployments with more than one replica, do not let every replica apply migrations during startup. Create a **manual Container Apps Job** using the same image, override its command to `node scripts/migrate.mjs`, and set `RUN_MIGRATIONS_ON_START=false` for the web app. Container Apps Jobs are designed for finite on-demand tasks, including migration-like work.[7]

Create the job in the portal or with the following template command. Add the same `DATABASE_URL` secret used by the web app:

```bash
az containerapp job create \
  --name welfare-pride-migrate \
  --resource-group "$AZ_RG" \
  --environment "$ACA_ENV" \
  --trigger-type Manual \
  --image "${ACR_LOGIN_SERVER}/welfare-pride:${IMAGE_TAG}" \
  --registry-server "$ACR_LOGIN_SERVER" \
  --registry-identity "$IDENTITY_ID" \
  --user-assigned "$IDENTITY_ID" \
  --cpu 0.5 --memory 1.0Gi \
  --replica-timeout 900 --replica-retry-limit 0 \
  --command node scripts/migrate.mjs \
  --secrets "database-url=$DATABASE_URL" \
  --env-vars DATABASE_URL=secretref:database-url DATABASE_SSL=true DATABASE_SSL_REJECT_UNAUTHORIZED=true DATABASE_CONNECTION_LIMIT=1

az containerapp job start \
  --name welfare-pride-migrate \
  --resource-group "$AZ_RG"

az containerapp job execution list \
  --name welfare-pride-migrate \
  --resource-group "$AZ_RG" \
  --output table
```

Run this job once before the initial application release and again before each release containing new Drizzle migrations. Verify that the execution succeeds before changing application traffic.

### 3.7 Create the web application

Container Apps secrets can be referenced by revision environment variables. For production, Azure recommends storing secret values in Key Vault and referencing them through a managed identity rather than supplying literal values directly.[8]

The commands below use application-level secrets for clarity. Replace them with Key Vault references before final production cutover.

```bash
az containerapp create \
  --name "$ACA_APP" \
  --resource-group "$AZ_RG" \
  --environment "$ACA_ENV" \
  --image "${ACR_LOGIN_SERVER}/welfare-pride:${IMAGE_TAG}" \
  --registry-server "$ACR_LOGIN_SERVER" \
  --registry-identity "$IDENTITY_ID" \
  --user-assigned "$IDENTITY_ID" \
  --target-port 3000 \
  --ingress external \
  --transport auto \
  --cpu 0.5 --memory 1.0Gi \
  --min-replicas 1 --max-replicas 2 \
  --secrets "database-url=$DATABASE_URL" "jwt-secret=$JWT_SECRET" "cron-secret=$CRON_SECRET" \
  --env-vars \
    NODE_ENV=production \
    PORT=3000 \
    RUN_MIGRATIONS_ON_START=false \
    DATABASE_URL=secretref:database-url \
    DATABASE_SSL=true \
    DATABASE_SSL_REJECT_UNAUTHORIZED=true \
    DATABASE_CONNECTION_LIMIT=4 \
    JWT_SECRET=secretref:jwt-secret \
    CRON_SECRET=secretref:cron-secret \
    STORAGE_DRIVER=local \
    LOCAL_STORAGE_PATH=/mnt/welfare-pride-uploads

az containerapp show \
  --name "$ACA_APP" \
  --resource-group "$AZ_RG" \
  --query properties.configuration.ingress.fqdn \
  --output tsv
```

After creation, add the Azure Files volume mount in the portal, create a revision, and verify `https://<generated-fqdn>/api/healthz` returns success. Keep at least one replica running for the intranet so staff do not experience cold-start sign-in delays; Container Apps otherwise can scale to zero when idle.[9]

### 3.8 Configure the custom domain and backup dispatcher

For `intranet.yourdomain.com`, retrieve the Container App FQDN and custom-domain verification ID. Create the required CNAME and TXT record at the DNS provider, then bind the domain and a certificate in **Container App → Custom domains**. Azure’s custom-domain guidance uses CNAME for subdomains and a TXT record for domain validation.[10]

For scheduled backup dispatch, create a **scheduled Container Apps Job** once per minute in UTC. Use a small curl image with the `CRON_SECRET` stored as a job secret and call:

```text
POST https://intranet.yourdomain.com/api/cron/dispatch
Authorization: Bearer <CRON_SECRET>
```

Container Apps Jobs support scheduled UTC cron expressions with five fields; `* * * * *` runs once per minute.[7] Do not expose the cron secret in source control, command history, or browser code.

### 3.9 First login and Azure acceptance checks

1. Open `https://intranet.yourdomain.com` after DNS and TLS are active.
2. Complete **Create the owner account** immediately with a Welfare Pride administrator’s name, email, and strong password.
3. Sign out and sign back in locally to confirm the owner login works and the setup form is no longer available.
4. Open **Administration → Integration Settings** and configure Microsoft Entra, Microsoft Graph, SharePoint, storage destinations, and optional AI settings.
5. Test a standard employee and an administrator account, SharePoint-authorized document search, a backup dry run, and the authenticated schedule dispatch.

## 4. Standalone Docker deployment

### 4.1 Full self-contained Docker Compose stack

This is the simplest reproducible server deployment. It runs the Node.js application, MySQL 8.4, a scheduler, and Caddy TLS. It is suitable for one VPS and does not require Azure.

```bash
git clone https://github.com/<your-organization>/welfare-pride-intranet.git welfare-pride-intranet
cd welfare-pride-intranet

# Do not pre-create .env: the installer creates restricted permissions and random secrets.
chmod +x deploy/hostinger/install.sh
sudo bash deploy/hostinger/install.sh --mode docker --domain intranet.yourdomain.com

cd deploy/hostinger
docker compose --env-file ../../.env ps
curl -fsS https://intranet.yourdomain.com/api/healthz
```

Before running the installer, point the subdomain’s A/AAAA record to the VPS and allow inbound TCP ports `80` and `443`. The installer creates `.env` with mode `600`, builds the image, applies migrations, starts Caddy TLS, and starts the scheduler. The first owner account must still be created immediately after the site becomes reachable.

### 4.2 Application-only container with external MySQL

Use this mode if a managed MySQL service is already available. Set `RUN_MIGRATIONS_ON_START=true` only for a one-instance initial deployment; for later releases, run `node scripts/migrate.mjs` as a one-off task before scaling web replicas.

```bash
cp deploy/hostinger/environment.template .env
chmod 600 .env
# Edit DATABASE_URL, JWT_SECRET, CRON_SECRET, storage settings, and the public domain values.

docker build -f deploy/hostinger/Dockerfile -t welfare-pride-intranet:latest .
docker run -d \
  --name welfare-pride-intranet \
  --restart unless-stopped \
  --env-file .env \
  -p 127.0.0.1:3000:3000 \
  -v welfare-pride-uploads:/app/data/uploads \
  welfare-pride-intranet:latest

curl -fsS http://127.0.0.1:3000/api/healthz
```

Put Nginx, Caddy, Traefik, Azure Application Gateway, or another TLS reverse proxy in front of the bound loopback port. Never publish database credentials or an unencrypted MySQL port to the public internet.

## 5. Linux VPS deployment

### 5.1 Baseline operating-system preparation

Use Ubuntu 24.04 LTS or another supported Linux distribution. Create a non-root deployment user, require SSH keys, apply operating-system updates, and expose only SSH, HTTP, and HTTPS. Restrict SSH to named administrator IP ranges where possible.

```bash
sudo apt update && sudo apt -y upgrade
sudo apt install -y ca-certificates curl git ufw
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

For Docker mode, install Docker Engine and Docker Compose v2 from Docker’s current official repository, then use the full Compose stack in Section 4.1. This is the recommended VPS path because the project already includes health checks, Caddy TLS, volumes, database service, and a scheduler.

### 5.2 Native Node.js service option

Use native mode only where Docker is prohibited. Install Node.js 22, Corepack, MySQL 8.4, and a TLS reverse proxy. Set `DATABASE_URL`, `JWT_SECRET`, `CRON_SECRET`, and storage configuration in a root-readable `.env` file with mode `600`.

```bash
git clone https://github.com/<your-organization>/welfare-pride-intranet.git welfare-pride-intranet
cd welfare-pride-intranet
cp deploy/hostinger/environment.template .env
chmod 600 .env
# Edit .env with the production database, secrets, and storage settings.

chmod +x deploy/hostinger/install.sh
sudo bash deploy/hostinger/install.sh --mode native --service-user welfarepride

sudo systemctl status welfare-pride-intranet
curl -fsS http://127.0.0.1:3000/api/healthz
```

Configure Caddy or Nginx to reverse proxy `https://intranet.yourdomain.com` to `http://127.0.0.1:3000`, preserve `X-Forwarded-Proto`, and enable HTTPS. The application already uses secure cookie behavior behind a trusted proxy.

## 6. Capacity guidance for approximately 25 users

The following sizing assumes approximately 25 named employees, 5–10 concurrent active users, normal intranet browsing, SharePoint document metadata search, occasional uploads, and small backup control-plane manifests. It does **not** assume concurrent full-scale bulk backup or restore work.

| Component | Starting specification | When to increase |
| --- | --- | --- |
| Azure Container App | **0.5 vCPU, 1 GiB RAM, min 1 / max 2 replicas** | Move to 1 vCPU and 2 GiB if AI extraction, large document previews, or memory pressure appears; allow 2–3 replicas for high login or announcement traffic |
| Azure Container Apps migration/backup job | **1 vCPU, 2 GiB RAM, one replica** | Increase only after measuring real backup file counts, document sizes, and provider throughput |
| Azure Database for MySQL | **2 vCores, 4 GiB memory** as a conservative production baseline | Increase for sustained high query latency, large profile/document metadata, or backup audit growth |
| Azure Files uploads share | **20 GiB initial quota** | Increase based on profile-image and company-upload retention; use lifecycle and backup policy |
| Docker/VPS with bundled MySQL | **2 vCPU, 4 GiB RAM, 60 GiB SSD/NVMe** | Use 4 vCPU, 8 GiB RAM, and 100+ GiB SSD if database, backups, and user uploads all run locally |
| Network | Stable public IPv4/IPv6, TLS, and at least 1 TB monthly transfer | Increase for frequent large HR downloads or cloud restore operations |

Treat these as a starting point, not a capacity guarantee. Monitor application memory, MySQL connection utilization, database latency, Azure Files latency, container restarts, and backup duration for the first 30 days. The main application traffic is modest at this scale; external SharePoint operations and real multi-cloud backup data volume are the likely sizing drivers.

## 7. Release and rollback procedure

1. Commit and push changes to GitHub `main`.
2. Build a versioned image tag from the Git commit with `az acr build` or `docker build` and push it to the registry.
3. Run the manual migration job and verify its execution history.
4. Create a new Container Apps revision with the new immutable image tag. Keep the previous revision active until health and representative user tests pass.
5. Verify `/api/healthz`, local administrator login, an Entra pilot user, SharePoint-authorized HR search, and an administrator-only action.
6. Roll back traffic or image revision if the new revision fails. Do not roll back the database schema without a reviewed recovery plan.

## References

[1]: https://learn.microsoft.com/en-us/azure/mysql/flexible-server/connect-nodejs "Quickstart: Connect using Node.js to Azure Database for MySQL – Flexible Server"

[2]: https://learn.microsoft.com/en-us/azure/container-apps/tutorial-deploy-first-app-cli "Tutorial: Deploy your first container app using Azure CLI"

[3]: https://learn.microsoft.com/en-us/azure/container-apps/ingress-overview "Ingress in Azure Container Apps"

[4]: https://learn.microsoft.com/en-us/azure/container-registry/container-registry-get-started-azure-cli "Quickstart: Create an Azure container registry using the Azure CLI"

[5]: https://learn.microsoft.com/en-us/azure/container-apps/managed-identity-image-pull "Azure Container Apps image pull with managed identity"

[6]: https://learn.microsoft.com/en-us/azure/container-apps/storage-mounts "Use storage mounts in Azure Container Apps"

[7]: https://learn.microsoft.com/en-us/azure/container-apps/jobs "Jobs in Azure Container Apps"

[8]: https://learn.microsoft.com/en-us/azure/container-apps/manage-secrets "Manage secrets in Azure Container Apps"

[9]: https://learn.microsoft.com/en-us/azure/container-apps/scale-app "Set scaling rules in Azure Container Apps"

[10]: https://learn.microsoft.com/en-us/azure/container-apps/custom-domains-certificates "Custom domain names and certificates in Azure Container Apps"
