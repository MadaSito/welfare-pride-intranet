# Welfare Pride Intranet Defensive Security Review

**Review date:** 2026-09-08  
**Scope:** Application source, access-control change set, runtime headers, authentication, storage, Microsoft integrations, automated tests, container deployment assets, and isolated Docker/native acceptance deployments.  
**Method:** Source review, production dependency audit, TypeScript compilation, migration validation, regression testing, standalone source scan, and loopback-only acceptance checks.

## Executive summary

The review found no known production dependency vulnerabilities in the final audited package and no remaining managed-platform runtime references in active standalone source. The access-control implementation now prevents client-side navigation filtering from being treated as an authorization boundary. **51 automated tests** passed after the access-control additions, and isolated Docker acceptance verified bootstrap restriction, credential rotation, local TOTP MFA, direct-user authorization, fresh Entra-group access simulation, stale-group denial, hidden navigation, and direct API denial.

The review identified and remediated concrete weaknesses in group-entitlement freshness, custom resource creation, request parsing, proxy trust, CSP outbound connections, and a residual obsolete map component. Several operational safeguards remain dependent on production configuration and must be completed by the deployment administrator.

## Remediated findings

| ID | Finding | Risk before remediation | Remediation verified |
| --- | --- | --- | --- |
| AC-01 | Sidebar visibility alone could be bypassed by direct procedure calls. | A hidden module could have returned data to an authenticated but unauthorized employee. | Added `portalResourceProcedure` or explicit server authorization to Business Management, custom pages, people, organization, HR, Technology, calendars, company content, and unified search sources. |
| AC-02 | A cached Entra membership could remain usable after removal from a group. | Stale group membership could have prolonged access. | Group memberships now expire for authorization after 24 hours, and OIDC or SAML absence/failure clears the snapshot. Fresh membership allows access; a 25-hour-old temporary membership was denied in isolated acceptance. |
| AC-03 | Administrators could create arbitrary `module` resource records through the generic API. | Malformed resources could confuse navigation and policy handling. | New records are limited to custom pages; system modules are application-provisioned only. Regression-tested. |
| HTTP-01 | Global JSON and URL-encoded request parsers allowed 50 MB bodies. | Unauthenticated oversized bodies could increase memory-pressure and denial-of-service risk. | Defaults reduced to 6 MB JSON and 2 MB URL-encoded input, configurable through explicit environment settings. Route-specific file validation remains required. |
| HTTP-02 | Reverse-proxy trust was unconditional. | Direct deployments could misinterpret forwarded headers and protocol state. | Proxy trust now requires `TRUST_PROXY=true`; the deployment template enables it only for a controlled reverse proxy. |
| HTTP-03 | Browser `connect-src` allowed arbitrary HTTPS and WebSocket destinations. | A compromised frontend dependency had broader outbound-browser reach than necessary. | CSP now limits connections to the same origin. Added Permissions Policy, Cross-Origin Opener Policy, Cross-Origin Resource Policy, and optional production HSTS. |
| DEP-01 | An unused legacy map component retained obsolete proprietary environment variables. | A standalone-source scan would fail and the source could invite unsupported runtime assumptions. | Removed the unused component and repeated the standalone scan successfully. |

## Remaining operational recommendations

| Priority | Recommendation | Rationale and owner action |
| --- | --- | --- |
| High | Disable `BOOTSTRAP_DEFAULT_ADMIN` immediately after the first successful password-change and MFA enrollment. | The temporary `admin/admin` account is intentionally constrained and forced to rotate, but production should not retain a bootstrap switch. Verify this in the environment file and restart. |
| High | Place the portal behind HTTPS on a controlled reverse proxy and set `TRUST_PROXY=true` and `ENABLE_HSTS=true` only after the final hostname is working. | Secure cookies and HSTS depend on accurate scheme handling. Do not enable HSTS for a hostname still in testing. |
| High | Use a dedicated database account, enable verified TLS for managed MySQL, and restrict database network access to the portal runtime. | The application supports `DATABASE_SSL=true` and rejects invalid MySQL URLs under TLS mode. |
| High | Grant only required Entra permissions and require tenant administrator consent for `GroupMember.Read.All`. | Group membership is used to authorize content. Avoid broader directory read permissions unless a feature needs them. |
| High | Keep Entra group assignments on immutable object IDs and review sensitive group mappings quarterly. | Display names can change; object IDs are the authorization input. |
| Medium | Add edge or reverse-proxy request rate limits for login, MFA verification, and large upload endpoints. | Application account lockout reduces password guessing, but proxy-level controls reduce upstream resource consumption. |
| Medium | Send application audit records, authentication events, and reverse-proxy logs to a protected centralized log service with a defined retention policy. | Repository worklogs are sanitized implementation history, not a security-event retention system. |
| Medium | Establish backup recovery exercises and a change-management process for custom page publication and group assignment changes. | Backup success and authorization configuration should be tested operationally, not assumed from configuration. |
| Low | Consider shortening the 24-hour group-snapshot freshness period for highly sensitive material. | A shorter window reduces entitlement-removal latency at the cost of more Microsoft Graph calls and stronger availability dependency. |

> This review is an engineering assessment, not a penetration-test certification or a substitute for organizational security review, production monitoring, threat modeling, or compliance validation.

## Validation evidence

| Check | Result |
| --- | --- |
| Unit and regression suite | 51 tests passed. |
| TypeScript check | Passed. |
| Production application build | Passed. |
| Production dependency audit | No known vulnerabilities reported. |
| Drizzle migration consistency | Passed. |
| Standalone source scan | No active managed-platform runtime identifiers found after obsolete map removal. |
| Isolated Docker acceptance | Passed: bootstrap restriction, forced password rotation, TOTP MFA, direct-user access, fresh group access, stale group denial, navigation filtering, direct API denial, and cleanup. |
| Native runtime acceptance | Previously passed with bootstrap rotation and TOTP MFA; access-control-specific runtime verification was completed in the isolated Docker stack. |

## References

[1] [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)

[2] [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)

[3] [Microsoft Graph: List a user’s direct memberships](https://learn.microsoft.com/en-us/graph/api/user-list-memberof?view=graph-rest-1.0)
