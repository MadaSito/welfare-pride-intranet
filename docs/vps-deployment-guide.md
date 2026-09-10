# Welfare Pride Intranet — VPS Deployment Guide

## 1. Prepare the host

Provision an Ubuntu 24.04 LTS VPS with at least 2 vCPU, 4 GB RAM, 40 GB SSD, a static public IP, and a DNS `A` record for the intranet hostname. Update the host, install Docker Engine with the Compose plugin, and restrict the firewall to SSH, HTTP, and HTTPS. Keep MySQL private to the Compose network.

## 2. Transfer and configure

Copy the release archive to `/opt/welfare-pride-intranet`, extract it, and create `.env` from `deploy/hostinger/.env.example`. Set long random values for `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `JWT_SECRET`, and `CRON_SECRET`; set `INTRANET_DOMAIN`; and set `BOOTSTRAP_DEFAULT_ADMIN=true` only for the first start. Do not commit `.env`.

## 3. Start and verify

Run `docker compose -f deploy/hostinger/docker-compose.yml --env-file .env up -d --build`, then check `docker compose ps` and `curl -fsS http://127.0.0.1:3000/health`. Put Caddy or Nginx in front of the application for TLS and set `TRUST_PROXY=true` only when the trusted proxy is the direct upstream.

## 4. First administrator

Sign in using the bootstrap credentials only on the initial deployment, change the password, and enroll TOTP MFA. Create non-bootstrap local accounts through the administration screen and configure Microsoft Entra only after saving its application credentials. Disable `BOOTSTRAP_DEFAULT_ADMIN` and restart the stack.

## 5. Operate safely

Back up the MySQL volume and encrypted environment secrets separately, test restoration, patch the host monthly, review Security Center alerts, and keep SharePoint Graph permissions to least privilege. See `docs/standalone-deployment-guide.md` and `docs/azure-docker-vps-deployment-runbook.md` for full troubleshooting and rollback procedures.
