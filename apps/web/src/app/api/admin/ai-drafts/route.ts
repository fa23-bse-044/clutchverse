import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { checkRateLimit, getRequestAddress } from "@/lib/rate-limit";

const reviewSchema = z.object({
  id: z.string().min(1).max(64),
  decision: z.enum(["approved", "rejected"]),
});

async function getAdministrator(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  const limit = await checkRateLimit(`ai-drafts:${session.user.id}:${getRequestAddress(request)}`, 30, 60_000);
  if (!limit.allowed) return { error: NextResponse.json({ error: "Too many requests." }, { status: 429 }) };
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (user?.role !== "ADMIN") return { error: NextResponse.json({ error: "Administrator permission required." }, { status: 403 }) };
  return { userId: session.user.id };
}

export async function GET(request: Request) {
  const result = await getAdministrator(request);
  if ("error" in result) return result.error;
  try {
    const drafts = await prisma.aiGeneratedDraft.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      take: 100,
      select: {
        id: true,
        kind: true,
        title: true,
        content: true,
        createdAt: true,
        owner: { select: { name: true, profile: { select: { handle: true } } } },
      },
    });
    return NextResponse.json({ drafts });
  } catch (error) {
    console.error("AI draft review queue load failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json({ error: "Unable to load the AI draft queue." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const result = await getAdministrator(request);
  if ("error" in result) return result.error;
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Draft review details are invalid." }, { status: 400 });
  try {
    const draft = await prisma.$transaction(async (transaction) => {
      const current = await transaction.aiGeneratedDraft.findUnique({
        where: { id: parsed.data.id },
        select: { status: true },
      });
      if (!current) return null;
      if (current.status !== "pending") return { conflict: true as const };
      const updated = await transaction.aiGeneratedDraft.update({
        where: { id: parsed.data.id },
        data: { status: parsed.data.decision, reviewedBy: result.userId, reviewedAt: new Date() },
        select: { id: true, status: true },
      });
      await transaction.auditLog.create({
        data: {
          actorId: result.userId,
          action: `ai-draft.${parsed.data.decision}`,
          targetType: "ai-generated-draft",
          targetId: updated.id,
          metadata: { status: updated.status, publishingAction: false },
        },
      });
      return updated;
    });
    if (!draft) return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    if ("conflict" in draft) return NextResponse.json({ error: "Draft has already been reviewed." }, { status: 409 });
    return NextResponse.json({ draft });
  } catch (error) {
    console.error("AI draft review update failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json({ error: "Unable to save draft review." }, { status: 503 });
  }
}
