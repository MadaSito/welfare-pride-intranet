# Hostinger LiteSpeed startup correction — 2026-11-24

The operator reported a successful managed Express build followed by HTTP 503. The provided runtime log identified `ERR_REQUIRE_ASYNC_MODULE`: LiteSpeed's Node launcher (`lsnode.js`) synchronously required `dist/hostinger-entry.js`, but that entry's static ESM graph used top-level await.

The prior direct-Node startup smoke test did not cover this loading contract. The corrected runtime wrapper invokes an asynchronous startup function instead of awaiting at module top level. Migration completion remains a prerequisite for dynamically importing the Express server. The existing build command, managed entry filename, and Docker/native deployment behavior are preserved. No database schema or production configuration is changed; saved secrets and Microsoft integration credentials are not accessed or modified.

Regression coverage uses isolated temporary fixtures and the Node 22 CommonJS `require()` path, alongside direct Node execution, migration-before-server ordering, explicit migration skip behavior, and fail-closed migration errors. The deployment guide now documents the actual repository-relative entry field and the LiteSpeed loader requirement.

The connected Hostinger repository shown in the operator's build logs is `readypackets/WelfarePrideIntranet`, which is not accessible through the current authorized GitHub connection. The maintained release repository is `MadaSito/welfare-pride-intranet`. Delivery must distinguish a correction to that repository from a correction to the operator's private deployment copy; it must not claim the Hostinger copy or live service has been updated without evidence.

No raw runtime logs, hosting account identifiers, environment values, passwords, tokens, or SAML credentials are included in this worklog.

## Validation results

Validation completed on Node.js 22.23.4: TypeScript checks passed; all 101 tests across 30 files passed, including 18 launcher-compatibility cases; the production build completed and staged the original managed entry filename. The old wrapper failed the isolated CommonJS fixture with `ERR_REQUIRE_ASYNC_MODULE`, while the corrected wrapper passed. A finite smoke test loaded the actual built Express application through CommonJS `require()` and received HTTP 200 from both the health endpoint and frontend HTML. That local smoke test used no production database and explicitly skipped migrations only in its temporary test environment; fixture tests verified migration ordering and fail-closed behavior. Temporary test processes and fixtures were cleaned up. Hostinger's live service has not been changed or verified as repaired by these local checks.
