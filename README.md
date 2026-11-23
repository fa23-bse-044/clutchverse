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
   and only needed to activate those integrations. Next.js also reads
   web-specific values from `apps/web/.env.local`; workspace commands and the
   realtime service need shared values exported from the root environment file.

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
   corepack pnpm --filter @clutchverse/web dev -- --port 3002
   ```

   ```sh
   corepack pnpm --filter @clutchverse/realtime dev
   ```

   Open <http://localhost:3002>. If `REDIS_URL` is absent, realtime features
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
| `LIQUIPEDIA_MAX_REQUESTS_PER_HOUR`                                                  | Redis-backed conservative Liquipedia request ceiling; default 60/hour, set lower to match your approved plan |
| `PANDASCORE_TOKEN`                                                                  | Optional PandaScore API token; coverage depends on the licensed plan                                   |
| `PANDASCORE_MAX_REQUESTS_PER_HOUR`                                                  | Redis-backed PandaScore request ceiling for the coverage probe; default 60/hour                       |
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

## Block D: AI coach and smart assistant

Block D extends the existing signed-in chatbot; it does not replace its
conversation history or streaming API. The `ai-coach-smart-assistant` flag is
on by default in development and off by default in production. Manage it at
`/admin/features/ai-assistant`. Apply the additive
`20261119000000_ai_coach_smart_assistant` migration before enabling.

With the flag enabled, the assistant can use the current user's confirmed
match record for coaching and match recaps, and verified upcoming tournaments
for recommendations. Team/scrim responses can use the existing team directory,
but teams are not marked as recruiting or scrim-available, so the assistant
must not claim availability. News requests produce visibly AI-generated
drafts; admins review them at `/admin/ai-drafts`. Approval is recorded but
does not publish, because the platform has no news CMS.

Signed-in users can enable or disable auto-translation in a community chat
panel. Messages are sent to Gemini only when the preference is enabled and are
translated into the user's saved profile language. Optional AI moderation
flags high-confidence messages into `/admin/ai-moderation` for moderator/admin
review. It never hides messages, bans accounts, or takes other automatic
punitive action. Chat translation and AI moderation require the server-only
`GEMINI_API_KEY`; provider calls were not tested as part of this implementation.

Twitch Helix, FCM, PayPal, JazzCash, and Easypaisa remain provider-dependent;
see [CHECKLIST.md](./CHECKLIST.md) for their current scope.

## Phase 3 search, streams, and registration

The internal search endpoint is `GET /api/search?q=&game=&type=`. It searches
available games, tournaments, teams, players, FAQs, streams, and source-backed
Pro Scene records with fuzzy ranking, optional game/type filters, rate limits,
and short Redis caching. The `/search` page and navbar command palette include
debounced input, keyboard navigation, and recent searches. News currently has
no backing content model, so it will not return news records. Search does not
scrape third-party sites.

The `/live` player supports fullscreen and theater modes (`F` toggles
fullscreen while the player or its controls are focused; `Esc` exits).
Video playback uses per-game WebM/MP4 paths and is disabled by the saved
Performance preference, reduced-motion settings, data-saver/slow-network hints,
or when the hub is not visible. The existing original placeholder remains
visible until owner-supplied media is installed.

Tournament registration validates per-game modes, roster size, platform, and
game ID format. Registration commits and capacity updates are server-confirmed;
Redis-backed updates are broadcast to tournament rooms when Redis is
configured. The current workflow does not yet include teammate invitations,
approval/payment/member-pending states, cancellation, waitlist promotion, or
organizer CSV/approval tools. See [CHECKLIST.md](./CHECKLIST.md) for the exact
implemented and remaining scope.

## Block A: match lobby and result operations

The `/matches` page lists the signed-in user's matches and their lobbies; each
per-match page is `/matches/<match-id>/lobby`. It provides match roster and
ready status, organizer-configured check-in windows and delayed private-room
reveal, lobby chat, result submissions, evidence, and dispute threads. Results
are accepted from both sides; a mismatch opens a 48-hour dispute for organizer
or moderator resolution. Confirmed single-elimination winners advance to the
next stored bracket slot. Battle-royale organizers can bulk import
`registrationId,placement,eliminations` CSV files through the existing scoring
engine. Screenshots are uploaded individually; Gemini extraction is advisory
only and never confirms a result.

The additive migration is
`packages/db/prisma/migrations/20261115000000_match_lobby_operations`.
Apply pending migrations with
`corepack pnpm --filter @clutchverse/db exec prisma migrate deploy` after
configuring `DATABASE_URL` and `DIRECT_URL`. Feature flag `match-lobby` is on
by default in development and off by default in production; an administrator
can toggle it at `/admin/features`. With Redis configured, authorized Socket.IO
subscribers receive lobby updates; clients use periodic refresh when realtime
is unavailable.

Evidence is private and served only to authorized match participants and
organizers. Development uses a private OS temporary directory. Production
requires `MATCH_EVIDENCE_DIRECTORY` to point to a durable, private mounted
volume; object-storage provisioning and backup/retention policy are operator
responsibilities. Set the server-only `GEMINI_API_KEY` to enable screenshot
suggestions; set `MATCH_VISION_GEMINI_MODEL` if a different Gemini model is
needed. Uploaded screenshots are sent to Gemini only when that key is
configured. Never use a `NEXT_PUBLIC_` prefix for the key.

## Block C: player and team analytics

The signed-in personal dashboard is available at `/analytics`. It combines
confirmed platform match results, tournament scores, and user-entered results;
each row identifies its source. Users can export CSV data, compare team and
head-to-head records, view placement and recent-result charts, and create or
revoke a public stat-card link. Shared cards expose only aggregate stats and
the public player handle. Manual results are editable only by their owner.

The `player-team-analytics` feature flag is off by default in production and
on by default in development. Administrators can manage it at
`/admin/features/analytics`. Apply the additive migration
`20261116000000_player_team_analytics` before enabling the feature. Rank
snapshots are captured when a signed-in user opens the dashboard, so history
starts with dashboard visits after deployment. K/D uses available death data;
the current platform result model does not provide deaths for all matches.
Screenshot-assisted manual result entry and historical rating backfill are not
implemented.

## Block E: creator and streamer tools

The feature-flagged Creator Studio is at `/creator`, public creator pages use
`/creator/<slug>`, and administrators manage the `creator-streamer-tools` flag
at `/admin/features/creator-tools`. In development the flag defaults on; in
production it defaults off. Apply the additive migration
`20261117000000_creator_streamer_tools` before enabling.

Creators can maintain a profile and stream schedule, request organizer approval
to co-stream a tournament, upload MP4/WebM clips with trim metadata, define
virtual channel rewards, grant viewers virtual points, and create watch
parties. Public viewers can follow creators, vote on clips, join watch parties,
and redeem rewards with virtual points only; these points have no cash value.
Follow events create in-app notifications. Clips are served only for public
creator profiles. Production uploads require `CREATOR_MEDIA_DIRECTORY` to point
to a private durable directory with backup and retention policies.

OBS browser-source URLs are generated with a random revocable token and support
`scoreboard`, `bracket`, `ticker`, `lower-third`, and `standings` types through
the `type` query parameter. Keep these URLs private; rotating or revoking the
token invalidates previous URLs. The overlay currently refreshes every ten
seconds; Socket.IO overlay event delivery, automated schedule reminders,
clip transcoding, and cloud media storage are not implemented.

## Block F: seasonal gamification and fantasy

Season play is available at `/seasonal-play`; administrators manage the
`seasonal-play` flag at `/admin/features/seasonal-play`. The flag defaults on
in development and off in production. Apply the additive migration
`20261118000000_seasonal_play` before enabling. Seasons roll over quarterly in
UTC. Daily check-in and weekly three-pick quests award XP and virtual points;
levels unlock digital-only badges, frames, and titles. Points and fantasy
scores have no cash value and cannot be purchased or withdrawn.

Members can create invite-only seasonal leagues, join by invite code, and
predict winners in future ClutchVerse matches or licensed upcoming Pro Scene
events. Picks lock when the event starts. Standings are calculated from
completed match results and sourced Pro Scene standings when the dashboard is
loaded; unconfirmed results do not score. Automated notifications and real-time
push scoring are not included.

## Pro Scene data and attribution

The Pro Scene pages use a provider interface backed by the additive PostgreSQL
models and an administrator-managed event catalog. Every published event
requires an HTTPS source URL and a license/permission label; there are no
fabricated teams, players, prizes, standings, or results. Admins can add and
remove sourced events at `/admin/pro-scene`; event details and available
standings/results link back to each record's source. Empty catalogs say that
data is unavailable rather than showing demo facts.

PMGC spotlight is available at `/games/pubg-mobile/pmgc` after an administrator
enables the `spotlight-events` feature flag and creates sourced records at
`/admin/spotlight`. It works without API keys. The additive migration is
`20261123000000_spotlight_events`; apply it through the reviewed Prisma
migration workflow before enabling the feature. No event facts are seeded.
CSV import requires `team,country,path,source_url`; every record needs a source
URL. AI imports are stored as drafts and cannot publish until an administrator
reviews and approves them. Gemini credentials remain server-only.

Liquipedia access is approval-gated. Request a key at
[Liquipedia API](https://liquipedia.net/api) and follow its
[API terms](https://liquipedia.net/api-terms-of-use). The public API page
returned HTTP 403 during implementation, so the authenticated LPDB docs and
account-specific plan limits could not be verified. **This implementation
calls no LPDB endpoints and reads no LPDB tables.** Its adapter stays disabled
until endpoint/table mappings are verified after access is granted. The terms
require obeying the approved plan's rate limit, caching results, and
CC-BY-SA 3.0 attribution. The generic adapter uses a global Redis hourly budget
(default ceiling `LIQUIPEDIA_MAX_REQUESTS_PER_HOUR=60`, fail-closed without
Redis), gzip negotiation, ETag/If-Modified-Since conditional headers, one-hour
cache, up to three exponential-backoff attempts, and a circuit breaker. Set the
ceiling no higher than the granted plan; an account plan may require a lower
limit. No polling job is enabled. When Liquipedia data is eventually used, show
the provider name, link to the exact source page, and include CC-BY-SA 3.0
attribution with a link back to Liquipedia.

PandaScore is also disabled for event data. With `PANDASCORE_TOKEN` configured,
the admin status check calls only the documented
[`GET /videogames`](https://developers.pandascore.co/reference/get_videogames)
coverage endpoint (currently `?per_page=100`) under the Redis request budget.
PUBG Mobile must be returned before coverage is reported; event, participant,
standings, match, and roster endpoint mappings remain unverified and are never
called. Do not treat a coverage match as a working event provider.

Admin changes publish through Redis channel `spotlight-events` to Socket.IO
rooms `spotlight:<slug>`. Cross-process realtime therefore requires
`REDIS_URL`; without it, saved data remains available on refetch, but no
cross-process push is delivered. The admin status screen reports provider
coverage and the most recent sourced record. Manual provider sync/background
polling is not available until mappings, rate limits, and credentials are
verified. The chatbot's read-only `get_event_spotlight` context and Ctrl+K
index cite stored sources and return “Data not available yet” for missing
facts.

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
are configured in `apps/web/src/config/games.ts`. For each game, add licensed
or publisher-media-kit footage whose terms allow this use at:

- `apps/web/public/media/pubg-mobile/bg.webm`,
  `apps/web/public/media/pubg-mobile/bg.mp4`, and
  `apps/web/public/media/pubg-mobile/poster.jpg`
- `apps/web/public/media/free-fire/bg.webm`,
  `apps/web/public/media/free-fire/bg.mp4`, and
  `apps/web/public/media/free-fire/poster.jpg`
- `apps/web/public/media/tekken-8/bg.webm`,
  `apps/web/public/media/tekken-8/bg.mp4`, and
  `apps/web/public/media/tekken-8/poster.jpg`
- `apps/web/public/media/fifa/bg.webm`,
  `apps/web/public/media/fifa/bg.mp4`, and
  `apps/web/public/media/fifa/poster.jpg`

## PMGC spotlight

The PMGC card appears on the PUBG Mobile hub only when the feature flag is
enabled. Dates, venue, prize pool, slots, stages, participants, and results
remain unknown until entered with a source URL or provided by a verified
provider. Country flags are rendered locally from ISO alpha-2 codes without
hotlinked images; team marks are initials, not unlicensed logos. The event page
uses the existing YouTube live search service and only embeds titles matching
PMGC while the stored event status is live.

The served URLs are `/media/<game>/bg.webm`, `/media/<game>/bg.mp4`, and
`/media/<game>/poster.jpg`. Do not download, copy, or bundle publisher footage;
the owner must confirm the media is licensed or from a publisher media kit
whose terms explicitly permit this use. YouTube trailers are not decorative
background media.

ClutchVerse is an independent community and tournament site and is not
affiliated with or endorsed by Krafton, Garena, Bandai Namco, or Electronic
Arts. Game names and related marks belong to their respective publishers.
Obtain any required trademark, logo, and footage permissions before public or
commercial use.
