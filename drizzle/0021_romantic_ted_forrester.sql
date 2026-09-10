CREATE TABLE `portal_roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`permissionsJson` text NOT NULL,
	`isSystem` boolean NOT NULL DEFAULT false,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portal_roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `portal_roles_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `portal_user_role_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`roleId` int NOT NULL,
	`assignedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `portal_user_role_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `portal_user_roles_unique` UNIQUE(`userId`,`roleId`)
);
--> statement-breakpoint
ALTER TABLE `portal_roles` ADD CONSTRAINT `pr_creator_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `portal_user_role_assignments` ADD CONSTRAINT `pura_assign_fk` FOREIGN KEY (`assignedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `portal_user_role_assignments` ADD CONSTRAINT `pura_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `portal_user_role_assignments` ADD CONSTRAINT `pura_role_fk` FOREIGN KEY (`roleId`) REFERENCES `portal_roles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `portal_user_roles_user_idx` ON `portal_user_role_assignments` (`userId`);
