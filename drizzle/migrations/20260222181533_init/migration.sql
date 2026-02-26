CREATE TABLE `Activity` (
	`id` text PRIMARY KEY NOT NULL,
	`groupId` text NOT NULL,
	`time` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`activityType` text NOT NULL,
	`participantId` text,
	`expenseId` text,
	`data` text,
	FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `Category` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`grouping` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Expense` (
	`id` text PRIMARY KEY NOT NULL,
	`expenseDate` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`title` text NOT NULL,
	`categoryId` integer DEFAULT 0 NOT NULL,
	`amount` integer NOT NULL,
	`originalAmount` integer,
	`originalCurrency` text,
	`conversionRate` numeric,
	`paidById` text NOT NULL,
	`groupId` text NOT NULL,
	`isReimbursement` integer NOT NULL,
	`splitMode` text DEFAULT 'EVENLY' NOT NULL,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`notes` text,
	`recurrenceRule` text DEFAULT 'NONE',
	`recurringExpenseLinkId` text,
	FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`paidById`) REFERENCES `Participant`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ExpenseDocument` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`expenseId` text,
	FOREIGN KEY (`expenseId`) REFERENCES `Expense`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `ExpensePaidFor` (
	`expenseId` text NOT NULL,
	`participantId` text NOT NULL,
	`shares` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`expenseId`, `participantId`),
	FOREIGN KEY (`expenseId`) REFERENCES `Expense`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`participantId`) REFERENCES `Participant`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `Group` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`information` text,
	`currency` text DEFAULT '$' NOT NULL,
	`currencyCode` text,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Participant` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`groupId` text NOT NULL,
	FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `RecurringExpenseLink` (
	`id` text PRIMARY KEY NOT NULL,
	`groupId` text NOT NULL,
	`currentFrameExpenseId` text NOT NULL,
	`nextExpenseCreatedAt` integer,
	`nextExpenseDate` integer NOT NULL,
	FOREIGN KEY (`currentFrameExpenseId`) REFERENCES `Expense`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `RecurringExpenseLink_groupId_nextExpenseCreatedAt_nextExpenseDate_idx` ON `RecurringExpenseLink` (`groupId`,`nextExpenseCreatedAt`,`nextExpenseDate`);--> statement-breakpoint
CREATE INDEX `RecurringExpenseLink_groupId_idx` ON `RecurringExpenseLink` (`groupId`);--> statement-breakpoint
CREATE UNIQUE INDEX `RecurringExpenseLink_currentFrameExpenseId_key` ON `RecurringExpenseLink` (`currentFrameExpenseId`);
--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (0, 'Uncategorized', 'General');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (1, 'Uncategorized', 'Payment');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (2, 'Entertainment', 'Entertainment');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (3, 'Entertainment', 'Games');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (4, 'Entertainment', 'Movies');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (5, 'Entertainment', 'Music');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (6, 'Entertainment', 'Sports');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (7, 'Food and Drink', 'Food and Drink');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (8, 'Food and Drink', 'Dining Out');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (9, 'Food and Drink', 'Groceries');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (10, 'Food and Drink', 'Liquor');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (11, 'Home', 'Home');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (12, 'Home', 'Electronics');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (13, 'Home', 'Furniture');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (14, 'Home', 'Household Supplies');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (15, 'Home', 'Maintenance');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (16, 'Home', 'Mortgage');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (17, 'Home', 'Pets');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (18, 'Home', 'Rent');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (19, 'Home', 'Services');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (20, 'Life', 'Childcare');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (21, 'Life', 'Clothing');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (22, 'Life', 'Education');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (23, 'Life', 'Gifts');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (24, 'Life', 'Insurance');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (25, 'Life', 'Medical Expenses');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (26, 'Life', 'Taxes');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (27, 'Transportation', 'Transportation');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (28, 'Transportation', 'Bicycle');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (29, 'Transportation', 'Bus/Train');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (30, 'Transportation', 'Car');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (31, 'Transportation', 'Gas/Fuel');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (32, 'Transportation', 'Hotel');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (33, 'Transportation', 'Parking');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (34, 'Transportation', 'Plane');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (35, 'Transportation', 'Taxi');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (36, 'Utilities', 'Utilities');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (37, 'Utilities', 'Cleaning');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (38, 'Utilities', 'Electricity');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (39, 'Utilities', 'Heat/Gas');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (40, 'Utilities', 'Trash');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (41, 'Utilities', 'TV/Phone/Internet');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (42, 'Utilities', 'Water');--> statement-breakpoint
INSERT INTO "Category" ("id", "grouping", "name") VALUES (43, 'Life', 'Donation');
