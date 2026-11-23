CREATE TYPE "SpotlightSourceType" AS ENUM ('provider', 'admin', 'ai_assisted_verified');

CREATE TABLE "SpotlightEvent" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "gameSlug" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'upcoming',
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "venue" TEXT,
  "prizePool" TEXT,
  "totalSlots" INTEGER,
  "officialLinks" JSONB NOT NULL DEFAULT '[]',
  "sourceType" "SpotlightSourceType" NOT NULL DEFAULT 'admin',
  "sourceName" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedBy" TEXT,
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SpotlightEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SpotlightEvent_slug_key" ON "SpotlightEvent"("slug");
CREATE INDEX "SpotlightEvent_gameSlug_status_startsAt_idx" ON "SpotlightEvent"("gameSlug", "status", "startsAt");

CREATE TABLE "SpotlightTeam" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "countryCode" VARCHAR(2) NOT NULL,
  "region" TEXT,
  "sourceType" "SpotlightSourceType" NOT NULL DEFAULT 'admin',
  "sourceName" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedBy" TEXT,
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SpotlightTeam_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SpotlightTeam_slug_key" ON "SpotlightTeam"("slug");
CREATE INDEX "SpotlightTeam_countryCode_name_idx" ON "SpotlightTeam"("countryCode", "name");

CREATE TABLE "SpotlightStage" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'upcoming',
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "sourceType" "SpotlightSourceType" NOT NULL DEFAULT 'admin',
  "sourceName" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedBy" TEXT,
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SpotlightStage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SpotlightStage_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "SpotlightEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SpotlightStage_eventId_name_key" ON "SpotlightStage"("eventId", "name");
CREATE INDEX "SpotlightStage_eventId_sortOrder_idx" ON "SpotlightStage"("eventId", "sortOrder");

CREATE TABLE "SpotlightParticipation" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "countryCode" VARCHAR(2) NOT NULL,
  "qualificationPath" TEXT,
  "status" TEXT NOT NULL DEFAULT 'confirmed',
  "stageId" TEXT,
  "sourceType" "SpotlightSourceType" NOT NULL DEFAULT 'admin',
  "sourceName" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedBy" TEXT,
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SpotlightParticipation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SpotlightParticipation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "SpotlightEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SpotlightParticipation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "SpotlightTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SpotlightParticipation_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "SpotlightStage"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SpotlightParticipation_eventId_teamId_key" ON "SpotlightParticipation"("eventId", "teamId");
CREATE INDEX "SpotlightParticipation_eventId_countryCode_status_idx" ON "SpotlightParticipation"("eventId", "countryCode", "status");

CREATE TABLE "SpotlightPlayer" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT,
  "sourceType" "SpotlightSourceType" NOT NULL DEFAULT 'admin',
  "sourceName" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedBy" TEXT,
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SpotlightPlayer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SpotlightPlayer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "SpotlightTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SpotlightPlayer_teamId_name_key" ON "SpotlightPlayer"("teamId", "name");
CREATE INDEX "SpotlightPlayer_teamId_name_idx" ON "SpotlightPlayer"("teamId", "name");

CREATE TABLE "SpotlightStanding" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "stageId" TEXT,
  "participationId" TEXT NOT NULL,
  "rank" INTEGER,
  "points" DOUBLE PRECISION,
  "placementPoints" DOUBLE PRECISION,
  "kills" INTEGER,
  "sourceType" "SpotlightSourceType" NOT NULL DEFAULT 'admin',
  "sourceName" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedBy" TEXT,
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SpotlightStanding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SpotlightStanding_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "SpotlightEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SpotlightStanding_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "SpotlightStage"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "SpotlightStanding_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES "SpotlightParticipation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SpotlightStanding_eventId_stageId_rank_idx" ON "SpotlightStanding"("eventId", "stageId", "rank");
CREATE INDEX "SpotlightStanding_participationId_fetchedAt_idx" ON "SpotlightStanding"("participationId", "fetchedAt");

CREATE TABLE "SpotlightMatch" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "stageId" TEXT,
  "participationId" TEXT,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'scheduled',
  "startsAt" TIMESTAMP(3),
  "results" JSONB,
  "sourceType" "SpotlightSourceType" NOT NULL DEFAULT 'admin',
  "sourceName" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedBy" TEXT,
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SpotlightMatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SpotlightMatch_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "SpotlightEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SpotlightMatch_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "SpotlightStage"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "SpotlightMatch_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES "SpotlightParticipation"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "SpotlightMatch_eventId_status_startsAt_idx" ON "SpotlightMatch"("eventId", "status", "startsAt");

CREATE TABLE "SpotlightSourceRecord" (
  "id" TEXT NOT NULL,
  "eventSlug" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "sourceType" "SpotlightSourceType" NOT NULL DEFAULT 'admin',
  "sourceName" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedBy" TEXT,
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SpotlightSourceRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SpotlightSourceRecord_eventSlug_entityType_entityId_idx" ON "SpotlightSourceRecord"("eventSlug", "entityType", "entityId");

CREATE TABLE "SpotlightImportDraft" (
  "id" TEXT NOT NULL,
  "eventSlug" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "facts" JSONB NOT NULL,
  "sourceName" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdBy" TEXT NOT NULL,
  "reviewedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "SpotlightImportDraft_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SpotlightImportDraft_eventSlug_status_createdAt_idx" ON "SpotlightImportDraft"("eventSlug", "status", "createdAt");
