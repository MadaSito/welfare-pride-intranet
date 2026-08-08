CREATE TABLE `saml_request_correlations` (
	`requestId` varchar(160) NOT NULL,
	`requestValue` text NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `saml_request_correlations_requestId` PRIMARY KEY(`requestId`)
);
