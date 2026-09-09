CREATE TABLE `security_alert_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`triggerEventId` int NOT NULL,
	`recipientUserId` int NOT NULL,
	`correlationId` varchar(64) NOT NULL,
	`eventType` varchar(120) NOT NULL,
	`severity` enum('high','critical') NOT NULL,
	`ipAddress` varchar(45),
	`matchedEventCount` int NOT NULL,
	`windowMinutes` int NOT NULL,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `security_alert_notifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `security_alert_notif_unique` UNIQUE(`triggerEventId`,`recipientUserId`)
);
--> statement-breakpoint
ALTER TABLE `security_settings` ADD `alertingEnabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `security_settings` ADD `highSeverityAlertThreshold` int DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `security_settings` ADD `highSeverityAlertWindowMinutes` int DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE `security_alert_notifications` ADD CONSTRAINT `san_event_fk` FOREIGN KEY (`triggerEventId`) REFERENCES `security_events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `security_alert_notifications` ADD CONSTRAINT `san_recipient_fk` FOREIGN KEY (`recipientUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `security_alert_notif_unread_idx` ON `security_alert_notifications` (`recipientUserId`,`readAt`,`createdAt`);