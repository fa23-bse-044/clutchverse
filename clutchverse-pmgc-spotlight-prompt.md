# ClutchVerse: PMGC Spotlight Section (PUBG Mobile), realtime from API

Read `AGENT_CONTEXT.md` and `CHECKLIST.md` only (do not re-explore the repo). If `AGENT_CONTEXT.md` is missing, create it first (max 60 lines: stack, folder map, run commands, key models/routes).

## STANDING RULES
- Additive only: do not modify/refactor/rename/delete existing pages, components, routes, APIs, themes, i18n keys, DB data or tests. New code goes in new files; touch existing files only for minimal integration points (a link/tab/banner slot), and list them before editing.
- Behind a feature flag (default OFF in production). DB: one additive migration, no destructive commands. Do not run `pnpm build` while a dev server runs (delete `apps/web/.next` after any build).
- Secrets server-side only, never logged; update `.env.example`, README, `CHECKLIST.md`, `AGENT_CONTEXT.md`. Short replies; typecheck once; run existing tests once; add focused tests with recorded fixtures (no live network in tests).
- **Never invent data.** Every team, country, count, date and result must come from a configured provider or an admin entry that has a source URL. Unknown = "TBD"/"Data not available yet".

## GOAL
A dedicated **PMGC (PUBG Mobile Global Championship) spotlight section** inside the PUBG Mobile area, showing the current event with a **realtime list of participating teams (names, countries) and live team count**, plus stages, standings, schedule and results, all fetched from an API and pushed live to open pages.
Context for configuration only (verify from the provider, do not hardcode): PMGC 2026 is reported to run 26 Nov to 13 Dec 2026 in Istanbul, Turkiye with a $3,000,000 prize pool and 39 qualified teams; sources disagree on stage details, so the UI must derive stages/counts from provider data.

## ROUTES AND UI
- `/games/pubg-mobile/pmgc` (and a prominent "PMGC LIVE / Starts in ..." card on the PUBG Mobile hub, plus an optional banner on landing and `/live` while the event is active). Build it **config-driven** (`config/spotlight-events.ts`: slug, game, display name, provider ids, flag) so PMGO, PMWC, Free Fire and other events can reuse it later.
- Header: event name, status (Upcoming/Live/Completed), countdown to start, dates shown in the user's local timezone, venue, prize pool, "Where to watch" (official channels links + in-site stream embeds from the existing YouTube/Twitch live service filtered for the event).
- Stats strip: **teams confirmed / total slots, number of countries/regions, stages, prize pool**, each animating when it changes live.
- **Teams grid + table view:** team name, **country (flag + name)**, qualification path (e.g., regional event/ direct invite) when provided, current stage/status, expandable roster (player names/roles) and link to the team page; search, country filter, sort, count per country. Use ISO 3166 alpha-2 codes with a locally bundled flag set (no hotlinking); team logos only if the provider license allows, otherwise initials.
- Stage tabs built from provider data (e.g., qualifier/gauntlet, group stage, finals): standings tables with points/placement/kills, live match-by-match results, schedule list, and a per-team results history within the event.
- Realtime: Socket.IO room `spotlight:<slug>` with events `team:added|updated|removed`, `counts:updated`, `standings:updated`, `match:updated`, `status:changed`; pages update without refresh and refetch on reconnect. Show "Source: <provider> | updated <time>" with a stale badge if sync is late, and required attribution.
- All text through i18n keys (existing locales, English fallback), RTL-safe, themed per PUBG accent, accessible, responsive, honors Performance mode/reduced motion.

## DATA PROVIDERS (official/licensed APIs only, NO scraping)
1. Adapter interface `SpotlightProvider` (`event`, `participants`, `standings`, `matches`, `roster`) returning normalized objects with `sourceName`, `sourceUrl`, `fetchedAt`.
2. **Primary: Liquipedia LPDB v3 API** (wiki `pubgmobile`). Requires approval and an API key requested at liquipedia.net/api; env `LIQUIPEDIA_API_KEY` (Authorization header, never logged) and `LIQUIPEDIA_USER_AGENT` (descriptive, with contact email, as their terms require); event identifier in config (e.g., the PMGC 2026 tournament page name). **Before coding, read the official LPDB docs and API terms and state in the README the exact endpoints/tables you use, rate limits, caching rules and attribution (CC-BY-SA with link back); implement strict rate limiting, gzip, ETag/If-Modified-Since, exponential backoff and a circuit breaker.** Do not parse HTML pages or scrape.
3. **Optional second provider:** PandaScore (or another licensed esports API) via `PANDASCORE_TOKEN`, only if its current docs confirm PUBG Mobile coverage; otherwise skip and say so.
4. **Fallback (works with no keys):** admin CMS page to enter/override teams, countries, stages and results; every record requires a source URL (e.g., official PUBG Mobile Esports announcement). The UI clearly shows "Admin-managed data" when a provider is not configured.
5. Never mix sources silently; show which source each section uses; allow admin to pin an override that survives syncs.

## SYNC AND STORAGE
- Additive Prisma models: `SpotlightEvent`, `SpotlightTeam`, `SpotlightParticipation` (event, team, country code, qualification path, status), `SpotlightPlayer`, `SpotlightStage`, `SpotlightStanding`, `SpotlightMatch`, plus `source`/`fetchedAt` fields.
- Background sync (existing realtime service or a job script): participants/standings every 10-15 min before the event, **every 30-60 s only while matches are live and within the provider's limits**, daily roster refresh. Change detection then publish Redis pub/sub, then Socket.IO. Redis cache for hot reads. Admin status page: last sync, last error, manual re-sync, provider health.

## INTEGRATIONS
- Add the event's teams to the Ctrl+K search index. Expose a read-only chatbot tool (`get_event_spotlight`) returning teams, countries, standings and schedule "as of <time>" with source links; the chatbot must say when data is missing rather than guess.
- Event history block ("Past PMGC winners") only from provider data or admin entries with sources.

## FINISH
Typecheck once, run existing tests once, update `CHECKLIST.md` honestly (what was verified vs provider-dependent), `AGENT_CONTEXT.md`, README (how to request the Liquipedia key, env vars, rate limits, attribution), and list the manual steps I must do. Then stop with a 5-line summary.
