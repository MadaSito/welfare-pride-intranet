# Operations Enhancement Worklog

The portal now shows the System Audit Center in the Administration sidebar for administrators and in a Management sidebar group for authorized Intranet Portal Managers. Integration Settings provides a credential-free production readiness panel linking to email, roles, backups, and audit controls.

The Email Center accepts a dedicated `birthday_congratulation` template type with `{{firstName}}` and `{{displayName}}` tokens. The standalone authenticated cron dispatcher performs a UTC-configurable daily check, records a per-template/profile/year delivery key, and logs successful, failed, or unconfigured Graph Mail outcomes. A new migration widened the template event enum and added the unique delivery key.

The System Audit Center now returns a bounded 30-day live aggregation for common administrative actions and configuration changes. The responsive Recharts dashboard offers tooltips and action buttons that apply event-type filters to the retained timeline.

Automated coverage validates birthday-template idempotency and audit aggregation. An isolated loopback-only fresh Docker deployment applied all migrations, completed disposable administrator MFA enrollment, created an opt-in birthday profile and active birthday template, verified chart data, invoked the guarded scheduler twice, and confirmed one retained birthday delivery with corresponding audit records. Graph Mail remained unconfigured, so no external email was sent. Temporary containers, credentials, volumes, scripts, archives, and ports were removed after validation.
