CREATE TYPE "ChatbotMessageRole" AS ENUM ('USER', 'ASSISTANT');

CREATE TABLE "ChatbotConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChatbotConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatbotMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "ChatbotMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatbotMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChatbotConversation_userId_updatedAt_idx"
    ON "ChatbotConversation"("userId", "updatedAt");
CREATE INDEX "ChatbotMessage_conversationId_createdAt_idx"
    ON "ChatbotMessage"("conversationId", "createdAt");

ALTER TABLE "ChatbotConversation"
    ADD CONSTRAINT "ChatbotConversation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatbotMessage"
    ADD CONSTRAINT "ChatbotMessage_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "ChatbotConversation"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
