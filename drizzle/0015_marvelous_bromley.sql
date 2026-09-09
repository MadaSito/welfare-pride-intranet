CREATE TABLE `security_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`correlationId` varchar(64) NOT NULL,
	`eventType` varchar(120) NOT NULL,
	`severity` enum('info','low','medium','high','critical') NOT NULL,
	`ipAddress` varchar(45),
	`method` varchar(12),
	`requestPath` varchar(240),
	`userAgentHash` varchar(64),
	`actorUserId` int,
	`detailsJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `security_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `security_ip_policies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`mode` enum('allow','block') NOT NULL,
	`ipAddress` varchar(45) NOT NULL,
	`label` varchar(160) NOT NULL,
	`expiresAt` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdByUserId` int,
	`revokedAt` timestamp,
	`revokedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `security_ip_policies_id` PRIMARY KEY(`id`),
	CONSTRAINT `security_ip_policies_mode_ip_unique` UNIQUE(`mode`,`ipAddress`)
);
--> statement-breakpoint
CREATE TABLE `security_settings` (
	`id` int NOT NULL,
	`allowlistEnabled` boolean NOT NULL DEFAULT false,
	`rateLimitRequests` int NOT NULL DEFAULT 120,
	`rateLimitWindowSeconds` int NOT NULL DEFAULT 60,
	`autoBlockThreshold` int NOT NULL DEFAULT 0,
	`autoBlockDurationMinutes` int NOT NULL DEFAULT 30,
	`updatedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `security_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `security_events` ADD CONSTRAINT `se_actor_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `security_ip_policies` ADD CONSTRAINT `sip_created_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `security_ip_policies` ADD CONSTRAINT `sip_revoked_fk` FOREIGN KEY (`revokedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `security_settings` ADD CONSTRAINT `ss_updated_fk` FOREIGN KEY (`updatedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `security_events_corr_created_idx` ON `security_events` (`correlationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `security_events_ip_created_idx` ON `security_events` (`ipAddress`,`createdAt`);--> statement-breakpoint
CREATE INDEX `security_events_severity_created_idx` ON `security_events` (`severity`,`createdAt`);--> statement-breakpoint
CREATE INDEX `security_events_type_created_idx` ON `security_events` (`eventType`,`createdAt`);--> statement-breakpoint
CREATE INDEX `security_ip_policies_active_idx` ON `security_ip_policies` (`isActive`,`mode`,`expiresAt`);
