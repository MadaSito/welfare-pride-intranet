# Project Context

This folder is the version-controlled reconstruction context for the Welfare Pride intranet. It is intentionally kept at the repository root so that a future operator or development team can understand the product without relying on a development workspace, ephemeral chat history, or proprietary service.

## Contents

| Resource | Purpose |
| --- | --- |
| [`overview.md`](overview.md) | Product scope, design system, architecture, and security boundaries. |
| [`../docs/welfare-pride-recreation-master-prompt.md`](../docs/welfare-pride-recreation-master-prompt.md) | Copy-ready specification for rebuilding the portal. |
| [`../docs/azure-docker-vps-deployment-runbook.md`](../docs/azure-docker-vps-deployment-runbook.md) | Operator runbook for Azure, Docker, and bare-metal VPS deployment. |
| [`../docs/credential-rotation-notice.md`](../docs/credential-rotation-notice.md) | Production credential rotation and source-package hygiene requirements. |
| [`../session-worklogs/`](../session-worklogs/) | Sanitized implementation and release decision records. |

> This context is deliberately sanitized. It contains no passwords, API keys, raw browser transcripts, private documents, database dumps, or runtime session tokens. Those materials must never be committed to Git.
