ALTER TABLE `email_templates` MODIFY COLUMN `eventType` enum('announcement_published','event_published','birthday_congratulation','manual') NOT NULL;--> statement-breakpoint
ALTER TABLE `email_templates` MODIFY COLUMN `eventType` enum('announcement_published','event_published','birthday_congratulation','manual') NOT NULL;--> statement-breakpoint
ALTER TABLE `email_deliveries` ADD `deliveryKey` varchar(180);--> statement-breakpoint
ALTER TABLE `email_deliveries` ADD CONSTRAINT `email_deliveries_key_unique` UNIQUE(`deliveryKey`);
