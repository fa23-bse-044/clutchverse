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
- [x] Latest workspace lint, typecheck, unit tests, and production build pass.
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
      moderation/anti-cheat review, evidence, ban, appeal, and audit UI is not
      complete.
- [ ] Admin dashboard is a protected starting point, not a complete user,
      content, payment, feature-flag, and analytics management suite.
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

## Current batch: chatbot, registration, and Pro Scene

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
- [ ] Pro Scene external provider synchronization, automated sync worker,
      provider-backed live standings, admin team/player/result entry UI,
      real provider fixture tests, and event realtime updates are not
      implemented. Admin-managed event records are the only current data-entry
      workflow. Liquipedia and PandaScore credentials are documented but unused.
- [ ] Registration cancellation/withdrawal, check-in roster lock, teammate
      invitations, substitutes, organizer approval/CSV tools, ban/age checks,
      payment holds/webhook completion, and database-backed race/event-emission
      integration tests remain incomplete. Fee-bearing entries require a
      completed payment and can then be submitted; no pending-payment slot hold
      is created.

### Validation for this batch

- [x] `corepack pnpm --filter @clutchverse/db db:generate` — passed.
- [x] `DIRECT_URL='postgresql://postgres:postgres@localhost:5432/clutchverse?schema=public' corepack pnpm test`
      — final run passed: 28 web tests, 8 core tests; realtime package had no
      test files. The first run failed because `DIRECT_URL` was unset; the
      next run found a chatbot prompt assertion mismatch, which was corrected.
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
