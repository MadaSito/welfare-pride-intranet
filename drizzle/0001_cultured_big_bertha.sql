CREATE TABLE `announcements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(240) NOT NULL,
	`slug` varchar(260) NOT NULL,
	`summary` text,
	`body` text NOT NULL,
	`category` varchar(100) NOT NULL DEFAULT 'Company',
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`isPinned` boolean NOT NULL DEFAULT false,
	`publishAt` timestamp,
	`expiresAt` timestamp,
	`authorUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `announcements_id` PRIMARY KEY(`id`),
	CONSTRAINT `announcements_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `backup_destinations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` varchar(64) NOT NULL,
	`displayName` varchar(160) NOT NULL,
	`publicConfigJson` text,
	`encryptedSecrets` text,
	`secretMaskJson` text,
	`isEnabled` boolean NOT NULL DEFAULT false,
	`status` enum('unconfigured','configured','connected','degraded','error') NOT NULL DEFAULT 'unconfigured',
	`lastTestedAt` timestamp,
	`scheduleCronTaskUid` varchar(65),
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `backup_destinations_id` PRIMARY KEY(`id`),
	CONSTRAINT `backup_destinations_provider_name_unique` UNIQUE(`provider`,`displayName`)
);
--> statement-breakpoint
CREATE TABLE `backup_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`destinationId` int NOT NULL,
	`runType` enum('dry_run','backup') NOT NULL,
	`status` enum('pending','running','succeeded','failed') NOT NULL DEFAULT 'pending',
	`artifactName` varchar(240),
	`checksumSha256` varchar(64),
	`byteSize` int,
	`message` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`triggeredByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `backup_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `company_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(240) NOT NULL,
	`description` text,
	`category` varchar(100) NOT NULL DEFAULT 'Company',
	`location` varchar(240),
	`meetingUrl` text,
	`startAt` timestamp NOT NULL,
	`endAt` timestamp NOT NULL,
	`isAllDay` boolean NOT NULL DEFAULT false,
	`status` enum('draft','published','cancelled','archived') NOT NULL DEFAULT 'draft',
	`authorUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `company_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `connection_diagnostics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` varchar(64) NOT NULL,
	`target` varchar(240) NOT NULL,
	`status` enum('success','failure','unconfigured') NOT NULL,
	`message` text NOT NULL,
	`durationMs` int NOT NULL DEFAULT 0,
	`testedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `connection_diagnostics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_blocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pageKey` varchar(80) NOT NULL,
	`sectionKey` varchar(120) NOT NULL,
	`eyebrow` varchar(160),
	`title` varchar(240) NOT NULL,
	`body` text NOT NULL,
	`mediaUrl` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isPublished` boolean NOT NULL DEFAULT true,
	`updatedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_blocks_id` PRIMARY KEY(`id`),
	CONSTRAINT `content_blocks_page_section_unique` UNIQUE(`pageKey`,`sectionKey`)
);
--> statement-breakpoint
CREATE TABLE `employee_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`entraUserId` varchar(128),
	`displayName` varchar(200) NOT NULL,
	`email` varchar(320),
	`jobTitle` varchar(200),
	`department` varchar(200),
	`officeLocation` varchar(200),
	`bio` text,
	`phone` varchar(64),
	`photoUrl` text,
	`managerEntraUserId` varchar(128),
	`birthdayMonth` int,
	`birthdayDay` int,
	`source` enum('local','entra','hybrid') NOT NULL DEFAULT 'local',
	`isActive` boolean NOT NULL DEFAULT true,
	`lastSyncedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employee_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `employee_profiles_user_id_unique` UNIQUE(`userId`),
	CONSTRAINT `employee_profiles_entra_id_unique` UNIQUE(`entraUserId`)
);
--> statement-breakpoint
CREATE TABLE `founders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`title` varchar(200),
	`bio` text NOT NULL,
	`photoUrl` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isPublished` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `founders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `holidays` (
	`id` int AUTO_INCREMENT NOT NULL,
	`externalId` varchar(180),
	`title` varchar(240) NOT NULL,
	`description` text,
	`startDate` date NOT NULL,
	`endDate` date NOT NULL,
	`isObserved` boolean NOT NULL DEFAULT false,
	`sourceUpdatedAt` timestamp,
	`syncedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `holidays_id` PRIMARY KEY(`id`),
	CONSTRAINT `holidays_external_id_unique` UNIQUE(`externalId`)
);
--> statement-breakpoint
CREATE TABLE `important_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(160) NOT NULL,
	`description` text,
	`url` text NOT NULL,
	`category` varchar(100) NOT NULL DEFAULT 'Resources',
	`iconKey` varchar(64) NOT NULL DEFAULT 'link',
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `important_links_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integration_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` varchar(64) NOT NULL,
	`displayName` varchar(160) NOT NULL,
	`publicConfigJson` text,
	`encryptedSecrets` text,
	`secretMaskJson` text,
	`status` enum('unconfigured','configured','connected','degraded','error') NOT NULL DEFAULT 'unconfigured',
	`lastTestedAt` timestamp,
	`updatedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integration_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `integration_settings_provider_unique` UNIQUE(`provider`)
);
--> statement-breakpoint
CREATE TABLE `milestones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(240) NOT NULL,
	`description` text NOT NULL,
	`eventDate` date NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isPublished` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `milestones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `restore_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`backupRunId` int NOT NULL,
	`destinationId` int NOT NULL,
	`status` enum('pending','running','succeeded','failed','blocked') NOT NULL DEFAULT 'pending',
	`confirmationValue` varchar(160) NOT NULL,
	`message` text,
	`requestedByUserId` int NOT NULL,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `restore_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `technology_embeds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text,
	`url` text NOT NULL,
	`allowedHostname` varchar(253) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `technology_embeds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `announcements` ADD CONSTRAINT `announcements_authorUserId_users_id_fk` FOREIGN KEY (`authorUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `backup_destinations` ADD CONSTRAINT `backup_destinations_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `backup_runs` ADD CONSTRAINT `backup_runs_destinationId_backup_destinations_id_fk` FOREIGN KEY (`destinationId`) REFERENCES `backup_destinations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `backup_runs` ADD CONSTRAINT `backup_runs_triggeredByUserId_users_id_fk` FOREIGN KEY (`triggeredByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `company_events` ADD CONSTRAINT `company_events_authorUserId_users_id_fk` FOREIGN KEY (`authorUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `connection_diagnostics` ADD CONSTRAINT `connection_diagnostics_testedByUserId_users_id_fk` FOREIGN KEY (`testedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `content_blocks` ADD CONSTRAINT `content_blocks_updatedByUserId_users_id_fk` FOREIGN KEY (`updatedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee_profiles` ADD CONSTRAINT `employee_profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `important_links` ADD CONSTRAINT `important_links_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `integration_settings` ADD CONSTRAINT `integration_settings_updatedByUserId_users_id_fk` FOREIGN KEY (`updatedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `restore_runs` ADD CONSTRAINT `restore_runs_backupRunId_backup_runs_id_fk` FOREIGN KEY (`backupRunId`) REFERENCES `backup_runs`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `restore_runs` ADD CONSTRAINT `restore_runs_destinationId_backup_destinations_id_fk` FOREIGN KEY (`destinationId`) REFERENCES `backup_destinations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `restore_runs` ADD CONSTRAINT `restore_runs_requestedByUserId_users_id_fk` FOREIGN KEY (`requestedByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `technology_embeds` ADD CONSTRAINT `technology_embeds_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `announcements_status_publish_idx` ON `announcements` (`status`,`publishAt`);--> statement-breakpoint
CREATE INDEX `backup_destinations_task_uid_idx` ON `backup_destinations` (`scheduleCronTaskUid`);--> statement-breakpoint
CREATE INDEX `backup_runs_destination_started_idx` ON `backup_runs` (`destinationId`,`startedAt`);--> statement-breakpoint
CREATE INDEX `company_events_range_idx` ON `company_events` (`startAt`,`endAt`);--> statement-breakpoint
CREATE INDEX `connection_diagnostics_provider_created_idx` ON `connection_diagnostics` (`provider`,`createdAt`);--> statement-breakpoint
CREATE INDEX `content_blocks_page_sort_idx` ON `content_blocks` (`pageKey`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `employee_profiles_department_idx` ON `employee_profiles` (`department`);--> statement-breakpoint
CREATE INDEX `founders_sort_idx` ON `founders` (`sortOrder`);--> statement-breakpoint
CREATE INDEX `holidays_date_range_idx` ON `holidays` (`startDate`,`endDate`);--> statement-breakpoint
CREATE INDEX `important_links_category_sort_idx` ON `important_links` (`category`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `milestones_date_idx` ON `milestones` (`eventDate`);--> statement-breakpoint
CREATE INDEX `restore_runs_backup_created_idx` ON `restore_runs` (`backupRunId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `technology_embeds_sort_idx` ON `technology_embeds` (`sortOrder`);