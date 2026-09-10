# Welfare Pride Intranet — Azure Virtual Machine Deployment Guide

## 1. Create the Azure foundation

Create a resource group, a current Ubuntu LTS virtual machine, a static public IP, and a DNS record. Use a network security group that permits only necessary SSH administration and HTTPS ingress. Prefer Azure Database for MySQL Flexible Server for managed database backups and TLS.

## 2. Prepare the VM

Install Docker Engine and Compose, clone or upload the intranet release under `/opt`, and set `.env` with a TLS MySQL connection string, long random application secrets, the public hostname, and `TRUST_PROXY=true` only behind the configured reverse proxy.

## 3. Deploy

Start the Compose stack with the production compose file. Use Caddy or Nginx with an Azure-managed certificate or ACME certificate for HTTPS. Verify the application health check locally and through the hostname, then create the bootstrap administrator, rotate its password, and complete MFA.

## 4. Configure Microsoft 365

Create an Entra application registration, grant the minimum required Graph permissions and administrator consent, then save tenant ID, client ID, and client secret in Integration Settings. Use the SharePoint site discovery action and review prefilled IDs before saving.

## 5. Maintain

Enable Azure Backup for the VM and managed database, send platform logs to Log Analytics, patch the operating system, and test a restoration. Refer to `docs/azure-docker-vps-deployment-runbook.md` for Azure SQL/MySQL TLS, Key Vault, and rollback details.
