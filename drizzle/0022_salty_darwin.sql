CREATE TABLE `email_deliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`templateId` int,
	`eventType` varchar(80) NOT NULL,
	`subject` varchar(500) NOT NULL,
	`bodyText` text NOT NULL,
	`recipientsJson` text NOT NULL,
	`bccEmail` varchar(320),
	`status` enum('queued','sent','failed','unconfigured') NOT NULL DEFAULT 'queued',
	`providerMessage` text,
	`triggeredByUserId` int,
	`sourceDeliveryId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`sentAt` timestamp,
	CONSTRAINT `email_deliveries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`eventType` enum('announcement_published','event_published','manual') NOT NULL,
	`subjectTemplate` varchar(500) NOT NULL,
	`bodyTemplate` text NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_templates_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
ALTER TABLE `operation_audit_events` MODIFY COLUMN `entityType` varchar(80) NOT NULL;--> statement-breakpoint
ALTER TABLE `email_deliveries` ADD CONSTRAINT `ed_template_fk` FOREIGN KEY (`templateId`) REFERENCES `email_templates`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `email_deliveries` ADD CONSTRAINT `ed_trigger_fk` FOREIGN KEY (`triggeredByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `email_deliveries` ADD CONSTRAINT `ed_source_fk` FOREIGN KEY (`sourceDeliveryId`) REFERENCES `email_deliveries`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `email_templates` ADD CONSTRAINT `et_creator_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `email_deliveries_created_idx` ON `email_deliveries` (`createdAt`);--> statement-breakpoint
CREATE INDEX `email_deliveries_status_idx` ON `email_deliveries` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `email_templates_event_active_idx` ON `email_templates` (`eventType`,`isActive`);
