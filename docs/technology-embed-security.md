# Welfare Pride Technology Embed Security

Technology applications are treated as untrusted third-party content even when they are approved for employee use. The portal accepts only **HTTPS** URLs whose hostname exactly matches the administrator-entered allowlist value. Localhost, private network addresses, link-local addresses, embedded URL credentials, and hostname mismatches are rejected by the server.

## Content Security Policy

The portal sends a `Content-Security-Policy` response header and limits embedded content through its `frame-src` directive. In production, the broad HTTPS compatibility value should be narrowed to the approved Technology application origins. For example, when the approved origins are `https://apps.welfarepride.org` and `https://portal.vendor.example`, the recommended production directive is:

```text
frame-src 'self' https://apps.welfarepride.org https://portal.vendor.example;
```

The complete policy must continue to include the application’s existing directives for scripts, styles, fonts, images, API connections, and frame ancestors. Administrators should update the deployment policy whenever an approved embed hostname is added or removed. Wildcards should be avoided unless a documented vendor requirement has been reviewed and approved.

## Embedded Application Compatibility

The embedded application must permit Welfare Pride to frame it. If the external application sends `X-Frame-Options: DENY`, `X-Frame-Options: SAMEORIGIN`, or a `Content-Security-Policy` `frame-ancestors` directive that excludes the Welfare Pride portal origin, the browser will block the iframe. This is an external application policy decision; the Welfare Pride portal must not bypass it. Employees can use the **Open separately** action when framing is not supported.

## Iframe Sandbox

The portal’s default iframe sandbox permits scripts, forms, popups, and downloads but intentionally omits `allow-same-origin`. This prevents the embedded application from receiving same-origin privileges in the Welfare Pride page. Administrators should not broaden the sandbox without a documented security review. The iframe also uses `referrerPolicy="no-referrer"` and a deliberately small feature `allow` policy.

## Administrative Review Checklist

Before an embed is activated, the administrator should verify ownership of the target application, confirm its exact HTTPS hostname, review its framing headers, determine whether the restrictive sandbox supports its required workflow, add the origin to the production `frame-src` policy, and test the application with a non-administrator employee account.
