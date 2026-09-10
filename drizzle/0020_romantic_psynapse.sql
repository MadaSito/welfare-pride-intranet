DROP INDEX `portal_resources_published_sort_idx` ON `portal_resources`;--> statement-breakpoint
ALTER TABLE `portal_resources` ADD `navigationGroupOrder` int DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `portal_resources_published_order_idx` ON `portal_resources` (`isPublished`,`navigationGroupOrder`,`sortOrder`);
