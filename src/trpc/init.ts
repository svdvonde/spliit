import Decimal from 'decimal.js'
import { initTRPC } from '@trpc/server'
import { cache } from 'react'
import superjson from 'superjson'

superjson.registerCustom<Decimal, string>(
  {
    isApplicable: (v): v is Decimal => Decimal.isDecimal(v),
    serialize: (v) => v.toJSON(),
    deserialize: (v) => new Decimal(v),
  },
  'decimal.js',
)

export const createTRPCContext = cache(async () => {
  /**
   * @see: https://trpc.io/docs/server/context
   */
  return {}
})

// Avoid exporting the entire t-object
// since it's not very descriptive.
// For instance, the use of a t variable
// is common in i18n libraries.
const t = initTRPC.create({
  /**
   * @see https://trpc.io/docs/server/data-transformers
   */
  transformer: superjson,
})

// Base router and procedure helpers
export const createTRPCRouter = t.router
export const baseProcedure = t.procedure
