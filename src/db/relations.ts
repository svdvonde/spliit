import { relations } from "drizzle-orm/relations";
import * as schema from "./schema"

export const groupRelations = relations(schema.group, ({ many }) => ({
  participants: many(schema.participant),
  expenses: many(schema.expense),
  activities: many(schema.activity),
}))

export const participantRelations = relations(schema.participant, ({ one, many }) => ({
  group: one(schema.group, {
    fields: [schema.participant.groupId],
    references: [schema.group.id],
  }),
  expenses: many(schema.expense),
  expensePaidFors: many(schema.expensePaidFor),
}))


export const categoryRelations = relations(schema.category, ({ many }) => ({
  expenses: many(schema.expense),
}))


export const expenseRelations = relations(schema.expense, ({ one, many }) => ({
  participant: one(schema.participant, {
    fields: [schema.expense.paidById],
    references: [schema.participant.id],
  }),
  category: one(schema.category, {
    fields: [schema.expense.categoryId],
    references: [schema.category.id],
  }),
  group: one(schema.group, {
    fields: [schema.expense.groupId],
    references: [schema.group.id],
  }),
  expenseDocuments: many(schema.expenseDocument),
  recurringExpenseLinks: many(schema.recurringExpenseLink),
  expensePaidFors: many(schema.expensePaidFor),
}))

export const expenseDocumentRelations = relations(
  schema.expenseDocument,
  ({ one }) => ({
    expense: one(schema.expense, {
      fields: [schema.expenseDocument.expenseId],
      references: [schema.expense.id],
    }),
  }),
)

export const recurringExpenseLinkRelations = relations(
  schema.recurringExpenseLink,
  ({ one }) => ({
    expense: one(schema.expense, {
      fields: [schema.recurringExpenseLink.currentFrameExpenseId],
      references: [schema.expense.id],
    }),
  }),
)

export const expensePaidForRelations = relations(schema.expensePaidFor, ({ one }) => ({
  participant: one(schema.participant, {
    fields: [schema.expensePaidFor.participantId],
    references: [schema.participant.id],
  }),
  expense: one(schema.expense, {
    fields: [schema.expensePaidFor.expenseId],
    references: [schema.expense.id],
  }),
}))

export const activityRelations = relations(schema.activity, ({ one }) => ({
  group: one(schema.group, {
    fields: [schema.activity.groupId],
    references: [schema.group.id],
  }),
}))
