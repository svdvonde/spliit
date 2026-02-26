PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_RecurringExpenseLink` (
	`id` text PRIMARY KEY,
	`groupId` text NOT NULL,
	`currentFrameExpenseId` text NOT NULL UNIQUE,
	`nextExpenseCreatedAt` integer,
	`nextExpenseDate` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_RecurringExpenseLink`(`id`, `groupId`, `currentFrameExpenseId`, `nextExpenseCreatedAt`, `nextExpenseDate`) SELECT `id`, `groupId`, `currentFrameExpenseId`, `nextExpenseCreatedAt`, `nextExpenseDate` FROM `RecurringExpenseLink`;--> statement-breakpoint
DROP TABLE `RecurringExpenseLink`;--> statement-breakpoint
ALTER TABLE `__new_RecurringExpenseLink` RENAME TO `RecurringExpenseLink`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP INDEX IF EXISTS `RecurringExpenseLink_currentFrameExpenseId_key`;--> statement-breakpoint
CREATE INDEX `RecurringExpenseLink_groupId_idx` ON `RecurringExpenseLink` (`groupId`);--> statement-breakpoint
CREATE INDEX `RecurringExpenseLink_groupId_nextExpenseCreatedAt_nextExpenseDate_idx` ON `RecurringExpenseLink` (`groupId`,`nextExpenseCreatedAt`,`nextExpenseDate`);