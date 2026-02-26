import { getDb } from '@/db/db'
import * as schema from '@/db/schema'
import { ActivityType,RecurrenceRule } from '@/db/types'
import { ExpenseFormValues,GroupFormValues } from '@/lib/schemas'
import { and,count,eq,inArray,isNull } from 'drizzle-orm'
import { nanoid } from 'nanoid'

/**
 * This file frequently batches multiple statements together.
 * Since many statements depend on a condition
 * (i.e., run the statement only if a condition holds),
 * we need to creatively build an array of statements that, to the best of my
 * knowledge, cannot include 'undefined' values. The resulting array can be
 * given to a db.batch statement to batch them all together in a 'transaction'
 *
 * JavaScript (conditional) spread syntax, although awkward, can be used for this:
 *
 * console.log(["statement1", ...[], ...["statement2"]]);
 * ==> [ "statement1", "statement2" ]
 */

export function randomId() {
  return nanoid()
}

export async function createGroup(groupFormValues: GroupFormValues) {
  const db = getDb()
  const groupId = randomId()

  const participantRows = groupFormValues.participants.map((participant) => ({
    id: randomId(),
    groupId,
    name: participant.name,
  }))

  await db.batch([
    db.insert(schema.group).values({
      id: groupId,
      name: groupFormValues.name,
      information: groupFormValues.information ?? null,
      currency: groupFormValues.currency,
      currencyCode: groupFormValues.currencyCode || null,
    }),
    ...(groupFormValues.participants.length > 0
      ? [db.insert(schema.participant).values(participantRows)]
      : []),
  ]);

  return getGroup(groupId);
}

export async function createExpense(
  expenseFormValues: ExpenseFormValues,
  groupId: string,
  participantId?: string,
) {
  const db = getDb()

  const group = await getGroup(groupId)
  if (!group) {
    throw new Error(`Invalid group: ${groupId}`)
  }

  for (const participant of [
    expenseFormValues.paidBy,
    ...expenseFormValues.paidFor.map((p) => p.participant),
  ]) {
    if (!group.participants.some((p) => p.id === participant)) {
      throw new Error(`Invalid participant: ${participant}`)
    }
  }

  const expenseId = randomId()

  const logActivityStatement = makeLogActivityStatement(
    groupId,
    ActivityType.CREATE_EXPENSE,
    {
      participantId,
      expenseId,
      data: expenseFormValues.title,
    },
  )

  const isCreateRecurrence =
    expenseFormValues.recurrenceRule !== RecurrenceRule.NONE

  await db.batch([
    logActivityStatement,
    db.insert(schema.expense).values({
      id: expenseId,
      groupId,
      expenseDate: expenseFormValues.expenseDate,
      categoryId: expenseFormValues.category,
      amount: expenseFormValues.amount,
      originalAmount: expenseFormValues.originalAmount,
      originalCurrency: expenseFormValues.originalCurrency,
      conversionRate: expenseFormValues.conversionRate,
      title: expenseFormValues.title,
      paidById: expenseFormValues.paidBy,
      splitMode: expenseFormValues.splitMode,
      recurrenceRule: expenseFormValues.recurrenceRule,
      isReimbursement: expenseFormValues.isReimbursement,
      notes: expenseFormValues.notes,
    }),

    ...(expenseFormValues.paidFor.length > 0
      ? [
          db.insert(schema.expensePaidFor).values(
            expenseFormValues.paidFor.map((paidFor) => ({
              expenseId,
              participantId: paidFor.participant,
              shares: paidFor.shares,
            })),
          ),
        ]
      : []),

    ...(expenseFormValues.documents.length > 0
      ? [
          db.insert(schema.expenseDocument).values(
            expenseFormValues.documents.map((document) => ({
              id: document.id,
              expenseId,
              url: document.url,
              width: document.width,
              height: document.height,
            })),
          ),
        ]
      : []),

    ...(isCreateRecurrence
      ? [
          db.insert(schema.recurringExpenseLink).values({
            id: randomId(),
            groupId,
            currentFrameExpenseId: expenseId,
            nextExpenseDate: calculateNextDate(
              expenseFormValues.recurrenceRule as RecurrenceRule,
              expenseFormValues.expenseDate,
            ),
          }),
        ]
      : []),
  ])

  return { id: expenseId }
}

export async function deleteExpense(
  groupId: string,
  expenseId: string,
  participantId?: string,
) {
  const db = getDb()

  const existingExpense = await getExpense(groupId, expenseId)
  const logActivityStatement = makeLogActivityStatement(
    groupId,
    ActivityType.DELETE_EXPENSE,
    {
      participantId,
      expenseId,
      data: existingExpense?.title,
    },
  )

  const deleteStatement = db
    .delete(schema.expense)
    .where(
      and(
        eq(schema.expense.id, expenseId),
        eq(schema.expense.groupId, groupId),
      ),
    )
  await db.batch([logActivityStatement, deleteStatement])
}

export async function getGroupExpensesParticipants(groupId: string) {
  const expenses = await getGroupExpenses(groupId)
  return Array.from(
    new Set(
      expenses.flatMap((expense) => [
        expense.paidBy.id,
        ...expense.paidFor.map((paidFor) => paidFor.participant.id),
      ]),
    ),
  )
}

export async function getGroups(groupIds: string[]) {
  const db = getDb()

  const results = await db.batch([
    db.query.group.findMany({
      where: {
        id: { in: groupIds },
      },
    }),
    db
      .select({
        groupId: schema.group.id,
        participantCount: count(schema.participant.id),
      })
      .from(schema.group)
      .leftJoin(
        schema.participant,
        eq(schema.participant.groupId, schema.group.id),
      )
      .groupBy(schema.group.id),
  ])

  const groups = results[0]
  const counts = new Map(
    results[1].map((count) => [count.groupId, count.participantCount]),
  )

  return groups.map((group) => {
    const participantCount = counts.get(group.id)
    if (participantCount === undefined) {
      throw new Error(
        `Count not count the number of participants for group ${group.id}`,
      );
    }
    return {
      ...group,
      _count: {
        participants: participantCount,
      },
      createdAt: group.createdAt.toISOString(),
    }
  })
}

export async function updateExpense(
  groupId: string,
  expenseId: string,
  expenseFormValues: ExpenseFormValues,
  participantId?: string,
) {
  const db = getDb()

  const group = await getGroup(groupId)
  if (!group) {
    throw new Error(`Invalid group ID: ${groupId}`)
  }

  const existingExpense = await getExpense(groupId, expenseId)
  if (!existingExpense) {
    throw new Error(`Invalid expense ID: ${expenseId}`)
  }

  for (const participant of [
    expenseFormValues.paidBy,
    ...expenseFormValues.paidFor.map((p) => p.participant),
  ]) {
    if (!group.participants.some((p) => p.id === participant)) {
      throw new Error(`Invalid participant ID: ${participant}`)
    }
  }

  const logActivityStatement = makeLogActivityStatement(
    groupId,
    ActivityType.UPDATE_EXPENSE,
    {
      participantId,
      expenseId,
      data: expenseFormValues.title,
    },
  )

  const isDeleteRecurrenceExpenseLink =
    existingExpense.recurrenceRule !== RecurrenceRule.NONE &&
    expenseFormValues.recurrenceRule === RecurrenceRule.NONE &&
    existingExpense.recurringExpenseLink?.nextExpenseCreatedAt === null

  const isUpdateRecurrenceExpenseLink =
    existingExpense.recurrenceRule !== expenseFormValues.recurrenceRule &&
    existingExpense.recurringExpenseLink?.nextExpenseCreatedAt === null

  const isCreateRecurrenceExpenseLink =
    existingExpense.recurrenceRule === RecurrenceRule.NONE &&
    expenseFormValues.recurrenceRule !== RecurrenceRule.NONE &&
    existingExpense.recurringExpenseLink === null

  const updatedRecurrenceExpenseLinkNextExpenseDate = calculateNextDate(
    expenseFormValues.recurrenceRule,
    existingExpense.expenseDate,
  )

  const newRecurringExpenseLink = createPayloadForNewRecurringExpenseLink(
    expenseFormValues.recurrenceRule,
    expenseFormValues.expenseDate,
    groupId,
    expenseId,
  )

  // Collect the participants that are present in the existing expense,
  // but are no longer included in the form
  const participantIdsFromForm = expenseFormValues.paidFor.map(
    (paidFor) => paidFor.participant,
  )
  const participantIdsToDelete = existingExpense.paidFor
    .filter(
      (paidFor) => !participantIdsFromForm.includes(paidFor.participantId),
    )
    .map((paidFor) => paidFor.participantId)

  const currentDocumentIds = existingExpense.documents.map(
    (document) => document.id,
  )
  const nextDocumentIds = expenseFormValues.documents.map(
    (document) => document.id,
  )
  const documentIdsToDelete = currentDocumentIds.filter(
    (id) => !nextDocumentIds.includes(id),
  )

  db.batch([
    logActivityStatement,
    db
      .update(schema.expense)
      .set({
        expenseDate: expenseFormValues.expenseDate,
        amount: expenseFormValues.amount,
        originalAmount: expenseFormValues.originalAmount,
        originalCurrency: expenseFormValues.originalCurrency,
        conversionRate: expenseFormValues.conversionRate,
        title: expenseFormValues.title,
        categoryId: expenseFormValues.category,
        paidById: expenseFormValues.paidBy,
        splitMode: expenseFormValues.splitMode,
        recurrenceRule: expenseFormValues.recurrenceRule,
        isReimbursement: expenseFormValues.isReimbursement,
        notes: expenseFormValues.notes,
      })
      .where(eq(schema.expense.id, expenseId)),

    ...expenseFormValues.paidFor.map((paidFor) => {
      return db
        .insert(schema.expensePaidFor)
        .values({
          expenseId,
          participantId: paidFor.participant,
          shares: paidFor.shares,
        })
        .onConflictDoUpdate({
          target: [
            schema.expensePaidFor.expenseId,
            schema.expensePaidFor.participantId,
          ],
          set: {
            shares: paidFor.shares,
          },
        })
    }),

    db
      .delete(schema.expensePaidFor)
      .where(
        and(
          eq(schema.expensePaidFor.expenseId, expenseId),
          inArray(schema.expensePaidFor.participantId, participantIdsToDelete),
        ),
      ),

    ...(isCreateRecurrenceExpenseLink
      ? [db.insert(schema.recurringExpenseLink).values(newRecurringExpenseLink)]
      : []),
    ...(isUpdateRecurrenceExpenseLink
      ? [
          db
            .update(schema.recurringExpenseLink)
            .set({
              nextExpenseDate: updatedRecurrenceExpenseLinkNextExpenseDate,
            })
            .where(
              eq(
                schema.recurringExpenseLink.id,
                existingExpense.recurringExpenseLink!.id,
              ),
            ),
        ]
      : []),
    ...(isDeleteRecurrenceExpenseLink
      ? [
          db
            .delete(schema.recurringExpenseLink)
            .where(
              eq(
                schema.recurringExpenseLink.id,
                existingExpense.recurringExpenseLink!.id,
              ),
            ),
        ]
      : []),

    ...expenseFormValues.documents.map((document) => {
      return db
        .insert(schema.expenseDocument)
        .values({
          id: document.id,
          expenseId,
          url: document.url,
          width: document.width,
          height: document.height,
        })
        .onConflictDoUpdate({
          target: schema.expenseDocument.id,
          set: {
            expenseId,
            url: document.url,
            width: document.width,
            height: document.height,
          },
        })
    }),

    db
      .delete(schema.expenseDocument)
      .where(
        and(
          eq(schema.expenseDocument.expenseId, expenseId),
          inArray(schema.expenseDocument.id, documentIdsToDelete),
        ),
      ),
  ])

  return { id: expenseId }
}

/*
  return prisma.group.update({
    where: { id: groupId },
    data: {
      name: groupFormValues.name,
      information: groupFormValues.information,
      currency: groupFormValues.currency,
      currencyCode: groupFormValues.currencyCode,
      participants: {
        deleteMany: existingGroup.participants.filter(
          (p) => !groupFormValues.participants.some((p2) => p2.id === p.id),
        ),
        updateMany: groupFormValues.participants
          .filter((participant) => participant.id !== undefined)
          .map((participant) => ({
            where: { id: participant.id },
            data: {
              name: participant.name,
            },
          })),
        createMany: {
          data: groupFormValues.participants
            .filter((participant) => participant.id === undefined)
            .map((participant) => ({
              id: randomId(),
              name: participant.name,
            })),
        },
      },
    },
  })
 */

export async function updateGroup(
  groupId: string,
  groupFormValues: GroupFormValues,
  participantId?: string,
) {
  const db = getDb()

  const existingGroup = await getGroup(groupId)
  if (!existingGroup) throw new Error('Invalid group ID')

  const existingParticipantIds = existingGroup.participants.map(
    (participant) => participant.id,
  )
  const nextParticipantsWithIds = groupFormValues.participants.filter(
    (participant): participant is { id: string; name: string } =>
      participant.id !== undefined,
  )
  const nextParticipantIds = nextParticipantsWithIds.map(
    (participant) => participant.id,
  )
  const participantIdsToDelete = existingParticipantIds.filter(
    (id) => !nextParticipantIds.includes(id),
  )

  const newParticipants = groupFormValues.participants
    .filter((participant) => participant.id === undefined)
    .map((participant) => ({
      id: randomId(),
      groupId,
      name: participant.name,
    }))

  const logActivityStatement = makeLogActivityStatement(
    groupId,
    ActivityType.UPDATE_GROUP,
    {
      participantId,
    },
  )

  return await db.batch([
    logActivityStatement,
    db
      .update(schema.group)
      .set({
        name: groupFormValues.name,
        information: groupFormValues.information,
        currency: groupFormValues.currency,
        currencyCode: groupFormValues.currencyCode,
      })
      .where(eq(schema.group.id, groupId)),

    db
      .delete(schema.participant)
      .where(
        and(
          eq(schema.participant.groupId, groupId),
          inArray(schema.participant.id, participantIdsToDelete),
        ),
      ),

    ...nextParticipantsWithIds.map((participant) => {
      return db
        .update(schema.participant)
        .set({ name: participant.name })
        .where(
          and(
            eq(schema.participant.groupId, groupId),
            eq(schema.participant.id, participant.id),
          ),
        )
    }),
    db.insert(schema.participant).values(newParticipants),
  ])
}

/*
export async function getGroup(groupId: string) {
  return prisma.group.findUnique({
    where: { id: groupId },
    include: { participants: true },
  })
}
 */

export async function getGroup(groupId: string) {
  const db = getDb()
  const group = await db.query.group.findFirst({
    where: {
      id: groupId,
    },
    with: {
      participants: true,
    },
  });

  if (group === undefined) {
    throw new Error(`Group not found: ${groupId}`);
  }

  return group;
}

/*
export async function getGroup(groupId: string) {
  const db = getDb()

  const result = await db.batch([
    db.select().from(schema.group).where(eq(schema.group.id, groupId)).limit(1),
    db
      .select()
      .from(schema.participant)
      .where(eq(schema.participant.groupId, groupId)),
  ])

  const groups = result[0]
  const participants = result[1]

  if (groups.length !== 1) {
    throw new Error(`Group does not exist`)
  }

  return {
    ...groups[0],
    participants,
  }
}*/

export async function getCategories() {
  const db = getDb()
  return db.query.category.findMany()
}

export async function getGroupExpenses(
  groupId: string,
  options?: { offset?: number; length?: number; filter?: string },
) {
  const db = getDb()

  await createRecurringExpenses()

  const expenses = await db.query.expense.findMany({
    offset: options && options.offset,
    limit: options && options.length,
    with: {
      paidBy: true,
      category: true,
      documents: true,
      paidFor: {
        with: {
          participant: true,
        },
      },
    },
    where: {
      groupId,
      title: options?.filter ? { ilike: `%${options.filter}%` } : undefined,
    },
    orderBy: {
      expenseDate: 'desc',
      createdAt: 'desc',
    },
  })

  const expenseIds = expenses.map((expense) => expense.id)

  const documentsPerExpense = await db
    .select({
      expenseId: schema.expense.id,
      expenseDocumentCount: count(schema.expenseDocument.id),
    })
    .from(schema.expense)
    .where(inArray(schema.expense.id, expenseIds))
    .leftJoin(
      schema.expenseDocument,
      eq(schema.expenseDocument.expenseId, schema.expense.id),
    )
    .groupBy(schema.expense.id)

  const documentsPerExpenseMap = new Map(
    documentsPerExpense.map((obj) => [obj.expenseId, obj.expenseDocumentCount]),
  )

  return expenses.map((expense) => {
    const documentCount = documentsPerExpenseMap.get(expense.id)
    if (documentCount === undefined) {
      throw new Error(
        `Could not count the number of documents for expense ${expense.id}`,
      )
    }
    return {
      ...expense,
      _count: {
        documents: documentCount,
      },
    }
  })
}

export async function getGroupExpenseCount(groupId: string) {
  const db = getDb()
  return db.$count(schema.expense, eq(schema.expense.groupId, groupId))
}

export async function getExpense(groupId: string, expenseId: string) {
  const db = getDb()
  return db.query.expense.findFirst({
    where: {
      id: expenseId,
    },
    with: {
      paidBy: true,
      paidFor: true,
      category: true,
      documents: true,
      recurringExpenseLink: true,
    },
  })
}

export async function getActivities(
  groupId: string,
  options?: { offset?: number; length?: number },
) {
  const db = getDb()

  const activities = await db.query.activity.findMany({
    where: {
      groupId: groupId,
    },
    offset: options?.offset,
    limit: options?.length,
    orderBy: {
      time: 'desc',
    },
  })

  const expenseIds = activities
    .map((activity) => activity.expenseId)
    .filter((expenseId): expenseId is string => expenseId !== null)

  const expenses = await db.query.expense.findMany({
    where: {
      groupId: groupId,
      id: { in: expenseIds },
    },
  })

  return activities.map((activity) => ({
    ...activity,
    expense:
      activity.expenseId !== null
        ? expenses.find((expense) => expense.id === activity.expenseId)
        : undefined,
  }))
}

export function makeLogActivityStatement(
  groupId: string,
  activityType: ActivityType,
  extra?: { participantId?: string; expenseId?: string; data?: string },
) {
  const db = getDb()
  const id = randomId()
  return db.insert(schema.activity).values({
    id,
    groupId,
    activityType,
    participantId: extra?.participantId ?? null,
    expenseId: extra?.expenseId ?? null,
    data: extra?.data ?? null,
  })
}

async function createRecurringExpenses() {
  const db = getDb()

  const localDate = new Date() // Current local date
  const utcDateFromLocal = new Date(
    Date.UTC(
      localDate.getUTCFullYear(),
      localDate.getUTCMonth(),
      localDate.getUTCDate(),
      // More precision beyond date is required to ensure that recurring Expenses are created within <most precises unit> of when expected
      localDate.getUTCHours(),
      localDate.getUTCMinutes(),
    ),
  )

  const recurringExpenseLinksWithExpensesToCreate =
    await db.query.recurringExpenseLink.findMany({
      where: {
        nextExpenseCreatedAt: {
          isNull: true,
        },
        nextExpenseDate: {
          lte: utcDateFromLocal,
        },
      },
      with: {
        currentFrameExpense: {
          with: {
            paidBy: true,
            paidFor: true,
            category: true,
            documents: true,
          },
        },
      },
    })

  for (const recurringExpenseLink of recurringExpenseLinksWithExpensesToCreate) {
    let newExpenseDate = recurringExpenseLink.nextExpenseDate

    let currentExpenseRecord = recurringExpenseLink.currentFrameExpense
    let currentReccuringExpenseLinkId = recurringExpenseLink.id

    while (newExpenseDate < utcDateFromLocal) {
      if (currentExpenseRecord === null) {
        throw new Error(`Something went wrong: 'currentExpenseRecord' is null`)
      }

      const newExpenseId = randomId()
      const newRecurringExpenseLinkId = randomId()

      const newRecurringExpenseNextExpenseDate = calculateNextDate(
        currentExpenseRecord.recurrenceRule as RecurrenceRule,
        newExpenseDate,
      )

      const {
        category,
        paidBy,
        paidFor,
        documents,
        ...destructeredCurrentExpenseRecord
      } = currentExpenseRecord

      // Use a transacton to ensure that the only one expense is created for the RecurringExpenseLink
      // just in case two clients are processing the same RecurringExpenseLink at the same time

      const existingExpenseDocumentIds = currentExpenseRecord.documents.map(
        (document) => document.id,
      )
      await db.batch([
        db.insert(schema.expense).values({
          ...destructeredCurrentExpenseRecord,
          createdAt: utcDateFromLocal,
          categoryId: currentExpenseRecord.categoryId,
          paidById: currentExpenseRecord.paidById,
          id: newExpenseId,
          expenseDate: newExpenseDate,
        }),
        db.insert(schema.expensePaidFor).values(
          currentExpenseRecord.paidFor.map((paidFor) => ({
            expenseId: newExpenseId,
            participantId: paidFor.participantId,
            shares: paidFor.shares,
            documents: existingExpenseDocumentIds,
          })),
        ),
        db
          .update(schema.expenseDocument)
          .set({ expenseId: newExpenseId })
          .where(
            inArray(
              schema.expenseDocument.id,
              currentExpenseRecord.documents.map((document) => document.id),
            ),
          ),
        db.insert(schema.recurringExpenseLink).values({
          id: newRecurringExpenseLinkId,
          groupId: currentExpenseRecord.groupId,
          currentFrameExpenseId: newExpenseId,
          nextExpenseDate: newRecurringExpenseNextExpenseDate,
        }),

        // Mark the RecurringExpenseLink as being "completed" since the new Expense was created
        // if an expense hasn't been created for this RecurringExpenseLink yet
        db
          .update(schema.recurringExpenseLink)
          .set({
            nextExpenseCreatedAt: utcDateFromLocal,
          })
          .where(
            and(
              eq(schema.recurringExpenseLink.id, currentReccuringExpenseLinkId),
              isNull(schema.recurringExpenseLink.nextExpenseCreatedAt),
            ),
          ),
      ])

      /*
       if (frame.paidFor.length > 0) {
          await
        }

        if (frame.documentIds.length > 0) {
          await tx
            .update(expenseDocumentTable)
            .set({ expenseId: newExpenseId })
            .where(inArray(expenseDocumentTable.id, frame.documentIds))
        }

        await tx.insert(recurringExpenseLinkTable).values({
          id: newRecurringExpenseLinkId,
          groupId: frame.groupId,
          currentFrameExpenseId: newExpenseId,
          nextExpenseDate: newRecurringExpenseNextExpenseDate,
        })

        await tx
          .update(recurringExpenseLinkTable)
          .set({ nextExpenseCreatedAt: utcDateFromLocal })
          .where(
            and(
              eq(recurringExpenseLinkTable.id, currentRecurringExpenseLinkId),
              isNull(recurringExpenseLinkTable.nextExpenseCreatedAt),
            ),
          )
       */

      const createdExpense = await getRecurringExpenseFrame(newExpenseId)
      if (createdExpense === undefined) {
        break
      }

      // Set the values for the next iteration of the for-loop in case multiple recurring Expenses need to be created
      currentExpenseRecord = createdExpense
      currentReccuringExpenseLinkId = newRecurringExpenseLinkId
      newExpenseDate = newRecurringExpenseNextExpenseDate
    }
  }
}

async function getRecurringExpenseFrame(expenseId: string) {
  const db = getDb()

  return db.query.expense.findFirst({
    where: {
      id: expenseId,
    },
    with: {
      paidFor: true,
      documents: true,
      paidBy: true,
      category: true,
    },
  })
}

function createPayloadForNewRecurringExpenseLink(
  recurrenceRule: RecurrenceRule,
  priorDateToNextRecurrence: Date,
  groupId: string,
  expenseId: string,
): {
  id: string
  groupId: string
  nextExpenseDate: Date
  currentFrameExpenseId: string
} {
  const nextExpenseDate = calculateNextDate(
    recurrenceRule,
    priorDateToNextRecurrence,
  )
  return {
    id: randomId(),
    groupId: groupId,
    nextExpenseDate: nextExpenseDate,
    currentFrameExpenseId: expenseId,
  }
}

function calculateNextDate(
  recurrenceRule: RecurrenceRule,
  priorDateToNextRecurrence: Date,
): Date {
  const nextDate = new Date(priorDateToNextRecurrence)

  switch (recurrenceRule) {
    case RecurrenceRule.DAILY:
      nextDate.setUTCDate(nextDate.getUTCDate() + 1)
      break
    case RecurrenceRule.WEEKLY:
      nextDate.setUTCDate(nextDate.getUTCDate() + 7)
      break
    case RecurrenceRule.MONTHLY: {
      const nextYear = nextDate.getUTCFullYear()
      const nextMonth = nextDate.getUTCMonth() + 1
      let nextDay = nextDate.getUTCDate()

      while (!isDateInNextMonth(nextYear, nextMonth, nextDay)) {
        nextDay -= 1
      }

      nextDate.setUTCMonth(nextMonth, nextDay)
      break
    }
    case RecurrenceRule.NONE:
      break
  }

  return nextDate
}

function isDateInNextMonth(
  utcYear: number,
  utcMonth: number,
  utcDate: number,
): boolean {
  const testDate = new Date(Date.UTC(utcYear, utcMonth, utcDate))
  return testDate.getUTCDate() === utcDate
}
