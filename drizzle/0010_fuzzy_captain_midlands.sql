CREATE TABLE `access_control_audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`action` varchar(120) NOT NULL,
	`resourceId` int,
	`actorUserId` int,
	`metadataJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `access_control_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `entra_groups` (
	`groupId` varchar(128) NOT NULL,
	`displayName` varchar(240) NOT NULL,
	`lastSyncedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `entra_groups_groupId` PRIMARY KEY(`groupId`)
);
--> statement-breakpoint
CREATE TABLE `portal_resource_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`resourceId` int NOT NULL,
	`subjectType` enum('user','entra_group') NOT NULL,
	`userId` int,
	`entraGroupId` varchar(128),
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `portal_resource_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `portal_resource_assignments_user_unique` UNIQUE(`resourceId`,`userId`),
	CONSTRAINT `portal_resource_assignments_group_unique` UNIQUE(`resourceId`,`entraGroupId`)
);
--> statement-breakpoint
CREATE TABLE `portal_resources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`resourceKey` varchar(140) NOT NULL,
	`resourceType` enum('module','page') NOT NULL,
	`label` varchar(160) NOT NULL,
	`path` varchar(220) NOT NULL,
	`navigationGroup` varchar(120) NOT NULL DEFAULT 'Workplace',
	`iconKey` varchar(64) NOT NULL DEFAULT 'file-text',
	`body` text,
	`accessMode` enum('all_authenticated','restricted') NOT NULL DEFAULT 'all_authenticated',
	`isPublished` boolean NOT NULL DEFAULT true,
	`isSystem` boolean NOT NULL DEFAULT false,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portal_resources_id` PRIMARY KEY(`id`),
	CONSTRAINT `portal_resources_key_unique` UNIQUE(`resourceKey`),
	CONSTRAINT `portal_resources_path_unique` UNIQUE(`path`)
);
--> statement-breakpoint
CREATE TABLE `user_entra_group_memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`entraGroupId` varchar(128) NOT NULL,
	`syncedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_entra_group_memberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_entra_group_memberships_unique` UNIQUE(`userId`,`entraGroupId`)
);
--> statement-breakpoint
ALTER TABLE `access_control_audit_events` ADD CONSTRAINT `access_control_audit_events_resourceId_portal_resources_id_fk` FOREIGN KEY (`resourceId`) REFERENCES `portal_resources`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `access_control_audit_events` ADD CONSTRAINT `access_control_audit_events_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `portal_resource_assignments` ADD CONSTRAINT `portal_resource_assignments_resourceId_portal_resources_id_fk` FOREIGN KEY (`resourceId`) REFERENCES `portal_resources`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `portal_resource_assignments` ADD CONSTRAINT `portal_resource_assignments_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `portal_resource_assignments` ADD CONSTRAINT `portal_resource_assignments_entraGroupId_entra_groups_groupId_fk` FOREIGN KEY (`entraGroupId`) REFERENCES `entra_groups`(`groupId`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `portal_resource_assignments` ADD CONSTRAINT `portal_resource_assignments_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `portal_resources` ADD CONSTRAINT `portal_resources_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_entra_group_memberships` ADD CONSTRAINT `user_entra_group_memberships_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_entra_group_memberships` ADD CONSTRAINT `uegm_group_fk` FOREIGN KEY (`entraGroupId`) REFERENCES `entra_groups`(`groupId`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `access_control_audit_events_resource_created_idx` ON `access_control_audit_events` (`resourceId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `entra_groups_display_name_idx` ON `entra_groups` (`displayName`);--> statement-breakpoint
CREATE INDEX `portal_resource_assignments_resource_idx` ON `portal_resource_assignments` (`resourceId`);--> statement-breakpoint
CREATE INDEX `portal_resources_published_sort_idx` ON `portal_resources` (`isPublished`,`navigationGroup`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `user_entra_group_memberships_group_idx` ON `user_entra_group_memberships` (`entraGroupId`);
