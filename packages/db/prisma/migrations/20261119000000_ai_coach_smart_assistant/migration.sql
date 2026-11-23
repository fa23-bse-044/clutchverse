ALTER TABLE "User"
ADD COLUMN "chatTranslationEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "AiGeneratedDraft" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "kind" VARCHAR(24) NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "content" TEXT NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'pending',
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiGeneratedDraft_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiGeneratedDraft_status_createdAt_idx"
  ON "AiGeneratedDraft"("status", "createdAt");
CREATE INDEX "AiGeneratedDraft_ownerId_createdAt_idx"
  ON "AiGeneratedDraft"("ownerId", "createdAt");
ALTER TABLE "AiGeneratedDraft" ADD CONSTRAINT "AiGeneratedDraft_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
