import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@clutchverse/db";
import { auth } from "@/auth";

export const runtime = "nodejs";

const resolutionSchema = z.object({
  status: z.enum(["reviewed", "dismissed", "action_taken"]),
  resolution: z.string().trim().min(10).max(1000),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!user || !["MODERATOR", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Moderator permission required." }, { status: 403 });
  }
  const input = await request.json().catch(() => null);
  const parsed = resolutionSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Resolution details are invalid." }, { status: 400 });
  const { id } = await params;
  try {
    const report = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.report.update({
        where: { id },
        data: { status: parsed.data.status, reviewerId: session.user.id, evidence: { resolution: parsed.data.resolution } },
      });
      await transaction.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "report.resolve",
          targetType: "report",
          targetId: updated.id,
          metadata: { status: updated.status },
        },
      });
      return updated;
    });
    return NextResponse.json({ report: { id: report.id, status: report.status } });
  } catch (error) {
    console.error("Report resolution failed.", error);
    return NextResponse.json({ error: "Unable to resolve this report." }, { status: 503 });
  }
}
