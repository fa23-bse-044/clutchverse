# ClutchVerse delivery checklist

This checklist records the state of the implementation in this workspace.
“Implemented” means a working code path exists; it does not imply production
provider credentials, operational monitoring, or a complete end-to-end test.

## Delivered and validated

- [x] Architecture, workspace boundaries, data model, API overview, theme
      tokens, and realtime event contracts documented in `ARCHITECTURE.md`.
- [x] pnpm/Turborepo workspace with Next.js 15, TypeScript, shared packages,
      CI workflow, PostgreSQL/Redis Compose services, and documented environment.
- [x] Responsive esports landing page and routes for games, tournaments,
      rankings, teams, players, live, community, store, settings, organizer, and
      admin experiences.
- [x] Six CSS-variable themes with GPU-light theme-specific ambient
      backgrounds, performance/reduced-motion handling, and theme selection.
- [x] Persisted theme, performance, background-video, sound, and custom-cursor
      preferences in local storage and the user profile; theme hydration uses
      `next-themes` to avoid a default-theme flash.
- [x] Four game hubs with original placeholder/poster treatments and an
      optional lazy video component with poster fallback, visibility/network/
      reduced-motion handling, and per-game accents; no publisher footage or
      logos are bundled.
- [x] Auth.js credentials registration/login, Argon2 password hashing,
      optional Google/Discord providers, and server-side role checks on protected
      mutations.
- [x] Prisma models and seed data for games, players, teams, tournaments,
      rankings, chat, registrations, payments, reports, audit logs, notifications,
      and tournament round scores.
- [x] Tournament listing/creation, registration, check-in, match reports, and
      organizer/admin result resolution APIs.
- [x] Battle-royale placement/elimination scoring with idempotent round
      submissions, database ranking updates, Redis sorted-set synchronization,
      and Redis-to-Socket.IO ranking update delivery when Redis is configured.
- [x] Ranking read API with game, player/team, region, and period filters;
      PostgreSQL fallback and Redis sorted-set reads.
- [x] Persisted chat history with cursor pagination, room authorization,
      realtime messages, typing state, and reactions.
- [x] Team creation, roster display, captain invite flow, and invite
      accept/decline notifications.
- [x] In-app notifications and profile preference APIs.
- [x] Stripe checkout/webhook path with signature verification; demo payment
      behavior remains pending and cannot mark an order paid.
- [x] Core tests for bracket helpers, round-robin scheduling, scoring, Elo,
      role checks, and development adapters.
- [x] Chatbot scope classifier tests cover supported topics, unsupported-topic
      replies, prompt-override resistance, and email/phone redaction.
- [x] An earlier workspace lint, typecheck, unit-test, and production-build
      baseline passed; see the current-batch validation below for this batch's
      latest checks.
- [x] Prompt 0 runtime validation: schema deployment and seed completed against
      the disposable Neon PostgreSQL database; all four Playwright journeys
      passed against PostgreSQL and Upstash Redis, including cross-browser
      Socket.IO ranking delivery. See `runtime-validation-report.md`.
- [x] Prompt 1 visual pass: animated theme effects, preference persistence,
      video controls, page/preloader/scroll/magnetic motion, and database-backed
      landing counters implemented.
- [x] Phase 2 Block 0: `/api/stats` serves live PostgreSQL values and seeded
      fallback values with HTTP 200; both paths were smoke-tested. The client
      validates responses and retains fallback counters without console errors.
- [x] Auth.js resolves `AUTH_SECRET` with `NEXTAUTH_SECRET` fallback and checks
      for a valid secret at Node server startup; the missing-secret failure was
      verified, while production build remains possible without runtime secrets.
- [x] Phase 2 Block 1 persistence foundation: one additive Prisma migration
      added `GameRecord` and `ContactMessage`; it was applied and marked against
      the disposable PostgreSQL database, and four sample records were seeded.
- [x] Contact API smoke test saved a submission in PostgreSQL, marked the
      notification as a development mock, and removed the test submission.
      Resend delivery itself was not configured or exercised.
- [x] Six-language navigation dropdown (English, Urdu, Arabic, Simplified
      Chinese, Hindi, and Spanish) persists locale in cookie/local storage and
      signed-in profile settings; Urdu and Arabic set RTL document direction.
      Unit tests, localized SSR smoke checks, lint, typecheck, and production
      build passed; browser selection and reload retained Arabic.
- [x] Searchable FAQ page with account, tournament, payment, streaming,
      fair-play, and technical categories, localized content, and FAQ JSON-LD.
- [x] Phase 3 stream controls add fullscreen, theater mode, keyboard exit, and
      translated accessible labels; both YouTube/Twitch embeds allow the
      required fullscreen/media permissions.
- [x] Phase 3 internal search provides fuzzy grouped results, game/type
      filters, debounce, keyboard navigation, recent searches, request limits,
      and short Redis caching. News has no backing model and external Pro Scene
      sync is not enabled.
- [x] Phase 3 registration adds per-game ID/platform rules, substitute roster
      fields, case-insensitive team-name normalization, registration-window
      checks, and reduced public participant details through an additive
      migration. The migration has not been applied to a database.
- [x] Per-game video hubs use the exact media paths documented in README and
      disable playback in Performance mode; loading skeletons respect reduced
      motion and Performance mode.

## Partial or provider-dependent

- [ ] Phase 2 Block 1 UI and admin CRUD were built and production-build checked,
      but were not browser-tested. `/games` and one game hub returned HTTP 200
      while connected to PostgreSQL; rankings Socket.IO updates and authenticated
      record editing still need interaction tests.
- [ ] Phase 2 Block 4 chatbot code now includes a signed-in floating widget,
      per-user conversation storage/deletion, scoped streaming Gemini API,
      request limits, common contact-detail redaction, and scope-guard tests.
      The single Block 4 migration was applied to the disposable test PostgreSQL
      database; lint, typecheck, and unit tests pass, and the unauthenticated API
      returned 401; the production build passes. Authenticated browser
      interactions and live Gemini provider calls were not exercised. Configure
      a rotated `GEMINI_API_KEY` and optional `GEMINI_MODEL` in the server
      environment before enabling it.
- [ ] Game hub tournaments, rankings, records, spotlights, rules, and FAQs now
      use the new data/config paths. The current clip, news, and guide areas are
      not backed by a CMS or upload workflow.
- [ ] Phase 2 Blocks 2–3 and 5–7 (advanced tournament registration/engine,
      full live broadcasting and match center, admin/fair-play/wallet/store,
      full-site multilingual coverage, remaining platform features, and quality
      pass) remain incomplete.
- [ ] Multilingual foundation now localizes navigation/footer, FAQs, and AI
      chat UI in six languages, but translation coverage for all other screens,
      game rules, forms, and complete RTL/accessibility review is not finished.

- [ ] Realtime presence is process-local; Redis Socket.IO adapter distributes
      socket events, but presence accounting is not yet shared across instances.
- [ ] Redis rankings are populated by the battle-royale score endpoint; Elo
      changes are a tested domain helper but are not yet applied to resolved
      Tekken/EA FC match results.
- [ ] Tournament format helpers cover single elimination and round robin;
      double elimination, Swiss pairing, automatic tournament bracket persistence,
      full dispute lifecycle, and prize distribution remain incomplete.
- [ ] Chat has no end-to-end DM UX, image/GIF upload, mention handling,
      moderation dashboard, reporting workflow, or production-grade distributed
      rate-limit/profanity service.
- [ ] Streaming has safe provider embed resolution, but no persistent
      broadcaster dashboard, stream publishing, follow/subscribe, alerts, or VOD
      archive workflow.
- [ ] Teams and profiles are database-backed, but invites lack a complete
      roster-management and notification delivery lifecycle.
- [ ] Payment checkout is provider-backed only when Stripe is configured;
      wallet balances, withdrawals, invoices, and prize payouts are not complete.
- [ ] File storage and email have development adapter interfaces/mocks; S3/R2
      uploads and Resend delivery are not fully wired into production user flows.
- [ ] Reports can be submitted and resolved through APIs; the complete
      moderation/anti-cheat review, ban, appeal, and audit UI is not complete.
      Block A adds match-scoped evidence, disputes, and audit events.
- [ ] Admin dashboard is a protected starting point, not a complete user,
      content, payment, general feature-flag, and analytics management suite.
- [ ] Game hub, store, live, community, and news areas include working
      navigation and UI foundations, but are not complete CMS, clips, predictions,
      fantasy, quests, achievements, or commerce systems.
- [ ] The animated backgrounds and preference controls are implemented, but
      user-supplied licensed game videos were not available to validate actual
      footage playback.
- [ ] Metadata, sitemap, robots, manifest, and offline shell exist; complete
      site-wide translations/RTL review, accessibility audit, push notifications,
      and PWA offline workflows remain.
- [ ] Lighthouse targets, load tests, production-provider integration tests,
      and the GitHub Actions workflow have not been run. Docker Compose was
      unavailable, but the four Prompt 0 browser journeys passed using the
      supplied disposable hosted PostgreSQL/Redis services. See
      `runtime-validation-report.md`.

## Not included

- [ ] Licensed publisher footage, official logos, or marks (owner supplied
      only, with appropriate permissions).
- [ ] Production secrets, live OAuth/payment/email/storage accounts, and
      deployment infrastructure.

## Current batch: Phase 3 search, registration, Pro Scene, and UI

- [x] Chatbot scope supports fuzzy game-name typos and general gaming/esports
      terms, retains context for short follow-ups, allows greetings, and keeps
      prompt-injection safeguards. Live platform context includes tournaments,
      rankings, the signed-in user's registrations, cached streams, and
      source-attributed Pro Scene event records.
- [x] Tournament registration now validates mode and roster size, eligibility
      and rules attestations, region, in-game IDs, reserved/profanity-filtered
      team names, and idempotency keys. A PostgreSQL row lock serializes
      capacity checks; confirmed entries and waitlist counts are returned only
      after transaction commit. Redis broadcasts sanitized registration and
      slot updates to tournament rooms; clients refetch after reconnect.
- [x] Pro Scene now has an additive normalized schema/migration, provider
      interface with a database-backed implementation, sourced event and
      detail pages, team/player profiles with derived history, admin event
      create/update/delete, API endpoints, landing/game-hub links, and six
      locale catalogs. No unsourced event, team, player, prize, or result facts
      are seeded.
- [x] Search, stream fullscreen/theater controls, per-game video preferences,
      glass panel styling, and a live-loading skeleton are implemented. The
      existing responsive navigation, theme tokens, motion preferences, and
      game-accent UI were retained.
- [x] Game background sources are `/media/<slug>/bg.webm`, `/media/<slug>/bg.mp4`,
      and `/media/<slug>/poster.jpg`. Owner-provided licensed footage is still
      required for actual video playback.
- [ ] Pro Scene external provider synchronization, automated sync worker,
      provider-backed live standings, admin team/player/result entry UI,
      real provider fixture tests, and event realtime updates are not
      implemented. Admin-managed event records are the only current data-entry
      workflow. Liquipedia and PandaScore credentials are documented but unused;
      their official docs/terms and current coverage notes are in README.
- [ ] Registration cancellation/withdrawal, check-in roster lock, teammate
      invitations, pending approval/payment/member states, waitlist promotion,
      organizer approval/CSV tools, ban/age checks, payment holds/webhook
      completion, and database-backed race/event-emission integration tests
      remain incomplete. Fee-bearing entries require a completed payment and
      can then be submitted; no pending-payment slot hold is created.

### Validation for this batch

The post-fix checks below are authoritative for Phase 3. The build entry is
historical; no production build was run for this batch.

- [x] Final post-fix workspace typecheck passed across all packages; Prisma
      schema validation passed.
- [x] Final post-change workspace unit tests passed: 31 web tests and 8 core
      tests; realtime package has no test files.
- [x] `corepack pnpm --filter @clutchverse/db db:generate` — passed.
- [x] `DIRECT_URL='postgresql://postgres:postgres@localhost:5432/clutchverse?schema=public' corepack pnpm test`
      — final run passed: 31 web tests and 8 core tests; realtime package had
      no test files. The first run exposed team-name internal whitespace
      normalization; it was fixed before the passing run.
- [ ] `DIRECT_URL='postgresql://postgres:postgres@localhost:5432/clutchverse?schema=public' corepack pnpm typecheck`
      — run once; initially failed on optional registration response narrowing
      and related-entity IDs in the Pro Scene event page. Those reported
      TypeScript issues were corrected afterward. The final production build
      passed its Next.js compilation/type validation.
- [x] `DIRECT_URL='postgresql://postgres:postgres@localhost:5432/clutchverse?schema=public' corepack pnpm build`
      — run twice; both passed, including after final edits. Next.js emitted
      one non-blocking existing `<img>` optimization warning.
- [ ] Playwright, runtime/API tests against PostgreSQL and Redis, database
      migration application/seed, external Gemini/Google Search/Liquipedia/
      PandaScore calls, and provider quota/rate-limit behavior were not run.

## Current batch: Block A match lobby and result operations

- [x] Additive schema and one additive migration add feature flags, delayed
      room credentials, check-in windows, ready state, lobby chat, private
      evidence metadata, result submissions, and dispute threads.
- [x] New match-lobby UI and APIs are gated by the `match-lobby` database flag
      (development defaults on; production defaults off); admin-only toggle
      and audit event are available at `/admin/features`.
- [x] Participant/organizer authorization, mutation rate limits, audit entries,
      evidence authorization, result mismatch disputes, moderator/organizer
      resolution, and single-elimination winner advancement are implemented.
- [x] Battle-royale CSV import uses the existing scoring route; screenshot
      uploads can receive optional AI suggestions. The AI output is never
      treated as a confirmed result.
- [ ] Screenshot-assisted batch import is not implemented; screenshots are
      uploaded individually. Automatic progression currently covers
      single-elimination brackets, not double-elimination, Swiss, or
      round-robin progression.
- [ ] Production evidence storage needs a durable private mounted directory.
      Gemini vision, Redis delivery, and migration application are provider/
      operator-dependent and were not exercised in this workspace.

### Block A validation

- [x] `corepack pnpm --filter @clutchverse/db db:generate` — passed.
- [x] `DIRECT_URL='postgresql://localhost:5432/clutchverse?schema=public' corepack pnpm typecheck`
      — workspace run passed on 2026-11-11, including Prisma schema validation.
      `DATABASE_URL` was set to the same local URL; this validates code/schema
      and does not apply migrations or verify that the database is reachable.
- [x] `DIRECT_URL='postgresql://localhost:5432/clutchverse?schema=public' corepack pnpm test`
      — passed: 34 web tests and 8 core tests; realtime has no test files.
- [ ] Database migration application, authenticated API/browser checks, Redis
      delivery, production private-storage setup, and Gemini vision calls were
      not run. Screenshot-assisted batch import remains incomplete.

## Current batch: Block C player and team analytics

- [x] Additive analytics models/migration, development-on/production-off
      `player-team-analytics` flag, admin toggle, signed-in dashboard, and
      owner-scoped manual result entry are implemented.
- [x] Dashboard combines completed platform matches, tournament score rows,
      and manual entries with source labels; provides results/win-rate,
      placement, kills/K-D where death data exists, head-to-head, team
      performance, rating comparisons, observed rank snapshots, and CSV export.
- [x] Share cards use a high-entropy owner-revocable token and disclose only
      aggregate stats plus the public profile handle.
- [ ] Screenshot-assisted entry, historical rating backfill, and match-level
      death data are unavailable. Rating history begins when users visit the
      dashboard; the app has no historical ranking source to backfill.
- [ ] Apply migration `20261116000000_player_team_analytics` before using the
      feature. Database-backed runtime/API/browser behavior was not exercised.
- [x] Focused analytics summary test passed.
- [x] Final workspace typecheck passed with Prisma schema validation. The first
      run found one redundant TypeScript narrowing check; it was corrected
      before the passing run.
- [x] Workspace unit suite passed: 35 web tests and 8 core tests; realtime has
      no test files.

## Current batch: Block E creator and streamer tools

- [x] Additive creator profile, overlay-token, schedule, clip/vote,
      virtual-point/reward, follow, watch-party, and co-stream request models
      plus one additive migration are implemented.
- [x] Creator Studio/public profile, private MP4/WebM upload with trim metadata,
      revocable OBS overlay routes, admin feature flag, and scoped APIs are
      implemented. Points are virtual only; follows create in-app notifications.
- [x] Workspace typecheck passed; unit suite passed with 36 web tests and 8
      core tests. Realtime has no test files.
- [ ] Production media storage is operator-dependent. Configure
      `CREATOR_MEDIA_DIRECTORY` as private durable storage before enabling
      production clip uploads. Migration application and database/API/browser
      runtime checks were not run; enable `creator-streamer-tools` from the
      admin feature-flags page only after applying the migration.
- [ ] OBS overlays currently poll every 10 seconds rather than receiving
      Socket.IO updates. Automated schedule reminders, clip transcoding, cloud
      storage, viewer points earning automation, and organizer co-stream review
      UI remain incomplete.
- [x] Focused token test, workspace typecheck, and unit-test results are
      recorded after validation.

## Current batch: Block F seasonal gamification and fantasy

- [x] Additive quarterly season, XP/virtual-point wallet and ledger, period-keyed
      daily/weekly quest claims, achievement/reward unlocks, private leagues,
      membership, and prediction models plus one additive migration.
- [x] Signed-in dashboard includes streaks, cosmetic reward track, achievements,
      XP leaderboard, invite-code leagues, and picks for future ClutchVerse
      matches and licensed Pro Scene events. Pick scoring uses completed results.
- [x] Admin flag management and all user actions are authenticated, rate-limited,
      Zod-validated, permission-scoped, and mutation-audited. Points are virtual
      only; no cash-value or purchase/withdrawal path exists.
- [ ] Apply `20261118000000_seasonal_play` and enable `seasonal-play` in admin
      after database review. Database-backed runtime, migration application,
      and browser behavior were not exercised.
- [ ] Picks and standings refresh on page/API load; no realtime notifications.
      Quest catalog/reward levels are fixed in code, not admin-configurable.
- [x] Focused period, level/reward, and result-scoring tests plus final workspace
      typecheck and unit-suite results passed: 39 web tests, 8 core tests;
      realtime has no test files. Prisma schema validation passed.

## Current batch: Block D AI coach and smart assistant

- [x] Extended the existing chatbot with per-user confirmed-match coaching,
      upcoming-tournament recommendations, team/scrim guidance, match recaps,
      and visibly AI-generated news drafts that remain pending until admin review.
- [x] Added opt-in per-user chat translation and high-confidence AI moderation
      flags to the moderator queue. Moderators/admins review or dismiss; the
      system never bans or takes other automatic punitive action.
- [x] Added additive preference/draft schema migration, admin feature flag,
      Zod-validated/rate-limited APIs, audit records, and localized controls.
- [ ] Apply `20261119000000_ai_coach_smart_assistant` and enable
      `ai-coach-smart-assistant` only after database review. Provider-backed
      translation/moderation and authenticated browser workflows were not run.
- [ ] Existing team data has no recruiting/scrim availability, so assistant
      responses must not assert that a team is open. Admin approval records
      news-draft review but does not publish; there is no news CMS.
- [x] Focused assistant-intent and moderation-threshold tests passed; workspace
      typecheck passed and unit suite passed (41 web, 8 core, 1 realtime tests).
      Prisma schema validation passed.

## Current batch: PMGC event spotlight

- [x] Added the additive `Spotlight*` Prisma models and one additive migration;
      no migration was applied and no live event data was seeded.
- [x] Added a default-off feature flag, sourced admin event/team/stage/player/
      standing/match/champion entry, ISO country validation, CSV preview/import,
      source pinning, audit records, and admin-only AI candidate drafts that
      require explicit review before publication.
- [x] Added PMGC public page and PUBG hub card, local-time event details,
      team search/filter/sort/table/grid/rosters, stage standings/schedule/
      results/history, source attribution, stale state, and connected YouTube
      live results filtered by PMGC title.
- [x] Added Redis `spotlight:<slug>` Socket.IO event subscriptions and
      broadcasts, search indexing, and a read-only `get_event_spotlight`
      chatbot context that cites source URLs and missing fields.
- [x] Added disabled Liquipedia/PandaScore adapters, Redis request budgets,
      provider health/coverage reporting, conditional HTTP/cache/backoff/
      circuit-breaker helpers, and recorded-fixture tests.
- [x] Workspace typecheck passed with local placeholder `DATABASE_URL` and
      `DIRECT_URL`; Prisma schema validation passed. Workspace tests passed:
      47 web, 8 core, and 3 realtime tests (58 total).
- [ ] Liquipedia LPDB endpoint/table mapping remains unverified because its
      authenticated docs were unavailable; no LPDB request is made. PandaScore
      checks only the documented `/videogames` endpoint when a token is set;
      event endpoint mappings remain disabled.
- [ ] Country markers currently use Unicode regional-indicator emoji rather
      than a locally bundled flag asset set. Spotlight UI copy has English
      entries/fallback; translation coverage in every existing locale and a
      full browser/accessibility pass remain unverified. Existing match/standing
      records do not yet have a dedicated edit flow.
- [ ] Apply migration `20261123000000_spotlight_events`, review Liquipedia
      approval/terms and plan limits, configure server-only keys/contact
      User-Agent if approved, verify PandaScore coverage, then enable the
      feature flag and enter/verify sourced event records.
