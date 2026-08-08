# SAML Implementation Reference Notes

The Welfare Pride SAML service-provider implementation is based on the maintained [`@node-saml/node-saml`](https://github.com/node-saml/node-saml) project and its companion [`@node-saml/passport-saml`](https://www.npmjs.com/package/@node-saml/passport-saml) documentation, reviewed on August 8, 2026.

The official documentation identifies `callbackUrl`, Identity Provider `entryPoint`, Service Provider `issuer`, expected `audience`, and the Identity Provider signing certificate (`idpCert`) as core settings. Incoming SAML assertions must be signature-validated with the IdP public X.509 certificate. SHA-256 is the preferred signing algorithm, assertions should remain time-bound, and `wantAssertionsSigned` and `wantAuthnResponseSigned` default to enabled.

The service provider should validate `InResponseTo` for service-provider-initiated sign-in. The documentation warns that the default in-memory request cache is unsuitable when multiple server instances may process the response. Welfare Pride must therefore use a durable cache provider rather than relying on process memory. Authentication requests normally use HTTP Redirect binding, while SAML responses are expected through HTTP POST binding after the URL-encoded body parser.

Node SAML can generate Service Provider metadata from the issuer and callback URL. That metadata is suitable for registering the Welfare Pride application with Microsoft Entra ID. The external IdP must permit the Welfare Pride assertion consumer service URL and sign assertions or responses with a certificate configured in the portal.
