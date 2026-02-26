import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
  group: {
    participants: r.many.participant(),
    expenses: r.many.expense(),
    activities: r.many.activity(),
  },
  participant: {
    group: r.one.group({
      from: r.participant.groupId,
      to: r.group.id,
      optional: false,
    }),
    expensePaidBy: r.many.expense(),
    expensePaidFor: r.many.expensePaidFor(),
  },
  category: {
    Expense: r.many.expense(),
  },
  expense: {
    group: r.one.group({
      from: r.expense.groupId,
      to: r.group.id,
      optional: false,
    }),
    category: r.one.category({
      from: r.expense.categoryId,
      to: r.category.id,
      optional: false,
    }),
    paidBy: r.one.participant({
      from: r.expense.paidById,
      to: r.participant.id,
      optional: false,
    }),
    paidFor: r.many.expensePaidFor(),
    documents: r.many.expenseDocument(),
    recurringExpenseLink: r.one.recurringExpenseLink(),
  },
  expenseDocument: {
    Expense: r.one.expense({
      from: r.expenseDocument.expenseId,
      to: r.expense.id,
      optional: false,
    }),
  },
  recurringExpenseLink: {
    currentFrameExpense: r.one.expense({
      from: r.recurringExpenseLink.currentFrameExpenseId,
      to: r.expense.id,
    }),
  },
  expensePaidFor: {
    expense: r.one.expense({
      from: r.expensePaidFor.expenseId,
      to: r.expense.id,
    }),
    participant: r.one.participant({
      from: r.expensePaidFor.participantId,
      to: r.participant.id,
      optional: false,
    }),
  },
  activity: {
    group: r.one.group({
      from: r.activity.groupId,
      to: r.group.id,
    }),
  },
}))