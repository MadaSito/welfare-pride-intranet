ALTER TABLE `announcements` MODIFY COLUMN `status` enum('draft','pending_approval','published','declined','archived') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `announcements` MODIFY COLUMN `status` enum('draft','pending_approval','published','declined','archived') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `company_events` MODIFY COLUMN `status` enum('draft','pending_approval','published','declined','cancelled','archived') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `announcements` ADD `reviewedByUserId` int;--> statement-breakpoint
ALTER TABLE `announcements` ADD `reviewedAt` timestamp;--> statement-breakpoint
ALTER TABLE `announcements` ADD `reviewNote` text;--> statement-breakpoint
ALTER TABLE `company_events` ADD `reviewedByUserId` int;--> statement-breakpoint
ALTER TABLE `company_events` ADD `reviewedAt` timestamp;--> statement-breakpoint
ALTER TABLE `company_events` ADD `reviewNote` text;--> statement-breakpoint
ALTER TABLE `announcements` ADD CONSTRAINT `announcements_reviewedByUserId_users_id_fk` FOREIGN KEY (`reviewedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `company_events` ADD CONSTRAINT `company_events_reviewedByUserId_users_id_fk` FOREIGN KEY (`reviewedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;
