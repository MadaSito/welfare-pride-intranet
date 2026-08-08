# Welfare Pride Backup Audit and Recovery Controls

Backup and restore **execution state** is stored in the `backup_runs` and `restore_runs` tables. Those records may transition from pending or running to a terminal result so the dashboard can show the current state of an operation.

Every significant transition is also written as a new row in `operation_audit_events`. This table is the append-only audit stream. Application code exposes insert and list helpers only; it does not expose update or delete helpers, and all browser operations pass through administrator-only procedures. The managed TiDB environment does not support the MySQL trigger syntax that was evaluated for an additional database trigger guard, so operational database access must remain restricted to the application service identity and authorized platform administrators.

The audit stream records the entity type and identifier, event type, status, sanitized message, non-secret metadata, actor identifier when available, and database timestamp. Provider credentials, access tokens, refresh tokens, connection strings, and secret values must never be written to audit metadata or messages.

Dry runs perform a real destination write, read, SHA-256 checksum comparison, and cleanup. A backup-manifest run retains a small checksum-verified control-plane artifact so the restore workflow can prove that the destination is readable and the artifact is intact. The portal deliberately does not overwrite SharePoint, OneDrive, or other production source data. Full file recovery requires a separately approved recovery runbook and a worker sized for the source and destination data volume.
