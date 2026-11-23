import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { checkRateLimit, getRequestAddress } from "@/lib/rate-limit";
import { AI_ASSISTANT_FLAG, isAiAssistantEnabled } from "@/lib/ai-assistant";

const preferenceSchema = z.object({ translationEnabled: z.boolean() });

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!(await isAiAssistantEnabled())) return NextResponse.json({ error: "AI assistant features are unavailable." }, { status: 404 });
  const limit = await checkRateLimit(`chat-preferences:${session.user.id}:${getRequestAddress(request)}`, 30, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { locale: true, chatTranslationEnabled: true },
  });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
  return NextResponse.json({
    featuresEnabled: true,
    translationEnabled: user.chatTranslationEnabled,
    locale: ["en", "ar", "ur", "zh", "hi", "es"].includes(user.locale) ? user.locale : "en",
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!(await isAiAssistantEnabled())) return NextResponse.json({ error: "AI assistant features are unavailable." }, { status: 404 });
  const limit = await checkRateLimit(`chat-preferences:${session.user.id}:${getRequestAddress(request)}`, 10, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const parsed = preferenceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Translation preference is invalid." }, { status: 400 });
  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: session.user.id },
        data: { chatTranslationEnabled: parsed.data.translationEnabled },
      });
      await transaction.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "chat.translation.preference",
          targetType: "user-chat-preference",
          targetId: session.user.id,
          metadata: { enabled: parsed.data.translationEnabled, feature: AI_ASSISTANT_FLAG },
        },
      });
    });
    return NextResponse.json({ translationEnabled: parsed.data.translationEnabled });
  } catch (error) {
    console.error("Chat translation preference update failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json({ error: "Unable to update translation preference." }, { status: 503 });
  }
}
