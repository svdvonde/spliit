import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { relations } from './relations';



export const getDb = () => {
  const processEnvDb = (process.env as any).DB as D1Database | undefined
  if (processEnvDb?.prepare) {
    return drizzle(processEnvDb, { relations })
  }

  const contextDb = getCloudflareContext().env.DB as D1Database | undefined
  if (contextDb?.prepare) {
    return drizzle(contextDb, { relations })
  }

  throw new Error('Cloudflare D1 binding "DB" is not available in the current runtime context')
}