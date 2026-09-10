# Microsoft Graph Mail Reference

The Email Center’s Graph Mail adapter follows Microsoft’s official `sendMail` documentation: [user: sendMail](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0). The application uses `POST /users/{id | userPrincipalName}/sendMail` with a JSON message object, recipient collections, optional BCC recipients, and `saveToSentItems` enabled.

The documented least-privilege application permission is **Mail.Send**. The Microsoft Graph permission reference states that applications should request only the permissions required for their operation: [Microsoft Graph permissions reference](https://learn.microsoft.com/en-us/graph/permissions-reference).

Microsoft documents that a `202 Accepted` response indicates the message request was accepted, not that mailbox delivery has completed. The portal therefore records Graph acceptance as `sent` in its delivery log and retains provider responses for later investigation rather than claiming guaranteed recipient delivery.
