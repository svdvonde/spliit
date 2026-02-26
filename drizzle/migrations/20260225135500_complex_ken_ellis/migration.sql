PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_Expense` (
	`id` text PRIMARY KEY,
	`groupId` text NOT NULL,
	`expenseDate` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`title` text NOT NULL,
	`categoryId` integer DEFAULT 0 NOT NULL,
	`amount` integer NOT NULL,
	`originalAmount` integer,
	`originalCurrency` text,
	`conversionRate` numeric,
	`paidById` text NOT NULL,
	`isReimbursement` integer DEFAULT false NOT NULL,
	`splitMode` text DEFAULT 'EVENLY' NOT NULL,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`notes` text,
	`recurrenceRule` text DEFAULT 'NONE',
	`recurringExpenseLinkId` text,
	CONSTRAINT `Expense_groupId_Group_id_fk` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `Expense_categoryId_Category_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
	CONSTRAINT `Expense_paidById_Participant_id_fk` FOREIGN KEY (`paidById`) REFERENCES `Participant`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_Expense`(`id`, `expenseDate`, `title`, `categoryId`, `amount`, `originalAmount`, `originalCurrency`, `conversionRate`, `paidById`, `groupId`, `isReimbursement`, `splitMode`, `createdAt`, `notes`, `recurrenceRule`, `recurringExpenseLinkId`) SELECT `id`, `expenseDate`, `title`, `categoryId`, `amount`, `originalAmount`, `originalCurrency`, `conversionRate`, `paidById`, `groupId`, `isReimbursement`, `splitMode`, `createdAt`, `notes`, `recurrenceRule`, `recurringExpenseLinkId` FROM `Expense`;--> statement-breakpoint
DROP TABLE `Expense`;--> statement-breakpoint
ALTER TABLE `__new_Expense` RENAME TO `Expense`;--> statement-breakpoint
PRAGMA foreign_keys=ON;