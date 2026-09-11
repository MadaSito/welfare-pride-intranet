ALTER TABLE `portal_resources` MODIFY COLUMN `resourceType` enum('module','page','calendar') NOT NULL;--> statement-breakpoint
ALTER TABLE `portal_resources` MODIFY COLUMN `resourceType` enum('module','page','calendar') NOT NULL;--> statement-breakpoint
ALTER TABLE `portal_resources` ADD `calendarView` enum('all','events_only') DEFAULT 'all' NOT NULL;--> statement-breakpoint
INSERT INTO `portal_resources` (`resourceKey`, `resourceType`, `label`, `path`, `navigationGroup`, `navigationGroupOrder`, `iconKey`, `body`, `calendarView`, `accessMode`, `isPublished`, `isSystem`, `sortOrder`)
VALUES
  ('page:pa-health-wellness', 'page', 'Health & Wellness Resources', '/pages/pa-health-wellness', 'PA Health and Wellness', 35, 'heart-pulse', NULL, 'all', 'all_authenticated', true, false, 10),
  ('calendar:pa-health-wellness-calendar', 'calendar', 'Health & Wellness Calendar', '/calendars/pa-health-wellness-calendar', 'PA Health and Wellness', 35, 'calendar-days', NULL, 'all', 'all_authenticated', true, false, 20),
  ('calendar:pa-health-wellness-events', 'calendar', 'Health & Wellness Events', '/calendars/pa-health-wellness-events', 'PA Health and Wellness', 35, 'calendar-days', NULL, 'events_only', 'all_authenticated', true, false, 30),
  ('page:jefferson-health-partners-call-center', 'page', 'Call Center Resources', '/pages/jefferson-health-partners-call-center', 'Jefferson Health Partners Call Center', 45, 'headset', NULL, 'all', 'all_authenticated', true, false, 10),
  ('page:jefferson-health-partners-call-center-notes', 'page', 'Call Center Notes', '/pages/jefferson-health-partners-call-center-notes', 'Jefferson Health Partners Call Center', 45, 'file-text', NULL, 'all', 'all_authenticated', true, false, 20)
ON DUPLICATE KEY UPDATE `resourceKey` = `portal_resources`.`resourceKey`;
