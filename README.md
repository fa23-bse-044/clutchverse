# ClutchVerse

ClutchVerse is an independent esports community and tournament platform for
PUBG MOBILE, Free Fire, TEKKEN 8, and EA SPORTS FC. The workspace contains a
Next.js web app, a separate Socket.IO service, shared domain/UI packages, and a
Prisma/PostgreSQL data layer.

> **Project status:** this is a working product foundation, not a claim that
> every feature in the original product brief is production-complete. See
> [CHECKLIST.md](./CHECKLIST.md) for implemented scope, integration-dependent
> behavior, and remaining work.

## Requirements

- Node.js 20+
- Corepack with pnpm 9.15.5
- PostgreSQL 16+
- Redis 7+ for cross-process ranking events and Socket.IO scaling (optional for
  local UI and database-backed ranking reads)
- Docker Compose, if you want to run the local PostgreSQL/Redis services

## Local development

1. Install dependencies and create your local environment file:

   ```sh
   corepack pnpm install
   cp .env.example .env.local
   ```

2. Edit `.env.local` and set a unique `AUTH_SECRET` (at least 32 characters).
   Generate one with `openssl rand -base64 32`; `NEXTAUTH_SECRET` is accepted as
   a fallback. Next.js reads `.env` and `.env.local` from the web app directory,
   not the repository root. The example database and Redis URLs match the
   included Compose services. Load the root environment file into the current
   shell before running workspace commands:

   ```sh
   set -a
   . ./.env.local
   set +a
   ```

   Repeat the shell loading step in each terminal. Keep `.env.local` private and
   untracked. OAuth, Stripe, Resend, and S3-compatible credentials are optional
   and only needed to activate those integrations.

3. Start local services (skip this if you have your own PostgreSQL/Redis):

   ```sh
   docker compose up -d --wait postgres redis
   ```

4. Create/update the local database schema and seed sample records:

   ```sh
   corepack pnpm --filter @clutchverse/db db:push
   corepack pnpm --filter @clutchverse/db db:seed
   ```

   To create a local admin during seeding, set `SEED_ADMIN_EMAIL` and
   `SEED_ADMIN_PASSWORD` in `.env.local`; the password must be at least 16 characters.
   Seeded player accounts are showcase data, not login accounts.

5. Start the web app and realtime service in separate terminals. Load `.env.local` in
   each terminal first:

   ```sh
   corepack pnpm --filter @clutchverse/web dev
   ```

   ```sh
   corepack pnpm --filter @clutchverse/realtime dev
   ```

   Open <http://localhost:3000>. If `REDIS_URL` is absent, realtime features
   operate only inside the running process; ranking reads use PostgreSQL.

## Workspace commands

Run from the repository root:

```sh
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm test:e2e
```

For isolated remote integration testing, put disposable test-only service URLs
in the ignored root `.env.test`, including `DATABASE_URL`, `DIRECT_URL`, and
`REDIS_URL`. Next.js does not automatically load `.env.test`; explicitly load
it in each terminal with `set -a; . ./.env.test; set +a` before schema
deployment, seeding, or running the app/tests. Never use production databases
or commit this file.

The Playwright suite requires reachable PostgreSQL and Redis services, a seeded
schema, and Chromium. Start the Compose services, then prepare the database
before running it:

```sh
docker compose up -d --wait postgres redis
corepack pnpm --filter @clutchverse/db db:push
corepack pnpm --filter @clutchverse/db db:seed
corepack pnpm --filter @clutchverse/web exec playwright install --with-deps chromium
corepack pnpm test:e2e
```

`pnpm test` runs domain unit tests; `pnpm test:e2e` exercises browser-driven
authentication, tournament registration/check-in, realtime rankings, chat,
and team invitations. `pnpm --filter @clutchverse/db db:generate` regenerates
Prisma Client after schema changes.

## Languages and FAQs

The navigation language menu supports English, Urdu, Arabic, Simplified
Chinese, Hindi, and Spanish. The selection is saved in a browser cookie and
local storage; signed-in users also save it to their profile. Urdu and Arabic
set the document direction to RTL, and the root layout reads the locale cookie
on the server to render the selected `lang` and `dir`. Message catalogs live in
`apps/web/src/i18n/messages/`; unsupported/missing message entries fall back to
English for unsupported locale selections; catalog key completeness is checked
by TypeScript. The navigation/footer, FAQ page, and AI chat widget have localized
messages. Translation coverage for all other page content, including all
game-specific rules, is still in progress.

Visit `/faq` for searchable questions grouped by account, tournaments,
payments, streaming, fair play, and technical support. The page includes
localized FAQ structured data.

## Environment variables

| Variable                                                                            | Purpose                                                                                                          |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                                      | PostgreSQL connection string used by Prisma                                                                      |
| `DIRECT_URL`                                                                        | Direct PostgreSQL connection used by Prisma schema deployment; use the non-pooled endpoint                       |
| `REDIS_URL`                                                                         | Redis connection for realtime scaling, ranking sorted sets, and ranking pub/sub                                  |
| `AUTH_SECRET` / `NEXTAUTH_SECRET`                                                   | Auth.js secret; generate with `openssl rand -base64 32`                                                          |
| `AUTH_URL`                                                                          | Canonical web origin for Auth.js                                                                                 |
| `WEB_ORIGIN`                                                                        | Allowed web origin for the Socket.IO server                                                                      |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`                                          | Optional local seed admin; password must be 16+ characters                                                       |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`                                         | Optional Google OAuth credentials                                                                                |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`                                       | Optional Discord OAuth credentials                                                                               |
| `NEXT_PUBLIC_REALTIME_URL`                                                          | Browser-visible Socket.IO endpoint                                                                               |
| `REALTIME_PORT`                                                                     | Socket.IO listener port (default `4001`)                                                                         |
| `RESEND_API_KEY` / `EMAIL_FROM` / `CONTACT_TO_EMAIL`                                | Contact form email notification; without a key, messages are stored and delivery is marked as a development mock |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | S3-compatible storage configuration; production upload integration is not yet wired to every feature             |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`                                       | Stripe checkout and signed webhook configuration                                                                 |
| `PAYMENT_MODE`                                                                      | Payment adapter mode; demo mode does not settle or move money                                                    |
| `TWITCH_CLIENT_ID` / `YOUTUBE_API_KEY`                                              | Optional broadcast provider credentials                                                                          |
| `TWITCH_CLIENT_SECRET`                                                              | Optional Twitch Helix API secret                                                                                 |
| `LIQUIPEDIA_API_KEY` / `LIQUIPEDIA_USER_AGENT`                                      | Optional Liquipedia API access; no provider sync is enabled by default                                |
| `PANDASCORE_TOKEN`                                                                  | Optional PandaScore API token; coverage depends on the licensed plan                                   |
| `GEMINI_API_KEY` / `GEMINI_MODEL`                                                   | Optional server-only ClutchVerse AI provider key/model; default model is `gemini-flash-latest`                   |
| `DISCORD_SERVER_ID`                                                                 | Optional community invite/widget server ID                                                                       |
| `FCM_PROJECT_ID` / `FCM_CLIENT_EMAIL` / `FCM_PRIVATE_KEY`                           | Optional Firebase Cloud Messaging credentials                                                                    |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET`                                         | Optional PayPal payment adapter credentials                                                                      |
| `JAZZCASH_MERCHANT_ID` / `JAZZCASH_PASSWORD` / `EASYPAISA_STORE_ID`                 | Optional local payment provider credentials                                                                      |

Never expose provider secrets with a `NEXT_PUBLIC_` prefix. Do not use the
development seed admin settings in production.

The public contact form validates and stores submissions in PostgreSQL, limits
requests per address through Redis when available, and uses Resend for email
notifications. ClutchVerse AI is available to signed-in users when `GEMINI_API_KEY` is set in
the private root `.env.local` (or the server deployment environment). The key
is used only by the server; never use a `NEXT_PUBLIC_` prefix, paste it into
source code, or commit it. `GEMINI_MODEL` is optional and defaults to
`gemini-flash-latest`. The widget limits user requests, checks gaming-topic
scope, streams responses, and stores conversations in PostgreSQL so users can
review or delete their own history. Gemini prompts exclude profile/account
details and redact common email/phone patterns. If a provider key was exposed
in a chat, rotate it with Google before configuring it.

Twitch Helix, FCM, PayPal, JazzCash, and Easypaisa remain provider-dependent;
see [CHECKLIST.md](./CHECKLIST.md) for their current scope.

## Pro Scene data and attribution

The Pro Scene pages use a provider interface backed by the additive PostgreSQL
models and an administrator-managed event catalog. Every published event
requires an HTTPS source URL and a license/permission label; there are no
fabricated teams, players, prizes, standings, or results. Admins can add and
remove sourced events at `/admin/pro-scene`; event details and available
standings/results link back to each record's source. Empty catalogs say that
data is unavailable rather than showing demo facts.

External sync is not enabled. Liquipedia API use is subject to its official
[API terms](https://liquipedia.net/api-terms-of-use) and
[API documentation](https://liquipedia.net/api): use an approved API key,
descriptive `LIQUIPEDIA_USER_AGENT`, strict rate limiting (no more than one
request every two seconds), caching, and required CC-BY-SA attribution. Request
access from Liquipedia if credentials are required. PandaScore coverage and
access are plan-dependent; consult its
[official API documentation](https://developers.pandascore.co/) before
configuring `PANDASCORE_TOKEN`. Its documented coverage does not currently
provide a verified data source for all four ClutchVerse games. Neither provider
is scraped or queried by this implementation.

## Deployment

- **Web:** deploy `apps/web` as a Node-compatible Next.js application (for
  example, Vercel). Configure the production database, `AUTH_SECRET`,
  `AUTH_URL`, OAuth callbacks, and any enabled payment/provider secrets.
- **Realtime:** deploy `apps/realtime` as a persistent Node.js process on
  Railway, Fly.io, or a managed VPS. Configure `AUTH_SECRET`, `REDIS_URL`,
  `WEB_ORIGIN`, and `REALTIME_PORT`; set `NEXT_PUBLIC_REALTIME_URL` in the web
  build to the reachable realtime URL. Use TLS and restrict Redis to trusted
  services.
- **Database:** apply the Prisma schema with a reviewed migration workflow
  before production rollout. `db:push` is intended for local development, not
  production schema management.
- **Migration baseline:** the original schema was created with `db:push` and
  did not have a Prisma migration baseline. Existing installations must
  baseline their current schema before using `prisma migrate deploy`; do not
  apply the additive Block 1 migration to a fresh `db:push` database without
  marking that migration as already applied.
- **Storage and email:** configure private buckets, upload policy, and a
  production email adapter before exposing those workflows. Do not treat
  in-memory development adapters as durable storage or delivery.

## Game media and legal

Game background assets are original placeholder artwork and CSS treatments.
The project intentionally does not download or bundle copyrighted footage,
publisher logos, or game marks. The owner must provide licensed or
publisher-permitted footage and marks before using them. Background video paths
are configured in `apps/web/src/config/games.ts`; supply approved WebM/MP4 files
and poster assets under `apps/web/public/media/<game>/`.

ClutchVerse is an independent community and tournament site and is not
affiliated with or endorsed by Krafton, Garena, Bandai Namco, or Electronic
Arts. Game names and related marks belong to their respective publishers.
Obtain any required trademark, logo, and footage permissions before public or
commercial use.
