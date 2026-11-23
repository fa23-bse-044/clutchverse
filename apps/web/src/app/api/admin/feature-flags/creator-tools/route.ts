import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { checkRateLimit, getRequestAddress } from "@/lib/rate-limit";
import { CREATOR_TOOLS_FLAG } from "@/lib/creator-tools";

const schema = z.object({ enabled: z.boolean() });

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const rate = await checkRateLimit(`creator-flag:${session.user.id}:${getRequestAddress(request)}`, 10, 60_000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Administrator permission required." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Feature flag value is invalid." }, { status: 400 });
  try {
    const flag = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.featureFlag.upsert({
        where: { key: CREATOR_TOOLS_FLAG },
        create: { key: CREATOR_TOOLS_FLAG, enabled: parsed.data.enabled, updatedBy: session.user.id },
        update: { enabled: parsed.data.enabled, updatedBy: session.user.id },
      });
      await transaction.auditLog.create({
        data: { actorId: session.user.id, action: "feature-flag.update", targetType: "feature-flag", targetId: CREATOR_TOOLS_FLAG, metadata: { enabled: saved.enabled } },
      });
      return saved;
    });
    return NextResponse.json({ enabled: flag.enabled });
  } catch (error) {
    console.error("Creator tools feature-flag update failed.", { reason: error instanceof Error ? error.name : "database-error" });
    return NextResponse.json({ error: "Unable to update creator tools flag." }, { status: 503 });
  }
}
