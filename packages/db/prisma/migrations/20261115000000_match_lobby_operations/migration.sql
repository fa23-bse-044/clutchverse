-- Additive persistence for match-lobby operations.
ALTER TABLE "Match"
  ADD COLUMN "roomId" TEXT,
  ADD COLUMN "roomPassword" TEXT,
  ADD COLUMN "roomRevealAt" TIMESTAMP(3),
  ADD COLUMN "checkInStartsAt" TIMESTAMP(3),
  ADD COLUMN "checkInEndsAt" TIMESTAMP(3);

CREATE TABLE "FeatureFlag" (
  "key" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedBy" TEXT,
  CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "MatchReadyStatus" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "ready" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MatchReadyStatus_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MatchReadyStatus_matchId_userId_key"
  ON "MatchReadyStatus"("matchId", "userId");
ALTER TABLE "MatchReadyStatus" ADD CONSTRAINT "MatchReadyStatus_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchReadyStatus" ADD CONSTRAINT "MatchReadyStatus_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MatchLobbyMessage" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "body" VARCHAR(300) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MatchLobbyMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MatchLobbyMessage_matchId_createdAt_idx"
  ON "MatchLobbyMessage"("matchId", "createdAt");
ALTER TABLE "MatchLobbyMessage" ADD CONSTRAINT "MatchLobbyMessage_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchLobbyMessage" ADD CONSTRAINT "MatchLobbyMessage_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MatchEvidence" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "uploaderId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "aiSuggestion" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MatchEvidence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MatchEvidence_storageKey_key" ON "MatchEvidence"("storageKey");
CREATE INDEX "MatchEvidence_matchId_createdAt_idx"
  ON "MatchEvidence"("matchId", "createdAt");
ALTER TABLE "MatchEvidence" ADD CONSTRAINT "MatchEvidence_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchEvidence" ADD CONSTRAINT "MatchEvidence_uploaderId_fkey"
  FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MatchResultSubmission" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "registrationId" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "scoreA" INTEGER NOT NULL,
  "scoreB" INTEGER NOT NULL,
  "placementA" INTEGER,
  "placementB" INTEGER,
  "killsA" INTEGER,
  "killsB" INTEGER,
  "evidenceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MatchResultSubmission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MatchResultSubmission_matchId_registrationId_key"
  ON "MatchResultSubmission"("matchId", "registrationId");
CREATE INDEX "MatchResultSubmission_matchId_createdAt_idx"
  ON "MatchResultSubmission"("matchId", "createdAt");
ALTER TABLE "MatchResultSubmission" ADD CONSTRAINT "MatchResultSubmission_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchResultSubmission" ADD CONSTRAINT "MatchResultSubmission_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MatchDispute" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "openerId" TEXT NOT NULL,
  "resolverId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open',
  "reason" VARCHAR(1000) NOT NULL,
  "resolution" VARCHAR(1000),
  "dueAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "MatchDispute_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MatchDispute_matchId_status_idx" ON "MatchDispute"("matchId", "status");
CREATE INDEX "MatchDispute_status_dueAt_idx" ON "MatchDispute"("status", "dueAt");
ALTER TABLE "MatchDispute" ADD CONSTRAINT "MatchDispute_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchDispute" ADD CONSTRAINT "MatchDispute_openerId_fkey"
  FOREIGN KEY ("openerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MatchDispute" ADD CONSTRAINT "MatchDispute_resolverId_fkey"
  FOREIGN KEY ("resolverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "MatchDisputeMessage" (
  "id" TEXT NOT NULL,
  "disputeId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "body" VARCHAR(2000) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MatchDisputeMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MatchDisputeMessage_disputeId_createdAt_idx"
  ON "MatchDisputeMessage"("disputeId", "createdAt");
ALTER TABLE "MatchDisputeMessage" ADD CONSTRAINT "MatchDisputeMessage_disputeId_fkey"
  FOREIGN KEY ("disputeId") REFERENCES "MatchDispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchDisputeMessage" ADD CONSTRAINT "MatchDisputeMessage_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
