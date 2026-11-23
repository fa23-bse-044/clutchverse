# Agent Context

## Stack and workspace
- pnpm 9.15.5/Turborepo monorepo; Node.js 20+.
- `apps/web`: Next.js 15 App Router, React 19, TypeScript, Auth.js, Prisma.
- `apps/realtime`: Socket.IO service; Redis adapter is optional locally.
- `packages/core`: shared game/domain rules, validation, ranking, brackets, RBAC;
  `packages/db`: Prisma/PostgreSQL schema, migrations, client, seeds.
- `packages/ui` and `packages/config`: shared UI primitives/tokens and tooling.

## Run locally
- Web config belongs in `apps/web/.env.local`; export root `.env.local` values for shared commands/realtime. Keep provider keys server-only, never `NEXT_PUBLIC_`.
- Start PostgreSQL/Redis with `docker compose up -d --wait postgres redis`.
- Install with `corepack pnpm install`; prepare local DB with README's `db:push` and `db:seed` commands.
- Web: `corepack pnpm --filter @clutchverse/web dev -- --port 3002`; realtime: `corepack pnpm --filter @clutchverse/realtime dev`.
- Workspace validation: `corepack pnpm typecheck` and `corepack pnpm test`.
- Docs use a default web URL of `http://localhost:3002`.

## Folder map and key routes
- Pages: `apps/web/src/app`; reusable UI: `apps/web/src/components`.
- Server/domain helpers: `apps/web/src/lib`; app config: `apps/web/src/config`.
- Locale catalogs: `apps/web/src/i18n/messages` (en, ar, ur, zh, hi, es).
- Main pages: `/`, `/games`, `/games/[slug]`, `/tournaments`, `/tournaments/[slug]`, `/live`, `/faq`, `/search`, `/admin/pro-scene`.
- APIs include `/api/tournaments`, `/api/tournaments/[id]/register`, `/api/games/[slug]/pro-scene`, `/api/admin/pro-scene`, and `/api/live/youtube`.
- Search API: `/api/search?q=&game=&type=`; command palette is in the navbar.
- Realtime Pro Scene and registration updates use the existing Socket.IO service.
- Match lobby: `/matches`, `/matches/[id]/lobby`; APIs under `/api/matches/[id]/lobby`, `/api/matches/[id]/evidence`, and `/api/matches/[id]/dispute`.
- Analytics: `/analytics`; public aggregate cards `/analytics/share/[token]`; admin flag `/admin/features/analytics`.
- Creator tools: `/creator`, public profiles `/creator/[slug]`, OBS sources `/creator/overlay/[token]?type=...`; flag `/admin/features/creator-tools`.
- Seasonal play: `/seasonal-play`; flag `/admin/features/seasonal-play`; migration `20261118000000_seasonal_play`.
- AI coach extends chat; flag `/admin/features/ai-assistant`, drafts `/admin/ai-drafts`, moderator queue `/admin/ai-moderation`; migration `20261119000000_ai_coach_smart_assistant`.
- Admin match-lobby flag: `/admin/features`; Redis broadcasts need the realtime
  service and `REDIS_URL`.
- Apply additive DB migrations with `corepack pnpm --filter @clutchverse/db exec prisma migrate deploy`; typecheck does not apply them. Analytics migration: `20261116000000_player_team_analytics`.
- Creator/Pro Scene require migrations `20261117000000_creator_streamer_tools` / `20261113_registration_pro_scene`; production clips need private `CREATOR_MEDIA_DIRECTORY`, OBS polls every 10s; live is `/live`.
- Seasonal play uses quarterly UTC seasons, virtual-only quest rewards, and confirmed-result picks. AI chat uses confirmed user match context; translation is opt-in and moderation only flags for human review.

## Data and conventions
- Main Prisma models: `User`, `PlayerProfile`, `Game`, `Tournament`,
  `Registration`, `Team`, `Ranking`, `Stream`, and `ProScene*`.
- Pro Scene event/team/player/standing/result records keep source name, URL,
  fetch time, and license; external provider sync is not enabled.
- Tournament registration validation is shared in
  `apps/web/src/lib/tournament-registration.ts`; mutation authorization and
  persistence belong on the server.
- Registration validates mode/platform/IDs/substitutes and uses idempotency plus
  capacity serialization; approval/payment/invite/waitlist remain incomplete;
  Phase 3 migration is unapplied.
- Search uses bounded internal candidates and Redis short-TTL caching; news has no backing model.
- PMGC Spotlight uses additive `Spotlight*` models, migration `20261123000000_spotlight_events`, a default-off flag, page `/games/pubg-mobile/pmgc`, admin API `/api/admin/spotlight`, and public API `/api/spotlight/[slug]`; event-provider mappings remain disabled.
- Game video media URLs are `/media/<slug>/bg.webm`, `/media/<slug>/bg.mp4`,
  and `/media/<slug>/poster.jpg`; only licensed owner-provided footage belongs
  under `apps/web/public/media/<slug>/`.
- Use existing design tokens, game configs, and locale catalogs; support RTL,
  reduced motion, and Performance mode. Use additive DB migrations only.
- Localized message catalogs must stay shape-compatible with English.
- Match-lobby migration is additive. Before enabling, configure private durable
  `MATCH_EVIDENCE_DIRECTORY`; optional server-only Gemini uses `GEMINI_API_KEY`
  only for unconfirmed suggestions.
- Existing video placeholders are original; publisher footage must be owner-supplied and licensed.
