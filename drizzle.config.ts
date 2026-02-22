import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

const sqliteUrl = process.env.SQLITE_URL

if (!sqliteUrl) {
  throw new Error('Missing SQLITE_URL in environment for drizzle-kit')
}

export default defineConfig({
  dialect: 'sqlite',
  out: './drizzle/migrations',
  schema: './src/db/schema.ts',
  dbCredentials: {
    url: sqliteUrl,
  },
  verbose: true,
  strict: true,
})
