import { createClient } from '@libsql/client'
import { drizzle as drizzleD1 } from 'drizzle-orm/d1'
import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql'

import { env } from '@/lib/env'

import * as schema from './schema'

export const createD1Db = (binding: Parameters<typeof drizzleD1>[0]) =>
	drizzleD1(binding, { schema })

export const createDb = createD1Db

let localDb: ReturnType<typeof drizzleLibsql> | null = null

export const getLocalDb = () => {
	if (localDb) {
		return localDb
	}

	if (!env.SQLITE_URL) {
		throw new Error('SQLITE_URL is required for local Drizzle database usage.')
	}

	const client = createClient({ url: env.SQLITE_URL })
	localDb = drizzleLibsql(client, { schema })
	return localDb
}