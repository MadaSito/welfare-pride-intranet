# Welfare Pride Intranet — Azure Container Apps Deployment Guide

## 1. Create Azure resources

Create a resource group, Azure Container Registry, Container Apps Environment, Azure Database for MySQL Flexible Server, Storage Account or Azure Files share, Key Vault, and Log Analytics workspace. Keep database networking private where possible.

## 2. Build and publish the image

Sign in to Azure CLI, build the release image in ACR, and grant the Container App managed identity pull access to the registry. Do not bake `.env` or Graph credentials into the image.

## 3. Configure secrets and storage

Store database connection, session secret, scheduler secret, and any required operational secrets in Key Vault or Container App secrets. Mount persistent upload storage where required. Set the intranet hostname, TLS settings, and trusted proxy behavior through runtime configuration.

## 4. Deploy and verify

Create or update the Container App with the ACR image, managed identity, secrets, environment variables, HTTPS ingress, and a health probe. Run database migrations as a controlled release step or Container Apps Job, then verify health, sign-in, forced bootstrap password rotation, and MFA.

## 5. Configure Graph and operate

In the portal, save Microsoft Entra Graph credentials under Integration Settings. Enter the SharePoint site address and use discovery to fill the site and recommended library IDs. Monitor revisions and logs, retain a stable revision for rollback, and use the full Azure procedures in `docs/azure-docker-vps-deployment-runbook.md`.
