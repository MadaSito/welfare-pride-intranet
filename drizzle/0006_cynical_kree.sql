CREATE TABLE `app_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`revokedAt` timestamp,
	`userAgentHash` varchar(64),
	`ipHash` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `app_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `app_sessions_token_hash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `local_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(256) NOT NULL,
	`passwordSalt` varchar(128) NOT NULL,
	`failedAttempts` int NOT NULL DEFAULT 0,
	`lockedUntil` timestamp,
	`totpSecretEncrypted` text,
	`recoveryCodesEncrypted` text,
	`mfaEnabled` boolean NOT NULL DEFAULT false,
	`passwordChangedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `local_credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `local_credentials_user_unique` UNIQUE(`userId`),
	CONSTRAINT `local_credentials_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `app_sessions` ADD CONSTRAINT `app_sessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `local_credentials` ADD CONSTRAINT `local_credentials_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `app_sessions_user_expiry_idx` ON `app_sessions` (`userId`,`expiresAt`);