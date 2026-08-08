CREATE TABLE `operation_audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` enum('backup_run','restore_run','backup_destination') NOT NULL,
	`entityId` int NOT NULL,
	`eventType` varchar(80) NOT NULL,
	`status` varchar(40) NOT NULL,
	`message` text NOT NULL,
	`metadataJson` text,
	`actorUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `operation_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `operation_audit_events` ADD CONSTRAINT `operation_audit_events_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `operation_audit_entity_created_idx` ON `operation_audit_events` (`entityType`,`entityId`,`createdAt`);