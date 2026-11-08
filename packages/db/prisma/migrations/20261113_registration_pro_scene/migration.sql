ALTER TABLE "Registration"
  ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'solo',
  ADD COLUMN "teamName" TEXT,
  ADD COLUMN "normalizedTeamName" TEXT,
  ADD COLUMN "region" TEXT,
  ADD COLUMN "inGamePlayers" JSONB,
  ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "Registration_idempotencyKey_key"
  ON "Registration"("idempotencyKey");
CREATE UNIQUE INDEX "Registration_tournamentId_normalizedTeamName_key"
  ON "Registration"("tournamentId", "normalizedTeamName");
CREATE INDEX "Registration_tournamentId_status_idx"
  ON "Registration"("tournamentId", "status");

CREATE TABLE "ProSceneEvent" (
  "id" TEXT NOT NULL,
  "gameSlug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'upcoming',
  "prizePool" TEXT,
  "region" TEXT,
  "stage" TEXT,
  "format" TEXT,
  "sourceName" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "license" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProSceneEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProSceneEvent_gameSlug_status_startsAt_idx"
  ON "ProSceneEvent"("gameSlug", "status", "startsAt");
ALTER TABLE "ProSceneEvent" ADD CONSTRAINT "ProSceneEvent_gameSlug_fkey"
  FOREIGN KEY ("gameSlug") REFERENCES "Game"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProSceneTeam" (
  "id" TEXT NOT NULL,
  "gameSlug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "region" TEXT,
  "sourceName" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "license" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProSceneTeam_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProSceneTeam_gameSlug_name_key" ON "ProSceneTeam"("gameSlug", "name");
ALTER TABLE "ProSceneTeam" ADD CONSTRAINT "ProSceneTeam_gameSlug_fkey"
  FOREIGN KEY ("gameSlug") REFERENCES "Game"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProScenePlayer" (
  "id" TEXT NOT NULL,
  "gameSlug" TEXT NOT NULL,
  "teamId" TEXT,
  "name" TEXT NOT NULL,
  "region" TEXT,
  "role" TEXT,
  "sourceName" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "license" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProScenePlayer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProScenePlayer_gameSlug_name_key" ON "ProScenePlayer"("gameSlug", "name");
ALTER TABLE "ProScenePlayer" ADD CONSTRAINT "ProScenePlayer_gameSlug_fkey"
  FOREIGN KEY ("gameSlug") REFERENCES "Game"("slug") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProScenePlayer" ADD CONSTRAINT "ProScenePlayer_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "ProSceneTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ProSceneEventTeam" (
  "eventId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  CONSTRAINT "ProSceneEventTeam_pkey" PRIMARY KEY ("eventId", "teamId")
);
ALTER TABLE "ProSceneEventTeam" ADD CONSTRAINT "ProSceneEventTeam_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "ProSceneEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProSceneEventTeam" ADD CONSTRAINT "ProSceneEventTeam_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "ProSceneTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProSceneStanding" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "teamId" TEXT,
  "playerId" TEXT,
  "rank" INTEGER,
  "points" DOUBLE PRECISION,
  "sourceName" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "license" TEXT NOT NULL,
  CONSTRAINT "ProSceneStanding_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProSceneStanding_eventId_rank_idx" ON "ProSceneStanding"("eventId", "rank");
ALTER TABLE "ProSceneStanding" ADD CONSTRAINT "ProSceneStanding_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "ProSceneEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProSceneStanding" ADD CONSTRAINT "ProSceneStanding_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "ProSceneTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProSceneStanding" ADD CONSTRAINT "ProSceneStanding_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "ProScenePlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProSceneResult" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "teamId" TEXT,
  "playerId" TEXT,
  "placement" INTEGER,
  "title" TEXT,
  "resultDate" TIMESTAMP(3),
  "sourceName" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "license" TEXT NOT NULL,
  CONSTRAINT "ProSceneResult_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProSceneResult_eventId_placement_idx" ON "ProSceneResult"("eventId", "placement");
CREATE INDEX "ProSceneResult_teamId_resultDate_idx" ON "ProSceneResult"("teamId", "resultDate");
CREATE INDEX "ProSceneResult_playerId_resultDate_idx" ON "ProSceneResult"("playerId", "resultDate");
ALTER TABLE "ProSceneResult" ADD CONSTRAINT "ProSceneResult_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "ProSceneEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProSceneResult" ADD CONSTRAINT "ProSceneResult_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "ProSceneTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProSceneResult" ADD CONSTRAINT "ProSceneResult_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "ProScenePlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
