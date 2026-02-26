[<img alt="Spliit" height="60" src="https://github.com/spliit-app/spliit/blob/main/public/logo-with-text.png?raw=true" />](https://spliit.app)
(on cloudflare)

Spliit is a free and open source alternative to Splitwise. This is a fork of the official [Spliit](https://github.com/spliit-app/spliit) project that has been modified to run on the [Cloudflare Workers](https://workers.cloudflare.com/pricing) free tier.

Spliit-on-Cloudflare is intended to be identical to Spliit, with a few quality of life improvements that have not made it into the main project. I welcome contributions and bug reports that concern my modifications. For problems with Spliit, please refer to the official [Spliit](https://github.com/spliit-app/spliit) project.

## Changes Compared to Spliit

- [x] Based on Spliit `1.19.1`
- [x] Can run on the Cloudflare free tier.
- [x] Import groups from Spliit, functionality courtesy of [@Uli-Z](https://github.com/Uli-Z/spliit-room/tree/feature/generic-import) (who originally created a pull request on Spliit [here](https://github.com/spliit-app/spliit/pull/472)).

## Motivation and Use Cases

Spliit is easy to deploy on Vercel (free tier) as a NextJS + Postgres application, and it remains the best way to deploy Spliit for most users. The drawback is that the Postgres database on the Vercel free tier makes the application quite slow to use (e.g., installed as a PWA on a mobile device), and I enjoy applications that go fast.

## Deploy

1. Clone the project (or fork it if you intend to contribute)
2. Initialise `.env` file (based on `.env.example`)
3. Initialise `wrangler.jsonc` file (based on `wrangler.jsonc.example`). Set up a new Cloudflare Worker and D1 database to obtain the necessary keys and information to complete `wrangler.jsonc`).
4. Run `npm install` in the project folder

You can sanity check if everything runs fine locally with the following steps.

1. Run `npm run cloudflare:migrate:local` to initialise a local database.
2. Run `npm run cloudflare:preview` to run a local version of the application. It should say something like `[wrangler:info] Ready on http://localhost:8787`, where you can test the application.

You can deploy the application on Cloudflare with the following steps.

1. Run `npm run cloudflare:migrate:remote` to initialise the remote (production) database.
2. Run `npm run cloudflare:deploy` to push the application to the Cloudflare worker.

## Call For Contributions

I am open to contributions to improve this variant of Spliit.

- I am specifically looking for ideas or contributions to reduce the bundle size, which seems much larger than is necessary.
More importantly, it is currently _just shy_ of the maximum of 3MB required for the Cloudflare free tier.

  ```text
  Total Upload: 10214.37 KiB / gzip: 2961.55 KiB
  Worker Startup Time: 30 ms
  Your Worker has access to the following bindings:
  Binding              Resource         
  env.DB (DB)          D1 Database      
  env.ASSETS           Assets   
  ```

## License

The original MIT [LICENSE](./LICENSE) applies.
