CREATE TABLE "GameRecord" (
    "id" TEXT NOT NULL,
    "gameSlug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "holder" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "achievedAt" TIMESTAMP(3) NOT NULL,
    "proofUrl" TEXT,
    "verificationLabel" TEXT NOT NULL DEFAULT 'community-verified',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GameRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "deliveryStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GameRecord_gameSlug_title_holder_key"
    ON "GameRecord"("gameSlug", "title", "holder");
CREATE INDEX "GameRecord_gameSlug_achievedAt_idx"
    ON "GameRecord"("gameSlug", "achievedAt");
CREATE INDEX "ContactMessage_createdAt_idx"
    ON "ContactMessage"("createdAt");

ALTER TABLE "GameRecord"
    ADD CONSTRAINT "GameRecord_gameSlug_fkey"
    FOREIGN KEY ("gameSlug") REFERENCES "Game"("slug")
    ON DELETE CASCADE ON UPDATE CASCADE;
