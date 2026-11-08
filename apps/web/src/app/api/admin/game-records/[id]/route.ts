import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@clutchverse/db";
import { auth } from "@/auth";

export const runtime = "nodejs";

const updateSchema = z
  .object({
    gameSlug: z
      .enum(["pubg-mobile", "free-fire", "tekken-8", "fifa"])
      .optional(),
    title: z.string().trim().min(4).max(120).optional(),
    holder: z.string().trim().min(2).max(100).optional(),
    value: z.string().trim().min(1).max(120).optional(),
    achievedAt: z.string().datetime().optional(),
    proofUrl: z
      .string()
      .url()
      .startsWith("https://")
      .optional()
      .or(z.literal("")),
  })
  .refine((value) => Object.keys(value).length > 0);

async function getAdminId() {
  const session = await auth();
  if (!session?.user?.id)
    return { error: "Sign in required.", status: 401 as const };
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  return user?.role === "ADMIN"
    ? { userId: session.user.id }
    : { error: "Administrator permission required.", status: 403 as const };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getAdminId();
  if ("error" in actor)
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  const { id } = await params;
  const input = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Record updates are invalid." },
      { status: 400 },
    );
  const { achievedAt, proofUrl, ...rest } = parsed.data;
  const record = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.gameRecord.update({
      where: { id },
      data: {
        ...rest,
        ...(achievedAt ? { achievedAt: new Date(achievedAt) } : {}),
        ...(proofUrl !== undefined ? { proofUrl: proofUrl || null } : {}),
        verificationLabel: "community-verified",
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId: actor.userId,
        action: "game-record.update",
        targetType: "game-record",
        targetId: id,
        metadata: { gameSlug: updated.gameSlug, title: updated.title },
      },
    });
    return updated;
  });
  return NextResponse.json({ record });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getAdminId();
  if ("error" in actor)
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  const { id } = await params;
  await prisma.$transaction(async (transaction) => {
    await transaction.gameRecord.delete({ where: { id } });
    await transaction.auditLog.create({
      data: {
        actorId: actor.userId,
        action: "game-record.delete",
        targetType: "game-record",
        targetId: id,
      },
    });
  });
  return NextResponse.json({ ok: true });
}
