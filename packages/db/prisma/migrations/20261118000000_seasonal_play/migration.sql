CREATE TABLE "GameSeason" (
  "id" TEXT NOT NULL,
  "key" VARCHAR(16) NOT NULL,
  "title" VARCHAR(80) NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GameSeason_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GameSeason_key_key" ON "GameSeason"("key");
CREATE INDEX "GameSeason_active_startsAt_endsAt_idx" ON "GameSeason"("active", "startsAt", "endsAt");

CREATE TABLE "SeasonWallet" (
  "id" TEXT NOT NULL,
  "seasonId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "xp" INTEGER NOT NULL DEFAULT 0,
  "points" INTEGER NOT NULL DEFAULT 0,
  "streak" INTEGER NOT NULL DEFAULT 0,
  "lastCheckInAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SeasonWallet_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SeasonWallet_seasonId_userId_key" ON "SeasonWallet"("seasonId", "userId");
CREATE INDEX "SeasonWallet_seasonId_xp_idx" ON "SeasonWallet"("seasonId", "xp");
ALTER TABLE "SeasonWallet" ADD CONSTRAINT "SeasonWallet_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "GameSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeasonWallet" ADD CONSTRAINT "SeasonWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SeasonQuestClaim" (
  "id" TEXT NOT NULL,
  "seasonId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "questKey" VARCHAR(32) NOT NULL,
  "periodKey" VARCHAR(16) NOT NULL,
  "xpAward" INTEGER NOT NULL,
  "pointsAward" INTEGER NOT NULL,
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeasonQuestClaim_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SeasonQuestClaim_period_key" ON "SeasonQuestClaim"("seasonId", "userId", "questKey", "periodKey");
CREATE INDEX "SeasonQuestClaim_userId_claimedAt_idx" ON "SeasonQuestClaim"("userId", "claimedAt");
ALTER TABLE "SeasonQuestClaim" ADD CONSTRAINT "SeasonQuestClaim_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "GameSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeasonQuestClaim" ADD CONSTRAINT "SeasonQuestClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SeasonPointTransaction" (
  "id" TEXT NOT NULL,
  "seasonId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "reason" VARCHAR(32) NOT NULL,
  "referenceKey" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeasonPointTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SeasonPointTransaction_reference_key" ON "SeasonPointTransaction"("seasonId", "userId", "reason", "referenceKey");
CREATE INDEX "SeasonPointTransaction_seasonId_userId_createdAt_idx" ON "SeasonPointTransaction"("seasonId", "userId", "createdAt");
ALTER TABLE "SeasonPointTransaction" ADD CONSTRAINT "SeasonPointTransaction_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "GameSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeasonPointTransaction" ADD CONSTRAINT "SeasonPointTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SeasonAchievement" (
  "id" TEXT NOT NULL,
  "seasonId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "key" VARCHAR(32) NOT NULL,
  "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeasonAchievement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SeasonAchievement_seasonId_userId_key_key" ON "SeasonAchievement"("seasonId", "userId", "key");
ALTER TABLE "SeasonAchievement" ADD CONSTRAINT "SeasonAchievement_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "GameSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeasonAchievement" ADD CONSTRAINT "SeasonAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SeasonRewardClaim" (
  "id" TEXT NOT NULL,
  "seasonId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "level" INTEGER NOT NULL,
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeasonRewardClaim_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SeasonRewardClaim_seasonId_userId_level_key" ON "SeasonRewardClaim"("seasonId", "userId", "level");
ALTER TABLE "SeasonRewardClaim" ADD CONSTRAINT "SeasonRewardClaim_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "GameSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeasonRewardClaim" ADD CONSTRAINT "SeasonRewardClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SeasonLeague" (
  "id" TEXT NOT NULL,
  "seasonId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "name" VARCHAR(64) NOT NULL,
  "inviteCode" VARCHAR(16) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeasonLeague_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SeasonLeague_inviteCode_key" ON "SeasonLeague"("inviteCode");
CREATE INDEX "SeasonLeague_seasonId_createdAt_idx" ON "SeasonLeague"("seasonId", "createdAt");
ALTER TABLE "SeasonLeague" ADD CONSTRAINT "SeasonLeague_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "GameSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeasonLeague" ADD CONSTRAINT "SeasonLeague_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SeasonLeagueMember" (
  "id" TEXT NOT NULL,
  "leagueId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SeasonLeagueMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SeasonLeagueMember_leagueId_userId_key" ON "SeasonLeagueMember"("leagueId", "userId");
CREATE INDEX "SeasonLeagueMember_userId_joinedAt_idx" ON "SeasonLeagueMember"("userId", "joinedAt");
ALTER TABLE "SeasonLeagueMember" ADD CONSTRAINT "SeasonLeagueMember_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "SeasonLeague"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeasonLeagueMember" ADD CONSTRAINT "SeasonLeagueMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SeasonPick" (
  "id" TEXT NOT NULL,
  "seasonId" TEXT NOT NULL,
  "leagueId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "eventType" VARCHAR(24) NOT NULL,
  "eventRefId" VARCHAR(64) NOT NULL,
  "selectionRefId" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SeasonPick_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SeasonPick_leagueId_userId_eventType_eventRefId_key" ON "SeasonPick"("leagueId", "userId", "eventType", "eventRefId");
CREATE INDEX "SeasonPick_seasonId_eventType_eventRefId_idx" ON "SeasonPick"("seasonId", "eventType", "eventRefId");
ALTER TABLE "SeasonPick" ADD CONSTRAINT "SeasonPick_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "GameSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeasonPick" ADD CONSTRAINT "SeasonPick_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "SeasonLeague"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeasonPick" ADD CONSTRAINT "SeasonPick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
