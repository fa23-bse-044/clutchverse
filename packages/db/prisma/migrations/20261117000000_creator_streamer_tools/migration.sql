CREATE TABLE "CreatorProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "bio" VARCHAR(500) NOT NULL DEFAULT '',
  "coStreamEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreatorProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CreatorProfile_userId_key" ON "CreatorProfile"("userId");
CREATE UNIQUE INDEX "CreatorProfile_slug_key" ON "CreatorProfile"("slug");
CREATE INDEX "CreatorProfile_displayName_idx" ON "CreatorProfile"("displayName");
ALTER TABLE "CreatorProfile" ADD CONSTRAINT "CreatorProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CreatorOverlayToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreatorOverlayToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CreatorOverlayToken_userId_key" ON "CreatorOverlayToken"("userId");
CREATE UNIQUE INDEX "CreatorOverlayToken_token_key" ON "CreatorOverlayToken"("token");
ALTER TABLE "CreatorOverlayToken" ADD CONSTRAINT "CreatorOverlayToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CreatorStreamSchedule" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "gameSlug" VARCHAR(64),
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "streamUrl" VARCHAR(500),
  "status" VARCHAR(24) NOT NULL DEFAULT 'scheduled',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreatorStreamSchedule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CreatorStreamSchedule_ownerId_scheduledAt_idx"
  ON "CreatorStreamSchedule"("ownerId", "scheduledAt");
CREATE INDEX "CreatorStreamSchedule_status_scheduledAt_idx"
  ON "CreatorStreamSchedule"("status", "scheduledAt");
ALTER TABLE "CreatorStreamSchedule" ADD CONSTRAINT "CreatorStreamSchedule_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CreatorClip" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" VARCHAR(64) NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "durationMs" INTEGER,
  "trimStartMs" INTEGER NOT NULL DEFAULT 0,
  "trimEndMs" INTEGER,
  "visibility" VARCHAR(16) NOT NULL DEFAULT 'public',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreatorClip_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CreatorClip_storageKey_key" ON "CreatorClip"("storageKey");
CREATE INDEX "CreatorClip_ownerId_createdAt_idx" ON "CreatorClip"("ownerId", "createdAt");
CREATE INDEX "CreatorClip_visibility_createdAt_idx" ON "CreatorClip"("visibility", "createdAt");
ALTER TABLE "CreatorClip" ADD CONSTRAINT "CreatorClip_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CreatorClipVote" (
  "id" TEXT NOT NULL,
  "clipId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "value" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreatorClipVote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CreatorClipVote_clipId_userId_key" ON "CreatorClipVote"("clipId", "userId");
ALTER TABLE "CreatorClipVote" ADD CONSTRAINT "CreatorClipVote_clipId_fkey"
  FOREIGN KEY ("clipId") REFERENCES "CreatorClip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreatorClipVote" ADD CONSTRAINT "CreatorClipVote_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CreatorChannelReward" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "title" VARCHAR(80) NOT NULL,
  "description" VARCHAR(240) NOT NULL DEFAULT '',
  "cost" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreatorChannelReward_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CreatorChannelReward_ownerId_active_idx"
  ON "CreatorChannelReward"("ownerId", "active");
ALTER TABLE "CreatorChannelReward" ADD CONSTRAINT "CreatorChannelReward_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CreatorPointBalance" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "viewerId" TEXT NOT NULL,
  "points" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreatorPointBalance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CreatorPointBalance_ownerId_viewerId_key"
  ON "CreatorPointBalance"("ownerId", "viewerId");
ALTER TABLE "CreatorPointBalance" ADD CONSTRAINT "CreatorPointBalance_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreatorPointBalance" ADD CONSTRAINT "CreatorPointBalance_viewerId_fkey"
  FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CreatorPointTransaction" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "viewerId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "reason" VARCHAR(120) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreatorPointTransaction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CreatorPointTransaction_ownerId_viewerId_createdAt_idx"
  ON "CreatorPointTransaction"("ownerId", "viewerId", "createdAt");
ALTER TABLE "CreatorPointTransaction" ADD CONSTRAINT "CreatorPointTransaction_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreatorPointTransaction" ADD CONSTRAINT "CreatorPointTransaction_viewerId_fkey"
  FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CreatorRewardRedemption" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "viewerId" TEXT NOT NULL,
  "rewardId" TEXT NOT NULL,
  "pointsSpent" INTEGER NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreatorRewardRedemption_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CreatorRewardRedemption_ownerId_status_createdAt_idx"
  ON "CreatorRewardRedemption"("ownerId", "status", "createdAt");
CREATE INDEX "CreatorRewardRedemption_viewerId_createdAt_idx"
  ON "CreatorRewardRedemption"("viewerId", "createdAt");
ALTER TABLE "CreatorRewardRedemption" ADD CONSTRAINT "CreatorRewardRedemption_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreatorRewardRedemption" ADD CONSTRAINT "CreatorRewardRedemption_viewerId_fkey"
  FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreatorRewardRedemption" ADD CONSTRAINT "CreatorRewardRedemption_rewardId_fkey"
  FOREIGN KEY ("rewardId") REFERENCES "CreatorChannelReward"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CreatorWatchParty" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "description" VARCHAR(500) NOT NULL DEFAULT '',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "streamUrl" VARCHAR(500),
  "status" VARCHAR(24) NOT NULL DEFAULT 'scheduled',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreatorWatchParty_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CreatorWatchParty_startsAt_status_idx" ON "CreatorWatchParty"("startsAt", "status");
ALTER TABLE "CreatorWatchParty" ADD CONSTRAINT "CreatorWatchParty_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CreatorWatchPartyParticipant" (
  "id" TEXT NOT NULL,
  "watchPartyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreatorWatchPartyParticipant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CreatorWatchPartyParticipant_watchPartyId_userId_key"
  ON "CreatorWatchPartyParticipant"("watchPartyId", "userId");
ALTER TABLE "CreatorWatchPartyParticipant" ADD CONSTRAINT "CreatorWatchPartyParticipant_watchPartyId_fkey"
  FOREIGN KEY ("watchPartyId") REFERENCES "CreatorWatchParty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreatorWatchPartyParticipant" ADD CONSTRAINT "CreatorWatchPartyParticipant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CreatorFollow" (
  "id" TEXT NOT NULL,
  "followerId" TEXT NOT NULL,
  "creatorProfileId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreatorFollow_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CreatorFollow_followerId_creatorProfileId_key"
  ON "CreatorFollow"("followerId", "creatorProfileId");
CREATE INDEX "CreatorFollow_creatorProfileId_createdAt_idx"
  ON "CreatorFollow"("creatorProfileId", "createdAt");
ALTER TABLE "CreatorFollow" ADD CONSTRAINT "CreatorFollow_followerId_fkey"
  FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreatorFollow" ADD CONSTRAINT "CreatorFollow_creatorProfileId_fkey"
  FOREIGN KEY ("creatorProfileId") REFERENCES "CreatorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CreatorCoStreamRequest" (
  "id" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "creatorId" TEXT NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'pending',
  "message" VARCHAR(500) NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreatorCoStreamRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CreatorCoStreamRequest_tournamentId_creatorId_key"
  ON "CreatorCoStreamRequest"("tournamentId", "creatorId");
CREATE INDEX "CreatorCoStreamRequest_tournamentId_status_idx"
  ON "CreatorCoStreamRequest"("tournamentId", "status");
ALTER TABLE "CreatorCoStreamRequest" ADD CONSTRAINT "CreatorCoStreamRequest_tournamentId_fkey"
  FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreatorCoStreamRequest" ADD CONSTRAINT "CreatorCoStreamRequest_creatorId_fkey"
  FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
