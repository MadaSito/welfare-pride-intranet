# Connected-Machine Standalone Acceptance

## Purpose

This sanitized worklog records final acceptance verification of the standalone Welfare Pride intranet on an attached Ubuntu machine. It contains no passwords, tokens, recovery codes, configuration secrets, raw conversation text, or personal data.

## What was validated

The release was installed in an isolated Compose project with loopback-only ports, leaving the host’s existing public Welfare Pride reporting stack unchanged. Docker installation, MySQL migrations, scheduler startup, native root-installer execution, temporary native `systemd` service startup, and native runtime health were all verified.

The fresh-install bootstrap flow created the guarded default administrator account, enforced forced password rotation, rejected protected access while the session was restricted, and rejected the original default password after rotation. TOTP enrollment completed successfully with a locally generated time-based code and yielded a full session. A secure browser test then authenticated locally and opened **Integration Settings → Local access**, where the administrator MFA policy toggle was exercised from optional back to required.

## Evidence summary

The final acceptance run confirmed the health endpoint, Content Security Policy header, absence of framework disclosure header, migration idempotence after restart, and forbidden unauthenticated access to the MFA policy endpoint. All temporary containers, test databases, native service files, test directories, browser artifacts, and locally generated credentials were removed after validation. See `docs/connected-machine-acceptance.md` for the operator-oriented evidence table.

The final local release gate passed 45 automated tests, type checking, production build, migration consistency validation, a production dependency audit with no known vulnerabilities, and a standalone-source scan. The audit remediation upgraded the direct MySQL client and pinned patched query-string and XML parser dependency paths in the workspace configuration.
