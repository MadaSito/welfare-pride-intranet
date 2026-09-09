CREATE TABLE `admin_access_request_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accessRequestId` int NOT NULL,
	`recipientUserId` int NOT NULL,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_access_request_notifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_request_notifications_unique` UNIQUE(`accessRequestId`,`recipientUserId`)
);
--> statement-breakpoint
ALTER TABLE `admin_access_request_notifications` ADD CONSTRAINT `aarn_request_fk` FOREIGN KEY (`accessRequestId`) REFERENCES `portal_access_requests`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admin_access_request_notifications` ADD CONSTRAINT `aarn_recipient_fk` FOREIGN KEY (`recipientUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `admin_request_notifications_unread_idx` ON `admin_access_request_notifications` (`recipientUserId`,`readAt`,`createdAt`);
