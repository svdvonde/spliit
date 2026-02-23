import { getDb } from '@/db/db'
import {
  activity as activityTable,
  category as categoryTable,
  expenseDocument as expenseDocumentTable,
  expensePaidFor as expensePaidForTable,
  expense as expenseTable,
  group as groupTable,
  participant as participantTable,
  recurringExpenseLink as recurringExpenseLinkTable,
} from '@/db/schema'
import {
  ActivityType,
  RecurrenceRule,
  type RecurrenceRule as RecurrenceRuleType,
  type SplitMode,
} from '@/db/types'
import { ExpenseFormValues, GroupFormValues } from '@/lib/schemas'
import { and, count, desc, eq, inArray, isNull, lte, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'

export function randomId() {
  return nanoid()
}

const runTransaction = async <T>(
  db: ReturnType<typeof getDb>,
  callback: (tx: ReturnType<typeof getDb>) => Promise<T>,
): Promise<T> => {
  return callback(db)
}

export async function createGroup(groupFormValues: GroupFormValues) {
  const db = getDb()
  const groupId = randomId()

  await runTransaction(db, async (tx) => {
    await tx.insert(groupTable).values({
      id: groupId,
      name: groupFormValues.name,
      information: groupFormValues.information ?? null,
      currency: groupFormValues.currency,
      currencyCode: groupFormValues.currencyCode || null,
    })

    if (groupFormValues.participants.length > 0) {
      await tx.insert(participantTable).values(
        groupFormValues.participants.map((participant) => ({
          id: randomId(),
          groupId,
          name: participant.name,
        })),
      )
    }
  })

  const group = await getGroup(groupId)
  if (!group) throw new Error('Failed to create group')
  return group
}

export async function createExpense(
  expenseFormValues: ExpenseFormValues,
  groupId: string,
  participantId?: string,
) {
  const db = getDb()

  const group = await getGroup(groupId)
  if (!group) throw new Error(`Invalid group ID: ${groupId}`)

  for (const participant of [
    expenseFormValues.paidBy,
    ...expenseFormValues.paidFor.map((p) => p.participant),
  ]) {
    if (!group.participants.some((p) => p.id === participant)) {
      throw new Error(`Invalid participant ID: ${participant}`)
    }
  }

  const expenseId = randomId()
  const categoryId = expenseFormValues.category

  await logActivity(groupId, ActivityType.CREATE_EXPENSE, {
    participantId,
    expenseId,
    data: expenseFormValues.title,
  })

  const isCreateRecurrence =
    expenseFormValues.recurrenceRule !== RecurrenceRule.NONE

  await runTransaction(db, async (tx) => {
    await tx.insert(expenseTable).values({
      id: expenseId,
      groupId,
      expenseDate: expenseFormValues.expenseDate,
      categoryId: expenseFormValues.category,
      amount: expenseFormValues.amount,
      originalAmount: expenseFormValues.originalAmount ?? null,
      originalCurrency: expenseFormValues.originalCurrency || null,
      conversionRate: expenseFormValues.conversionRate?.toString() ?? null,
      title: expenseFormValues.title,
      paidById: expenseFormValues.paidBy,
      splitMode: expenseFormValues.splitMode,
      recurrenceRule: expenseFormValues.recurrenceRule,
      isReimbursement: expenseFormValues.isReimbursement,
      notes: expenseFormValues.notes ?? null,
    })

    if (expenseFormValues.paidFor.length > 0) {
      await tx.insert(expensePaidForTable).values(
        expenseFormValues.paidFor.map((paidFor) => ({
          expenseId,
          participantId: paidFor.participant,
          shares: paidFor.shares,
        })),
      )
    }

    if (expenseFormValues.documents.length > 0) {
      await tx.insert(expenseDocumentTable).values(
        expenseFormValues.documents.map((document) => ({
          id: document.id,
          expenseId,
          url: document.url,
          width: document.width,
          height: document.height,
        })),
      )
    }

    if (isCreateRecurrence) {
      await tx.insert(recurringExpenseLinkTable).values({
        id: randomId(),
        groupId,
        currentFrameExpenseId: expenseId,
        nextExpenseDate: calculateNextDate(
          expenseFormValues.recurrenceRule as RecurrenceRule,
          expenseFormValues.expenseDate,
        ),
      })
    }
  })

  return { id: expenseId }
}

export async function deleteExpense(
  groupId: string,
  expenseId: string,
  participantId?: string,
) {
  const db = getDb()

  const existingExpense = await getExpense(groupId, expenseId)
  await logActivity(groupId, ActivityType.DELETE_EXPENSE, {
    participantId,
    expenseId,
    data: existingExpense?.title,
  })

  await db
    .delete(expenseTable)
    .where(
      and(eq(expenseTable.id, expenseId), eq(expenseTable.groupId, groupId)),
    )
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
  if (groupIds.length === 0) return []

  const db = getDb()
  const groups = await db
    .select()
    .from(groupTable)
    .where(inArray(groupTable.id, groupIds))

  const participantCounts = await db
    .select({
      groupId: participantTable.groupId,
      participantCount: count(),
    })
    .from(participantTable)
    .where(inArray(participantTable.groupId, groupIds))
    .groupBy(participantTable.groupId)

  const countByGroupId = new Map(
    participantCounts.map((row) => [row.groupId, row.participantCount]),
  )

  return groups.map((group) => ({
    ...group,
    createdAt: group.createdAt,
    _count: {
      participants: countByGroupId.get(group.id) ?? 0,
    },
  }))
}

export async function updateExpense(
  groupId: string,
  expenseId: string,
  expenseFormValues: ExpenseFormValues,
  participantId?: string,
) {
  const db = getDb()

  const group = await getGroup(groupId)
  if (!group) throw new Error(`Invalid group ID: ${groupId}`)

  const existingExpense = await getExpense(groupId, expenseId)
  if (!existingExpense) throw new Error(`Invalid expense ID: ${expenseId}`)

  for (const participant of [
    expenseFormValues.paidBy,
    ...expenseFormValues.paidFor.map((p) => p.participant),
  ]) {
    if (!group.participants.some((p) => p.id === participant)) {
      throw new Error(`Invalid participant ID: ${participant}`)
    }
  }

  await logActivity(groupId, ActivityType.UPDATE_EXPENSE, {
    participantId,
    expenseId,
    data: expenseFormValues.title,
  })

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
    expenseFormValues.recurrenceRule as RecurrenceRule,
    existingExpense.expenseDate,
  )

  const categoryId = expenseFormValues.category

  await runTransaction(db, async (tx) => {
    await tx
      .update(expenseTable)
      .set({
        expenseDate: expenseFormValues.expenseDate,
        amount: expenseFormValues.amount,
        originalAmount: expenseFormValues.originalAmount ?? null,
        originalCurrency: expenseFormValues.originalCurrency || null,
        conversionRate: expenseFormValues.conversionRate?.toString() ?? null,
        title: expenseFormValues.title,
        categoryId,
        paidById: expenseFormValues.paidBy,
        splitMode: expenseFormValues.splitMode,
        recurrenceRule: expenseFormValues.recurrenceRule,
        isReimbursement: expenseFormValues.isReimbursement,
        notes: expenseFormValues.notes ?? null,
      })
      .where(eq(expenseTable.id, expenseId))

    for (const paidFor of expenseFormValues.paidFor) {
      await tx
        .insert(expensePaidForTable)
        .values({
          expenseId,
          participantId: paidFor.participant,
          shares: paidFor.shares,
        })
        .onConflictDoUpdate({
          target: [
            expensePaidForTable.expenseId,
            expensePaidForTable.participantId,
          ],
          set: {
            shares: paidFor.shares,
          },
        })
    }

    const participantIdsFromForm = expenseFormValues.paidFor.map(
      (paidFor) => paidFor.participant,
    )
    const participantIdsToDelete = existingExpense.paidFor
      .filter(
        (paidFor) => !participantIdsFromForm.includes(paidFor.participantId),
      )
      .map((paidFor) => paidFor.participantId)

    if (participantIdsToDelete.length > 0) {
      await tx
        .delete(expensePaidForTable)
        .where(
          and(
            eq(expensePaidForTable.expenseId, expenseId),
            inArray(expensePaidForTable.participantId, participantIdsToDelete),
          ),
        )
    }

    if (isCreateRecurrenceExpenseLink) {
      await tx.insert(recurringExpenseLinkTable).values({
        id: randomId(),
        groupId,
        currentFrameExpenseId: expenseId,
        nextExpenseDate: calculateNextDate(
          expenseFormValues.recurrenceRule as RecurrenceRule,
          expenseFormValues.expenseDate,
        ),
      })
    }

    if (isUpdateRecurrenceExpenseLink && existingExpense.recurringExpenseLink) {
      await tx
        .update(recurringExpenseLinkTable)
        .set({
          nextExpenseDate: updatedRecurrenceExpenseLinkNextExpenseDate,
        })
        .where(
          eq(
            recurringExpenseLinkTable.id,
            existingExpense.recurringExpenseLink.id,
          ),
        )
    }

    if (isDeleteRecurrenceExpenseLink && existingExpense.recurringExpenseLink) {
      await tx
        .delete(recurringExpenseLinkTable)
        .where(
          eq(
            recurringExpenseLinkTable.id,
            existingExpense.recurringExpenseLink.id,
          ),
        )
    }

    for (const document of expenseFormValues.documents) {
      await tx
        .insert(expenseDocumentTable)
        .values({
          id: document.id,
          expenseId,
          url: document.url,
          width: document.width,
          height: document.height,
        })
        .onConflictDoUpdate({
          target: expenseDocumentTable.id,
          set: {
            expenseId,
            url: document.url,
            width: document.width,
            height: document.height,
          },
        })
    }

    const currentDocumentIds = existingExpense.documents.map(
      (document) => document.id,
    )
    const nextDocumentIds = expenseFormValues.documents.map(
      (document) => document.id,
    )
    const documentIdsToDelete = currentDocumentIds.filter(
      (id) => !nextDocumentIds.includes(id),
    )

    if (documentIdsToDelete.length > 0) {
      await tx
        .delete(expenseDocumentTable)
        .where(
          and(
            eq(expenseDocumentTable.expenseId, expenseId),
            inArray(expenseDocumentTable.id, documentIdsToDelete),
          ),
        )
    }
  })

  return { id: expenseId }
}

export async function updateGroup(
  groupId: string,
  groupFormValues: GroupFormValues,
  participantId?: string,
) {
  const db = getDb()

  const existingGroup = await getGroup(groupId)
  if (!existingGroup) throw new Error('Invalid group ID')

  await logActivity(groupId, ActivityType.UPDATE_GROUP, { participantId })

  await runTransaction(db, async (tx) => {
    await tx
      .update(groupTable)
      .set({
        name: groupFormValues.name,
        information: groupFormValues.information ?? null,
        currency: groupFormValues.currency,
        currencyCode: groupFormValues.currencyCode || null,
      })
      .where(eq(groupTable.id, groupId))

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

    if (participantIdsToDelete.length > 0) {
      await tx
        .delete(participantTable)
        .where(
          and(
            eq(participantTable.groupId, groupId),
            inArray(participantTable.id, participantIdsToDelete),
          ),
        )
    }

    for (const participant of nextParticipantsWithIds) {
      await tx
        .update(participantTable)
        .set({ name: participant.name })
        .where(
          and(
            eq(participantTable.groupId, groupId),
            eq(participantTable.id, participant.id),
          ),
        )
    }

    const newParticipants = groupFormValues.participants
      .filter((participant) => participant.id === undefined)
      .map((participant) => ({
        id: randomId(),
        groupId,
        name: participant.name,
      }))

    if (newParticipants.length > 0) {
      await tx.insert(participantTable).values(newParticipants)
    }
  })
}

export async function getGroup(groupId: string) {
  const db = getDb()

  const rows = await db
    .select()
    .from(groupTable)
    .where(eq(groupTable.id, groupId))
    .limit(1)
  const group = rows[0]
  if (!group) return null

  const participants = await db
    .select()
    .from(participantTable)
    .where(eq(participantTable.groupId, groupId))

  return {
    ...group,
    participants,
  }
}

export async function getCategories() {
  const db = getDb()
  return db
    .select()
    .from(categoryTable)
    .orderBy(categoryTable.grouping, categoryTable.name)
}

export async function getGroupExpenses(
  groupId: string,
  options?: { offset?: number; length?: number; filter?: string },
) {
  const db = getDb()

  await createRecurringExpenses()

  const filter = options?.filter?.trim().toLowerCase()
  const whereClause = filter
    ? and(
        eq(expenseTable.groupId, groupId),
        sql`lower(${expenseTable.title}) like ${`%${filter}%`}`,
      )
    : eq(expenseTable.groupId, groupId)

  const expenses = await db
    .select()
    .from(expenseTable)
    .where(whereClause)
    .orderBy(desc(expenseTable.expenseDate), desc(expenseTable.createdAt))
    .offset(options?.offset ?? 0)
    .limit(options?.length ?? 1000)

  if (expenses.length === 0) return []

  const expenseIds = expenses.map((expense) => expense.id)

  const categories = await db
    .select()
    .from(categoryTable)
    .where(
      inArray(
        categoryTable.id,
        Array.from(new Set(expenses.map((expense) => expense.categoryId))),
      ),
    )

  const participants = await db
    .select()
    .from(participantTable)
    .where(
      inArray(
        participantTable.id,
        Array.from(new Set(expenses.map((expense) => expense.paidById))),
      ),
    )

  const paidFors = await db
    .select({
      expenseId: expensePaidForTable.expenseId,
      participantId: expensePaidForTable.participantId,
      shares: expensePaidForTable.shares,
      participantName: participantTable.name,
    })
    .from(expensePaidForTable)
    .innerJoin(
      participantTable,
      eq(participantTable.id, expensePaidForTable.participantId),
    )
    .where(inArray(expensePaidForTable.expenseId, expenseIds))

  const documentCounts = await db
    .select({
      expenseId: expenseDocumentTable.expenseId,
      documentCount: count(),
    })
    .from(expenseDocumentTable)
    .where(inArray(expenseDocumentTable.expenseId, expenseIds))
    .groupBy(expenseDocumentTable.expenseId)

  const categoriesById = new Map(
    categories.map((category) => [category.id, category]),
  )
  const participantsById = new Map(
    participants.map((participant) => [participant.id, participant]),
  )
  const paidForByExpenseId = new Map<string, Array<(typeof paidFors)[number]>>()
  const documentCountByExpenseId = new Map(
    documentCounts
      .filter(
        (row): row is { expenseId: string; documentCount: number } =>
          row.expenseId !== null,
      )
      .map((row) => [row.expenseId, row.documentCount]),
  )

  for (const paidFor of paidFors) {
    const list = paidForByExpenseId.get(paidFor.expenseId) ?? []
    list.push(paidFor)
    paidForByExpenseId.set(paidFor.expenseId, list)
  }

  return expenses.map((expense) => ({
    id: expense.id,
    title: expense.title,
    amount: expense.amount,
    originalAmount: expense.originalAmount,
    originalCurrency: expense.originalCurrency,
    conversionRate: expense.conversionRate,
    paidById: expense.paidById,
    category: categoriesById.get(expense.categoryId) ?? null,
    createdAt: expense.createdAt,
    expenseDate: expense.expenseDate,
    isReimbursement: expense.isReimbursement,
    paidBy: (() => {
      const participant = participantsById.get(expense.paidById)
      return {
        id: participant?.id ?? expense.paidById,
        name: participant?.name ?? 'Unknown',
      }
    })(),
    paidFor: (paidForByExpenseId.get(expense.id) ?? []).map((paidFor) => ({
      shares: paidFor.shares,
      participant: {
        id: paidFor.participantId,
        name: paidFor.participantName,
      },
    })),
    splitMode: expense.splitMode as SplitMode,
    recurrenceRule: (expense.recurrenceRule ??
      RecurrenceRule.NONE) as RecurrenceRuleType,
    _count: {
      documents: documentCountByExpenseId.get(expense.id) ?? 0,
    },
  }))
}

export async function getGroupExpenseCount(groupId: string) {
  const db = getDb()
  const result = await db
    .select({ count: count() })
    .from(expenseTable)
    .where(eq(expenseTable.groupId, groupId))

  return result[0]?.count ?? 0
}

export async function getExpense(groupId: string, expenseId: string) {
  const db = getDb()

  const expenseRows = await db
    .select()
    .from(expenseTable)
    .where(
      and(eq(expenseTable.id, expenseId), eq(expenseTable.groupId, groupId)),
    )
    .limit(1)

  const expense = expenseRows[0]
  if (!expense) return null

  const paidByRows = await db
    .select()
    .from(participantTable)
    .where(eq(participantTable.id, expense.paidById))
    .limit(1)

  const paidFor = await db
    .select()
    .from(expensePaidForTable)
    .where(eq(expensePaidForTable.expenseId, expenseId))

  const categoryRows = await db
    .select()
    .from(categoryTable)
    .where(eq(categoryTable.id, expense.categoryId))
    .limit(1)

  const documents = await db
    .select()
    .from(expenseDocumentTable)
    .where(eq(expenseDocumentTable.expenseId, expenseId))

  const recurringLinkRows = await db
    .select()
    .from(recurringExpenseLinkTable)
    .where(eq(recurringExpenseLinkTable.currentFrameExpenseId, expenseId))
    .limit(1)

  const recurringLink = recurringLinkRows[0]

  return {
    ...expense,
    createdAt: expense.createdAt,
    expenseDate: expense.expenseDate,
    isReimbursement: expense.isReimbursement,
    splitMode: expense.splitMode as SplitMode,
    recurrenceRule: (expense.recurrenceRule ??
      RecurrenceRule.NONE) as RecurrenceRuleType,
    paidBy: paidByRows[0] ?? null,
    paidFor,
    category: categoryRows[0] ?? null,
    documents,
    recurringExpenseLink: recurringLink
      ? {
          ...recurringLink,
          nextExpenseDate: recurringLink.nextExpenseDate,
          nextExpenseCreatedAt: recurringLink.nextExpenseCreatedAt
            ? recurringLink.nextExpenseCreatedAt
            : null,
        }
      : null,
  }
}

/*
export async function getActivities(
  groupId: string,
  options?: { offset?: number; length?: number },
) {
  const activities = await prisma.activity.findMany({
    where: { groupId },
    orderBy: [{ time: 'desc' }],
    skip: options?.offset,
    take: options?.length,
  })

  const expenseIds = activities
    .map((activity) => activity.expenseId)
    .filter(Boolean)
  const expenses = await prisma.expense.findMany({
    where: {
      groupId,
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
*/

export async function getActivities(
  groupId: string,
  options?: { offset?: number; length?: number },
) {
  const db = getDb()

  const activities = await db
    .select()
    .from(activityTable)
    .where(eq(activityTable.groupId, groupId))
    .orderBy(desc(activityTable.time))
    .offset(options?.offset ?? 0)
    .limit(options?.length ?? Number.POSITIVE_INFINITY)

  const expenseIds = activities
    .map((activity) => activity.expenseId)
    .filter((expenseId): expenseId is string => expenseId !== null)

  const expenses = expenseIds.length
    ? await db
        .select()
        .from(expenseTable)
        .where(
          and(
            eq(expenseTable.groupId, groupId),
            inArray(expenseTable.id, expenseIds),
          ),
        )
    : []

  const expensesById = new Map(expenses.map((expense) => [expense.id, expense]))

  return activities.map((activity) => ({
    ...activity,
    time: activity.time,
    expense:
      activity.expenseId !== null
        ? expensesById.get(activity.expenseId)
        : undefined,
  }))
}

export async function logActivity(
  groupId: string,
  activityType: ActivityType,
  extra?: { participantId?: string; expenseId?: string; data?: string },
) {
  const db = getDb()
  const id = randomId()
  await db.insert(activityTable).values({
    id,
    groupId,
    activityType,
    participantId: extra?.participantId ?? null,
    expenseId: extra?.expenseId ?? null,
    data: extra?.data ?? null,
  })

  return { id }
}

async function getRecurringExpenseFrame(expenseId: string) {
  const db = getDb()

  const expenseRows = await db
    .select()
    .from(expenseTable)
    .where(eq(expenseTable.id, expenseId))
    .limit(1)

  const expense = expenseRows[0]
  if (!expense) return null

  const paidFor = await db
    .select()
    .from(expensePaidForTable)
    .where(eq(expensePaidForTable.expenseId, expenseId))

  const documents = await db
    .select({ id: expenseDocumentTable.id })
    .from(expenseDocumentTable)
    .where(eq(expenseDocumentTable.expenseId, expenseId))

  return {
    ...expense,
    expenseDate: expense.expenseDate,
    createdAt: expense.createdAt,
    paidFor,
    documentIds: documents.map((document) => document.id),
  }
}

async function createRecurringExpenses() {
  const db = getDb()

  const localDate = new Date()
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

  const recurringLinks = await db
    .select()
    .from(recurringExpenseLinkTable)
    .where(
      and(
        isNull(recurringExpenseLinkTable.nextExpenseCreatedAt),
        lte(recurringExpenseLinkTable.nextExpenseDate, utcDateFromLocal),
      ),
    )

  for (const recurringLink of recurringLinks) {
    let newExpenseDate = recurringLink.nextExpenseDate
    let currentRecurringExpenseLinkId = recurringLink.id

    let currentExpenseRecord = await getRecurringExpenseFrame(
      recurringLink.currentFrameExpenseId,
    )

    if (!currentExpenseRecord) {
      continue
    }

    while (newExpenseDate < utcDateFromLocal) {
      const recurrenceRule =
        (currentExpenseRecord.recurrenceRule as RecurrenceRule | null) ??
        RecurrenceRule.NONE

      if (recurrenceRule === RecurrenceRule.NONE) {
        break
      }

      const newExpenseId = randomId()
      const newRecurringExpenseLinkId = randomId()

      const newRecurringExpenseNextExpenseDate = calculateNextDate(
        recurrenceRule,
        newExpenseDate,
      )

      const frame = currentExpenseRecord

      const created = await runTransaction(db, async (tx) => {
        await tx.insert(expenseTable).values({
          id: newExpenseId,
          groupId: frame.groupId,
          expenseDate: newExpenseDate,
          title: frame.title,
          categoryId: frame.categoryId,
          amount: frame.amount,
          originalAmount: frame.originalAmount,
          originalCurrency: frame.originalCurrency,
          conversionRate: frame.conversionRate,
          paidById: frame.paidById,
          isReimbursement: frame.isReimbursement,
          splitMode: frame.splitMode,
          notes: frame.notes,
          recurrenceRule: frame.recurrenceRule,
        })

        if (frame.paidFor.length > 0) {
          await tx.insert(expensePaidForTable).values(
            frame.paidFor.map((paidFor) => ({
              expenseId: newExpenseId,
              participantId: paidFor.participantId,
              shares: paidFor.shares,
            })),
          )
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
        return true
      }).catch(() => {
        console.error(
          'Failed to create recurring expense for expenseId: %s',
          currentExpenseRecord?.id,
        )
        return false
      })

      if (!created) {
        break
      }

      const nextExpenseRecord = await getRecurringExpenseFrame(newExpenseId)
      if (!nextExpenseRecord) {
        break
      }

      currentExpenseRecord = nextExpenseRecord
      currentRecurringExpenseLinkId = newRecurringExpenseLinkId
      newExpenseDate = newRecurringExpenseNextExpenseDate
    }
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
