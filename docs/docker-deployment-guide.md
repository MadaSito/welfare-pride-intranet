# Welfare Pride Intranet — Docker Deployment Guide

## 1. Install prerequisites

Install Docker Engine 24+ and Docker Compose v2 on a supported Linux host. Clone or extract the project, then copy `deploy/hostinger/.env.example` to `.env`.

## 2. Configure secrets and domain

Set `INTRANET_DOMAIN`, generate unique database and application secrets, select persistent host paths or named volumes, and keep the `.env` file readable only by the deployment account. Do not place Graph client secrets in frontend code; enter them through the administrator Integration Settings screen after first login.

## 3. Build and run

Run `docker compose -f deploy/hostinger/docker-compose.yml --env-file .env up -d --build`. Confirm migration completion with `docker compose logs app`, check `docker compose ps`, and call the health endpoint from the host. Bind the app behind a TLS reverse proxy; do not expose MySQL.

## 4. Complete configuration

Rotate the bootstrap administrator password, enroll MFA, then turn off bootstrap creation. Configure Graph with tenant ID, client ID, and client secret; enter the SharePoint HTTPS site address and use **Discover site and libraries** to prefill Graph identifiers before saving.

## 5. Update and recover

Back up the database before updates. Pull or extract the new release, run `docker compose up -d --build`, review migrations and health checks, and retain the preceding image until acceptance is complete. The complete operational guide is in `docs/standalone-deployment-guide.md`.
