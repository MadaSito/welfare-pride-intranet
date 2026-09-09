CREATE TABLE `portal_access_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`resourceId` int NOT NULL,
	`requesterUserId` int NOT NULL,
	`note` varchar(500),
	`status` enum('pending','approved','declined') NOT NULL DEFAULT 'pending',
	`reviewedByUserId` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portal_access_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `portal_access_requests` ADD CONSTRAINT `portal_access_requests_resourceId_portal_resources_id_fk` FOREIGN KEY (`resourceId`) REFERENCES `portal_resources`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `portal_access_requests` ADD CONSTRAINT `portal_access_requests_requesterUserId_users_id_fk` FOREIGN KEY (`requesterUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `portal_access_requests` ADD CONSTRAINT `portal_access_requests_reviewedByUserId_users_id_fk` FOREIGN KEY (`reviewedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `portal_access_requests_resource_status_idx` ON `portal_access_requests` (`resourceId`,`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `portal_access_requests_requester_status_idx` ON `portal_access_requests` (`requesterUserId`,`status`,`createdAt`);