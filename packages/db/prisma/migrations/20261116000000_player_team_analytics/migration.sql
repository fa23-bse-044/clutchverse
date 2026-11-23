CREATE TABLE "AnalyticsManualEntry" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "gameSlug" TEXT NOT NULL,
  "playedAt" TIMESTAMP(3) NOT NULL,
  "opponent" VARCHAR(120),
  "scoreFor" INTEGER,
  "scoreAgainst" INTEGER,
  "placement" INTEGER,
  "kills" INTEGER,
  "deaths" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalyticsManualEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AnalyticsManualEntry_userId_playedAt_idx"
  ON "AnalyticsManualEntry"("userId", "playedAt");
CREATE INDEX "AnalyticsManualEntry_gameSlug_playedAt_idx"
  ON "AnalyticsManualEntry"("gameSlug", "playedAt");
ALTER TABLE "AnalyticsManualEntry" ADD CONSTRAINT "AnalyticsManualEntry_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsManualEntry" ADD CONSTRAINT "AnalyticsManualEntry_gameSlug_fkey"
  FOREIGN KEY ("gameSlug") REFERENCES "Game"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AnalyticsShareCard" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalyticsShareCard_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AnalyticsShareCard_userId_key" ON "AnalyticsShareCard"("userId");
CREATE UNIQUE INDEX "AnalyticsShareCard_token_key" ON "AnalyticsShareCard"("token");
ALTER TABLE "AnalyticsShareCard" ADD CONSTRAINT "AnalyticsShareCard_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AnalyticsRatingSnapshot" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "gameSlug" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "capturedOn" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AnalyticsRatingSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AnalyticsRatingSnapshot_userId_gameSlug_period_capturedOn_key"
  ON "AnalyticsRatingSnapshot"("userId", "gameSlug", "period", "capturedOn");
CREATE INDEX "AnalyticsRatingSnapshot_userId_gameSlug_capturedOn_idx"
  ON "AnalyticsRatingSnapshot"("userId", "gameSlug", "capturedOn");
ALTER TABLE "AnalyticsRatingSnapshot" ADD CONSTRAINT "AnalyticsRatingSnapshot_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalyticsRatingSnapshot" ADD CONSTRAINT "AnalyticsRatingSnapshot_gameSlug_fkey"
  FOREIGN KEY ("gameSlug") REFERENCES "Game"("slug") ON DELETE CASCADE ON UPDATE CASCADE;
