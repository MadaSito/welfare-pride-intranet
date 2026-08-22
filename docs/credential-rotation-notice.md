# Standalone Release Credential Rotation Notice

## Purpose

The standalone Welfare Pride source package excludes development-environment metadata and injected service configuration. Those files are not part of the portable release, must not be copied to a Docker image or VPS, and are explicitly ignored by Git.

## Required operator action

Before any production deployment, create a fresh environment file from `deploy/hostinger/environment.template`. Generate new production values for `JWT_SECRET`, `CRON_SECRET`, database credentials, storage credentials, Microsoft Entra credentials, and the OpenAI API key. Do not reuse any value from a development workspace or a historical environment file.

| Credential class | Required action |
| --- | --- |
| Application and cron secrets | Generate fresh, high-entropy production secrets. |
| Database account | Create a dedicated least-privilege production account with a new password. |
| Microsoft Entra application | Register a production redirect URI and rotate the client secret before rollout. |
| Storage and backup credentials | Create narrowly scoped production credentials and keep them encrypted in the application settings only after initial local-owner login. |
| OpenAI API key | Create a dedicated project key, enforce spending limits, and restrict use to the server environment. |

> Do not commit `.env`, generated session logs containing personal or credential data, database dumps, or development metadata. The repository should contain only sanitized context and worklog summaries.
