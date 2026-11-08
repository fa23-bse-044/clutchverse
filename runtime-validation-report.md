# Runtime Validation Report

**Generated**: 2026-11-06T22:22:05+05:00  
**Target**: `/home/uqba/Desktop/ClutchVerse`

## Phase 2 Block 0–1 update (2026-11-07)

| Check                   | Result                       |                                        Exit Code | Evidence                                                                                                                                            |
| ----------------------- | ---------------------------- | -----------------------------------------------: | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace lint          | PASS                         |                                                0 | `pnpm lint`; no ESLint warnings or errors.                                                                                                          |
| Workspace typecheck     | PASS                         |                                                0 | `pnpm typecheck`.                                                                                                                                   |
| Unit tests              | PASS                         |                                                0 | `pnpm test`; 8 core tests and 6 new web tests passed.                                                                                               |
| Production build        | PASS                         |                                                0 | `pnpm build`; Next.js production compilation completed.                                                                                             |
| Auth startup guard      | PASS (expected rejection)    | n/a (server process stopped after startup error) | Starting without either secret printed the actionable `AUTH_SECRET`/`NEXTAUTH_SECRET` message.                                                      |
| Stats with PostgreSQL   | PASS                         |                                                0 | `/api/stats` returned HTTP 200 with database counters.                                                                                              |
| Stats fallback          | PASS                         |                                                0 | With an intentionally unreachable database, `/api/stats` returned HTTP 200 and seeded counters `{ players: 8, liveEvents: 1, prizePool: 4550000 }`. |
| Contact persistence     | PASS                         |                                                0 | Contact API returned HTTP 201; the row was read back from PostgreSQL with `development-mock` delivery status, then deleted as test cleanup.         |
| Game pages              | PASS                         |                                                0 | `/games` and `/games/pubg-mobile` returned HTTP 200 with the production server connected to the test database.                                      |
| Redis                   | PASS                         |                                                0 | Redis `PING` returned `PONG`; contact submission exercised the configured limiter path.                                                             |
| Prisma migration/seed   | PASS after baseline handling |                  0 for apply/resolve/seed/status | Four community records were present; `prisma migrate status` reported up to date.                                                                   |
| Playwright / Lighthouse | NOT RUN                      |                                              n/a | Not requested for this Phase 2 batch; the earlier four E2E journeys remain recorded below.                                                          |

`prisma migrate deploy` initially exited `1` with P3005 because the existing
test database was non-empty and had no migration baseline. To avoid a false
baseline or recreating existing tables, the additive migration SQL was executed
directly, then recorded with `prisma migrate resolve --applied`; seed and
`migrate status` subsequently succeeded. This database still needs a documented
baseline strategy before deploying a brand-new empty database using
`migrate deploy`.

**Phase 2 status**: Block 0 validated; Block 1 implemented and smoke-tested in
part, with browser-based ranking/socket and admin-edit interactions not run.
Blocks 2–7 remain incomplete. The previous four Playwright journeys were not
rerun for this batch.

## Summary

| Step               | Status | Exit Code | Details                                                                                                                                                                                                  |
| ------------------ | -----: | --------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Startup            |   PASS |         0 | Playwright started the Next.js web app and Socket.IO service; Chromium launched.                                                                                                                         |
| Schema deployment  |   PASS |         0 | `pnpm --filter @clutchverse/db db:push` synchronized the Prisma schema with the disposable Neon database using `DIRECT_URL`. This project has no migration history; no `prisma migrate` command was run. |
| Seed               |   PASS |         0 | `pnpm --filter @clutchverse/db db:seed` completed against the test database.                                                                                                                             |
| Redis connectivity |   PASS |         0 | Upstash TLS connection returned `PONG`; the ranking journey also verified sorted-set writes.                                                                                                             |
| Unit tests         |   PASS |         0 | `pnpm test`; 8 domain tests passed.                                                                                                                                                                      |
| Lint               |   PASS |         0 | `pnpm lint`.                                                                                                                                                                                             |
| Typecheck          |   PASS |         0 | `pnpm typecheck`, including the E2E configuration and files.                                                                                                                                             |
| Build              |   PASS |         0 | `pnpm build`; Next.js compiled and generated all 38 static pages.                                                                                                                                        |
| E2E                |   PASS |         0 | `pnpm test:e2e`; 4 browser journeys passed against PostgreSQL and Redis.                                                                                                                                 |

**Overall**: PASS for the exercised runtime and visual-preference scope. Docker
was unavailable, so the real-service tests used the explicitly supplied
disposable hosted PostgreSQL/Redis services instead of Compose. CI was not run.

## Environment and capability evidence

- Docker: **UNAVAILABLE** — `docker` is not installed. This did not prevent
  Playwright execution; managed PostgreSQL and Redis were used for the infra
  tier.
- Node.js: **AVAILABLE** — `v20.20.0`.
- Playwright: **AVAILABLE** — version `1.65.0`; Chromium launched successfully.
- PostgreSQL: **PASS** — Prisma schema deployed through the supplied direct
  Neon endpoint. E2E data used the supplied pooled endpoint. Seed and test
  records were written to the confirmed disposable test database.
- Redis: **PASS** — the supplied Upstash TLS endpoint returned `PONG`; the
  ranking journey verified Redis synchronization and realtime delivery.
- Test environment: root `.env.test` is ignored and has restrictive file
  permissions. Connection values are intentionally not reproduced here.

## Test evidence

| Test file                                     | Journey                                                                                                         | Result |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------ |
| `apps/web/e2e/tournament-registration.e2e.ts` | Register/login, persist profile visual preferences, tournament registration, and check-in                       | PASS   |
| `apps/web/e2e/live-rankings.e2e.ts`           | Submit battle-royale scores, verify PostgreSQL and Redis rankings, receive Socket.IO update in a second browser | PASS   |
| `apps/web/e2e/chat.e2e.ts`                    | Send chat message, read persisted history, add persisted reaction                                               | PASS   |
| `apps/web/e2e/team-invites.e2e.ts`            | Create invitations, display notifications, accept/decline and verify roster persistence                         | PASS   |

Final E2E result: **4 passed, 0 failed**, exit code `0`. The test timeout is
180 seconds to tolerate hosted-service latency. The final suite was run alone
after an earlier parallel run exposed remote transaction timing and test
contention; that earlier run is not counted as the final result.

## Issues found and addressed

| #   | Severity | Description                                                                                                       | Resolution                                                                                                       |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | Medium   | Seeded tournament creation passed `gameSlug`, which is not a Prisma `Tournament` field.                           | Seed now writes only valid tournament fields and uses the resolved `gameId`.                                     |
| 2   | Medium   | Chat UI reported connected before room authorization completed, allowing sends before the server joined the room. | UI now waits for a successful `room:join` acknowledgement before enabling the connected state.                   |
| 3   | Medium   | Playwright's password label matched both the password input and its show/hide button.                             | E2E locators use exact accessible-label matching.                                                                |
| 4   | Medium   | Neon round-trip latency exceeded Prisma's default 5-second interactive transaction timeout during registration.   | Registration transactions now allow a 10-second acquisition wait and a 20-second execution timeout.              |
| 5   | Low      | Locale was passed into the visual-preference storage mapper and created an invalid `data-undefined` attribute.    | Locale and visual settings are now handled separately; the login helper asserts the invalid attribute is absent. |

## Remaining gaps

- Docker Compose startup and the CI workflow were not exercised in this workspace.
- The hosted-service test does not constitute production deployment or
  operational monitoring verification.
- Publisher footage was intentionally not supplied; game hubs use local
  placeholder posters, so real video playback with licensed owner-provided
  files was not exercised.
- Lighthouse targets, load tests, and production OAuth/payment/email/storage
  integrations remain untested.
