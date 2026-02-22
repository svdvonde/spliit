import type { InferSelectModel } from 'drizzle-orm'

import { activity, category, group, participant } from './schema'

export const SplitMode = {
  EVENLY: 'EVENLY',
  BY_SHARES: 'BY_SHARES',
  BY_PERCENTAGE: 'BY_PERCENTAGE',
  BY_AMOUNT: 'BY_AMOUNT',
} as const

export const SplitModeValues = Object.values(SplitMode) as [
  SplitMode,
  ...SplitMode[],
]

export type SplitMode = (typeof SplitMode)[keyof typeof SplitMode]

export const RecurrenceRule = {
  NONE: 'NONE',
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
} as const

export const RecurrenceRuleValues = Object.values(RecurrenceRule) as [
  RecurrenceRule,
  ...RecurrenceRule[],
]

export type RecurrenceRule =
  (typeof RecurrenceRule)[keyof typeof RecurrenceRule]

export const ActivityType = {
  UPDATE_GROUP: 'UPDATE_GROUP',
  CREATE_EXPENSE: 'CREATE_EXPENSE',
  UPDATE_EXPENSE: 'UPDATE_EXPENSE',
  DELETE_EXPENSE: 'DELETE_EXPENSE',
} as const

export type ActivityType = (typeof ActivityType)[keyof typeof ActivityType]

export type Group = InferSelectModel<typeof group>
export type Participant = InferSelectModel<typeof participant>
export type Category = InferSelectModel<typeof category>
export type Activity = InferSelectModel<typeof activity>
