import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { checkRateLimit, getRequestAddress } from "@/lib/rate-limit";

const reviewSchema = z.object({
  reportId: z.string().min(1).max(64),
  decision: z.enum(["reviewed", "dismissed"]),
});

async function getModerator(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  const limit = await checkRateLimit(`ai-moderation:${session.user.id}:${getRequestAddress(request)}`, 30, 60_000);
  if (!limit.allowed) return { error: NextResponse.json({ error: "Too many requests." }, { status: 429 }) };
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!user || !["MODERATOR", "ADMIN"].includes(user.role)) {
    return { error: NextResponse.json({ error: "Moderator permission required." }, { status: 403 }) };
  }
  return { userId: session.user.id };
}

export async function GET(request: Request) {
  const result = await getModerator(request);
  if ("error" in result) return result.error;
  try {
    const reports = await prisma.report.findMany({
      where: { status: "open", targetType: "chat" },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    const aiReports = reports.filter((report) =>
      typeof report.evidence === "object" &&
      report.evidence !== null &&
      !Array.isArray(report.evidence) &&
      "source" in report.evidence &&
      report.evidence.source === "ai-moderation",
    );
    const messages = await prisma.chatMessage.findMany({
      where: { id: { in: aiReports.map((report) => report.targetId) } },
      select: {
        id: true,
        body: true,
        deletedAt: true,
        author: { select: { name: true, profile: { select: { handle: true } } } },
      },
    });
    const messageById = new Map(messages.map((message) => [message.id, message]));
    return NextResponse.json({
      reports: aiReports.map((report) => {
        const evidence = report.evidence;
        const message = messageById.get(report.targetId);
        const category =
          typeof evidence === "object" && evidence !== null && !Array.isArray(evidence) &&
          "category" in evidence && typeof evidence.category === "string"
            ? evidence.category
            : "unknown";
        const confidence =
          typeof evidence === "object" && evidence !== null && !Array.isArray(evidence) &&
          "confidence" in evidence && typeof evidence.confidence === "number"
            ? evidence.confidence
            : null;
        return {
          id: report.id,
          targetId: report.targetId,
          author: message?.author.profile?.handle ?? message?.author.name ?? "Player",
          body: message?.deletedAt ? null : message?.body ?? null,
          category,
          confidence,
          createdAt: report.createdAt,
        };
      }),
    });
  } catch (error) {
    console.error("AI moderation queue load failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json({ error: "Unable to load the moderation queue." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const result = await getModerator(request);
  if ("error" in result) return result.error;
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Review decision is invalid." }, { status: 400 });
  try {
    const updated = await prisma.$transaction(async (transaction) => {
      const report = await transaction.report.findFirst({
        where: {
          id: parsed.data.reportId,
          status: "open",
          targetType: "chat",
        },
        select: { id: true, evidence: true },
      });
      if (!report || typeof report.evidence !== "object" || report.evidence === null ||
          Array.isArray(report.evidence) || !("source" in report.evidence) ||
          report.evidence.source !== "ai-moderation") return null;
      const saved = await transaction.report.update({
        where: { id: report.id },
        data: { status: parsed.data.decision, reviewerId: result.userId },
      });
      await transaction.auditLog.create({
        data: {
          actorId: result.userId,
          action: `chat.ai-moderation.${parsed.data.decision}`,
          targetType: "report",
          targetId: saved.id,
          metadata: { automaticAction: false },
        },
      });
      return saved;
    });
    if (!updated) return NextResponse.json({ error: "Open AI moderation flag not found." }, { status: 404 });
    return NextResponse.json({ status: updated.status });
  } catch (error) {
    console.error("AI moderation review update failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json({ error: "Unable to save the moderation decision." }, { status: 503 });
  }
}
