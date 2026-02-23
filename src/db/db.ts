import { drizzle } from 'drizzle-orm/d1';
import { getCloudflareContext } from '@opennextjs/cloudflare'

export const getDb = () => {
  const processEnvDb = (process.env as any).DB as D1Database | undefined
  if (processEnvDb?.prepare) {
    return drizzle(processEnvDb)
  }

  const contextDb = getCloudflareContext().env.DB as D1Database | undefined
  if (contextDb?.prepare) {
    return drizzle(contextDb)
  }

  throw new Error('Cloudflare D1 binding "DB" is not available in the current runtime context')
}