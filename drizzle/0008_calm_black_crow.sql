CREATE TABLE `dashboard_pins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`pinType` enum('hr_document','event') NOT NULL,
	`targetKey` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dashboard_pins_id` PRIMARY KEY(`id`),
	CONSTRAINT `dashboard_pins_user_type_target_unique` UNIQUE(`userId`,`pinType`,`targetKey`)
);
--> statement-breakpoint
ALTER TABLE `dashboard_pins` ADD CONSTRAINT `dashboard_pins_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `dashboard_pins_user_created_idx` ON `dashboard_pins` (`userId`,`createdAt`);