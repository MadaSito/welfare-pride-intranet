ALTER TABLE `backup_destinations` ADD `scheduleCron` varchar(120);--> statement-breakpoint
ALTER TABLE `backup_destinations` ADD `scheduleEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `backup_destinations` ADD `lastScheduledDispatchAt` timestamp;--> statement-breakpoint
CREATE INDEX `backup_destinations_schedule_idx` ON `backup_destinations` (`scheduleEnabled`,`lastScheduledDispatchAt`);