CREATE TABLE `security_escalation_owners` (
	`userId` int NOT NULL,
	`assignedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `security_escalation_owners_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
CREATE TABLE `security_event_read_cursors` (
	`recipientUserId` int NOT NULL,
	`lastReadEventId` int NOT NULL DEFAULT 0,
	`readAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `security_event_read_cursors_recipientUserId` PRIMARY KEY(`recipientUserId`)
);
--> statement-breakpoint
CREATE TABLE `security_incident_cases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`triggerEventId` int NOT NULL,
	`caseReference` varchar(80) NOT NULL,
	`status` enum('acknowledged','resolved') NOT NULL DEFAULT 'acknowledged',
	`ownerUserId` int,
	`acknowledgedByUserId` int NOT NULL,
	`acknowledgedAt` timestamp NOT NULL DEFAULT (now()),
	`resolutionNotes` text,
	`resolvedByUserId` int,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `security_incident_cases_id` PRIMARY KEY(`id`),
	CONSTRAINT `security_incident_case_event_unique` UNIQUE(`triggerEventId`),
	CONSTRAINT `security_incident_case_ref_unique` UNIQUE(`caseReference`)
);
--> statement-breakpoint
ALTER TABLE `security_escalation_owners` ADD CONSTRAINT `seo_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `security_escalation_owners` ADD CONSTRAINT `seo_assigned_fk` FOREIGN KEY (`assignedByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `security_event_read_cursors` ADD CONSTRAINT `serc_recipient_fk` FOREIGN KEY (`recipientUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `security_incident_cases` ADD CONSTRAINT `sic_event_fk` FOREIGN KEY (`triggerEventId`) REFERENCES `security_events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `security_incident_cases` ADD CONSTRAINT `sic_owner_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `security_incident_cases` ADD CONSTRAINT `sic_ack_fk` FOREIGN KEY (`acknowledgedByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `security_incident_cases` ADD CONSTRAINT `sic_resolved_fk` FOREIGN KEY (`resolvedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `security_incident_case_status_idx` ON `security_incident_cases` (`status`,`updatedAt`);