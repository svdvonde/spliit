import { sql } from "drizzle-orm";
import { index,integer,numeric,primaryKey,sqliteTable,text,uniqueIndex } from "drizzle-orm/sqlite-core";

export const group = sqliteTable("Group", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	information: text(),
	currency: text().default("$").notNull(),
	currencyCode: text(),
	createdAt: integer({ mode: 'timestamp'}).default(sql`(strftime('%s', 'now'))`).notNull(),
});


export const participant = sqliteTable("Participant", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	groupId: text().notNull().references(() => group.id, { onDelete: "cascade", onUpdate: "cascade" } ),
});



export const category = sqliteTable("Category", {
	id: integer().primaryKey({ autoIncrement: true }).notNull(),
	grouping: text().notNull(),
	name: text().notNull(),
});


export const expense = sqliteTable("Expense", {
	id: text().primaryKey().notNull(),
	expenseDate: integer({ mode: 'timestamp'}).default(sql`(strftime('%s', 'now'))`).notNull(),
	title: text().notNull(),
	categoryId: integer().default(0).notNull().references(() => category.id, { onDelete: "restrict", onUpdate: "cascade" } ),
	amount: integer().notNull(),
	originalAmount: integer(),
	originalCurrency: text(),
	conversionRate: numeric(),
	paidById: text().notNull().references(() => participant.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	groupId: text().notNull().references(() => group.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	isReimbursement: integer({ mode: 'boolean' }).notNull(),
	splitMode: text().default("EVENLY").notNull(),
	createdAt: integer({ mode: 'timestamp'}).default(sql`(strftime('%s', 'now'))`).notNull(),
	notes: text(),
	recurrenceRule: text().default("NONE"),
	recurringExpenseLinkId: text(),
});


export const expenseDocument = sqliteTable("ExpenseDocument", {
	id: text().primaryKey().notNull(),
	url: text().notNull(),
	width: integer().notNull(),
	height: integer().notNull(),
	expenseId: text().references(() => expense.id, { onDelete: "set null", onUpdate: "cascade" } ),
});


export const recurringExpenseLink = sqliteTable("RecurringExpenseLink", {
	id: text().primaryKey().notNull(),
	groupId: text().notNull(),
	currentFrameExpenseId: text().notNull().references(() => expense.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	nextExpenseCreatedAt: integer({ mode: 'timestamp'}),
	nextExpenseDate: integer({ mode: 'timestamp'}).notNull(),
},
(table) => [
	index("RecurringExpenseLink_groupId_nextExpenseCreatedAt_nextExpenseDate_idx").on(table.groupId, table.nextExpenseCreatedAt, table.nextExpenseDate),
	index("RecurringExpenseLink_groupId_idx").on(table.groupId),
	uniqueIndex("RecurringExpenseLink_currentFrameExpenseId_key").on(table.currentFrameExpenseId),
]);


export const expensePaidFor = sqliteTable("ExpensePaidFor", {
	expenseId: text().notNull().references(() => expense.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	participantId: text().notNull().references(() => participant.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	shares: integer().default(1).notNull(),
},
(table) => [
	primaryKey({ columns: [table.expenseId, table.participantId], name: "ExpensePaidFor_expenseId_participantId_pk"})
]);




export const activity = sqliteTable("Activity", {
	id: text().primaryKey().notNull(),
	groupId: text().notNull().references(() => group.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	time: integer({ mode: 'timestamp'}).default(sql`(strftime('%s', 'now'))`).notNull(),
	activityType: text().notNull(),
	participantId: text(),
	expenseId: text(),
	data: text(),
});










