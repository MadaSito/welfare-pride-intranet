ALTER TABLE `app_sessions` ADD `authState` enum('full','password_change_required','mfa_enrollment_required','mfa_verification_required') DEFAULT 'full' NOT NULL;--> statement-breakpoint
ALTER TABLE `local_credentials` ADD `mfaRequired` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `local_credentials` ADD `mfaEnrolledAt` timestamp;--> statement-breakpoint
ALTER TABLE `local_credentials` ADD `mustChangePassword` boolean DEFAULT false NOT NULL;