[<img alt="Spliit" height="60" src="https://github.com/spliit-app/spliit/blob/main/public/logo-with-text.png?raw=true" />](https://spliit.app)
(on cloudflare)

Spliit is a free and open source alternative to Splitwise. This is a fork of the official [Spliit](https://github.com/spliit-app/spliit) project that has been modified to run on the [Cloudflare Workers](https://workers.cloudflare.com/pricing) free tier.

All features of Spliit-on-Cloudflare are intended to be identical to Spliit. Otherwise, I welcome contributions and bug reports that concern my modifications. For problems with Spliit, please refer to the official [Spliit](https://github.com/spliit-app/spliit) project.

## Changes Compared to Spliit

- [x] Based on Spliit `1.19.1`
- [x] Can run on the Cloudflare free tier.

## Motivation and Use Cases

Spliit is easy to deploy on Vercel (free tier) as a NextJS + Postgres application, and it remains the best way to deploy Spliit for most users. The drawback is that the Postgres database on the Vercel free tier makes the application quite slow to use (e.g., installed as a PWA on a mobile device), and I enjoy applications that go fast.

## Deploy

1. Clone the project (or fork it if you intend to contribute)
2. Initialise `.env` file (see `.env.example`)
3. Initialise `wrangler.jsonc` file (see `wrangler.jsonc.example`)
4. Run `npm install` in the project folder

You can sanity check if everything runs fine locally with the following steps.

1. Run `npm run cloudflare:migrate:local` to initialise a local database.
2. Run `npm run cloudflare:preview` to run a local version of the application. It should say something like `[wrangler:info] Ready on http://localhost:8787`, where you can test the application.

You can deploy the application on Cloudflare with the following steps.

1. Run `npm run cloudflare:migrate:remote` to initialise the remote (production) database.
2. Run `npm run cloudflare:deploy` to push the application to the Cloudflare worker.

## License

The original MIT [LICENSE](./LICENSE) applies.
