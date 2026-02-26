import { getDb } from '@/db/db'
import * as schema from '@/db/schema'
import { RecurrenceRule } from '@/db/types'
import { getGroup } from '@/lib/api'
import { expenseFormSchema } from '@/lib/schemas'
import { baseProcedure } from '@/trpc/init'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { z } from 'zod'

export const processBatchProcedure = baseProcedure
  .input(
    z.object({
      groupId: z.string(),
      expenses: z.array(expenseFormSchema),
    }),
  )
  .mutation(async ({ input: { groupId, expenses } }) => {
    const group = await getGroup(groupId)

    const participantIds = new Set(group.participants.map((p) => p.id))
    const createdIds: string[] = []

    // Validate all participants before starting transaction
    for (const expense of expenses) {
      if (!participantIds.has(expense.paidBy)) {
        throw new Error(`Invalid payer ID: ${expense.paidBy}`)
      }
      for (const pf of expense.paidFor) {
        if (!participantIds.has(pf.participant)) {
          throw new Error(`Invalid receiver ID: ${pf.participant}`)
        }
      }
    }

    const db = getDb()

    await db.batch([
      // add a completely pointless select statement up front because batch
      // always requires exactly one statement, and the following spread syntax
      // does not necessarily requite one
      db
        .select({ id: schema.group.id })
        .from(schema.group)
        .where(eq(schema.group.id, group.id)),

      ...expenses
        .map((expense) => {
          const expenseId = nanoid()
          createdIds.push(expenseId)

          return [
            db.insert(schema.expense).values({
              id: expenseId,
              groupId,
              expenseDate: expense.expenseDate,
              categoryId: expense.category,
              amount: expense.amount,
              originalAmount: expense.originalAmount,
              originalCurrency: expense.originalCurrency,
              conversionRate: expense.conversionRate,
              title: expense.title,
              paidById: expense.paidBy,
              splitMode: expense.splitMode,
              recurrenceRule: expense.recurrenceRule || RecurrenceRule.NONE,
              isReimbursement: expense.isReimbursement,
              notes: expense.notes,
            }),
            ...(expense.paidFor.length > 0
              ? [
                  db.insert(schema.expensePaidFor).values(
                    expense.paidFor.map((paidFor) => ({
                      expenseId,
                      participantId: paidFor.participant,
                      shares: paidFor.shares,
                    })),
                  ),
                ]
              : []),

            ...(expense.documents.length > 0
              ? [
                  db.insert(schema.expenseDocument).values(
                    expense.documents.map((document) => ({
                      id: nanoid(),
                      expenseId,
                      url: document.url,
                      width: document.width,
                      height: document.height,
                    })),
                  ),
                ]
              : []),
          ]
        })
        .flat(),
    ])

    // Optional: Add a single activity log for the batch?
    // Or just rely on the UI to show success.
    // For now, no activity log to keep it simple and fast.

    return createdIds
  })
