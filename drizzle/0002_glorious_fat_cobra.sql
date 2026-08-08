CREATE TABLE `microsoft_oauth_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`encryptedTokenSet` text NOT NULL,
	`scopes` text,
	`accessTokenExpiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `microsoft_oauth_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `microsoft_oauth_sessions_user_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `microsoft_oauth_sessions` ADD CONSTRAINT `microsoft_oauth_sessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;