import { D1Helper } from '@nerdfolio/drizzle-d1-helpers';
import { defineConfig } from 'drizzle-kit';

const crawledDbHelper = D1Helper.get('DB')
const isProd = () => process.env.NODE_ENV === 'production'

const getCredentials = () => {
  const prod = {
    driver: 'd1-http',
    dbCredentials: {
      ...crawledDbHelper.withCfCredentials(
        process.env.CLOUDFLARE_ACCOUNT_ID,
        process.env.CLOUDFLARE_D1_API_TOKEN,
      ).proxyCredentials,
    },
  }

  const dev = {
    dbCredentials: {
      url: crawledDbHelper.sqliteLocalFileCredentials.url,
    },
  }
  return isProd() ? prod : dev
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'sqlite',
  ...getCredentials(),
})