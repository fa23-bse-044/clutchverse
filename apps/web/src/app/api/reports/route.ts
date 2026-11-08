import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@clutchverse/db";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reportSchema = z.object({
  targetType: z.enum(["player", "team", "match", "chat"]),
  targetId: z.string().trim().min(1).max(100),
  reason: z.enum(["cheating", "harassment", "result_dispute", "spam", "other"]),
  details: z.string().trim().min(20).max(2000),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const input = await request.json().catch(() => null);
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Report details are invalid.", issues: parsed.error.flatten() }, { status: 400 });
  try {
    const report = await prisma.$transaction(async (transaction) => {
      const created = await transaction.report.create({
        data: {
          reporterId: session.user.id,
          targetType: parsed.data.targetType,
          targetId: parsed.data.targetId,
          reason: parsed.data.reason,
          evidence: { details: parsed.data.details },
        },
      });
      await transaction.auditLog.create({
        data: { actorId: session.user.id, action: "report.create", targetType: "report", targetId: created.id },
      });
      return created;
    });
    return NextResponse.json({ report: { id: report.id, status: report.status } }, { status: 201 });
  } catch (error) {
    console.error("Report submission failed.", error);
    return NextResponse.json({ error: "Unable to submit your report." }, { status: 503 });
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!user || !["MODERATOR", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Moderator permission required." }, { status: 403 });
  }
  try {
    const reports = await prisma.report.findMany({ where: { status: "open" }, orderBy: { createdAt: "asc" }, take: 100 });
    return NextResponse.json({ reports });
  } catch (error) {
    console.error("Report queue query failed.", error);
    return NextResponse.json({ error: "Report queue is unavailable." }, { status: 503 });
  }
}
