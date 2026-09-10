ALTER TABLE `backup_destinations` ADD `backupScope` enum('configuration','configuration_and_secrets','secrets_only','full_platform') DEFAULT 'configuration_and_secrets' NOT NULL;--> statement-breakpoint
ALTER TABLE `backup_destinations` ADD `localRetentionDays` int DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE `backup_runs` ADD `backupScope` enum('configuration','configuration_and_secrets','secrets_only','full_platform') DEFAULT 'configuration_and_secrets' NOT NULL;--> statement-breakpoint
ALTER TABLE `backup_runs` ADD `localArtifactPath` varchar(500);