import { getGroup, getGroupExpenses } from '@/lib/api'
import contentDisposition from 'content-disposition'
import { NextResponse } from 'next/server'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const { groupId } = await params
  const group = await getGroup(groupId)
  if (!group) {
    return NextResponse.json({ error: 'Invalid group ID' }, { status: 404 })
  }

  const expenses = await getGroupExpenses(groupId, { length: 100_000 })
  const sortedExpenses = [...expenses].sort(
    (a, b) =>
      a.expenseDate.getTime() - b.expenseDate.getTime() ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  )

  const payload = {
    id: group.id,
    name: group.name,
    currency: group.currency,
    currencyCode: group.currencyCode,
    participants: group.participants.map((participant) => ({
      id: participant.id,
      name: participant.name,
    })),
    expenses: sortedExpenses.map((expense) => ({
      createdAt: expense.createdAt,
      expenseDate: expense.expenseDate,
      title: expense.title,
      category: expense.category
        ? {
            grouping: expense.category.grouping,
            name: expense.category.name,
          }
        : null,
      amount: expense.amount,
      originalAmount: expense.originalAmount,
      originalCurrency: expense.originalCurrency,
      conversionRate: expense.conversionRate,
      paidById: expense.paidById,
      paidFor: expense.paidFor.map((paidFor) => ({
        participantId: paidFor.participant.id,
        shares: paidFor.shares,
      })),
      isReimbursement: expense.isReimbursement,
      splitMode: expense.splitMode,
      recurrenceRule: expense.recurrenceRule,
    })),
  }

  const date = new Date().toISOString().split('T')[0]
  const filename = `Spliit Export - ${date}`
  return NextResponse.json(payload, {
    headers: {
      'content-type': 'application/json',
      'content-disposition': contentDisposition(`${filename}.json`),
    },
  })
}
