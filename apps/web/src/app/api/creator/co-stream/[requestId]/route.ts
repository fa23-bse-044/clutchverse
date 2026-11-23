import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { checkRateLimit, getRequestAddress } from "@/lib/rate-limit";
import { isCreatorToolsEnabled } from "@/lib/creator-tools";

const decisionSchema = z.object({ status: z.enum(["approved", "declined"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!(await isCreatorToolsEnabled())) return NextResponse.json({ error: "Creator tools are unavailable." }, { status: 404 });
  const limit = await checkRateLimit(`creator-costream-decision:${session.user.id}:${getRequestAddress(request)}`, 20, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const parsed = decisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Decision is invalid." }, { status: 400 });
  const { requestId } = await params;
  const current = await prisma.creatorCoStreamRequest.findUnique({
    where: { id: requestId },
    select: { id: true, tournament: { select: { organizerId: true } }, creatorId: true },
  });
  if (!current) return NextResponse.json({ error: "Request not found." }, { status: 404 });
  const admin = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (current.tournament.organizerId !== session.user.id && admin?.role !== "ADMIN")
    return NextResponse.json({ error: "Tournament organizer permission required." }, { status: 403 });
  try {
    const saved = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.creatorCoStreamRequest.update({
        where: { id: requestId },
        data: { status: parsed.data.status },
      });
      await transaction.notification.create({
        data: { userId: current.creatorId, type: `creator.costream.${parsed.data.status}`, payload: { requestId } },
      });
      await transaction.auditLog.create({
        data: { actorId: session.user.id, action: `creator.costream.${parsed.data.status}`, targetType: "creator-costream-request", targetId: requestId },
      });
      return updated;
    });
    return NextResponse.json({ status: saved.status });
  } catch (error) {
    console.error("Creator co-stream decision failed.", { reason: error instanceof Error ? error.name : "database-error" });
    return NextResponse.json({ error: "Unable to save decision." }, { status: 503 });
  }
}
