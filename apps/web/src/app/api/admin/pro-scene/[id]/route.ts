import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@clutchverse/db";
import { auth } from "@/auth";

async function adminId() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sign in required.", status: 401 as const };
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  return user?.role === "ADMIN"
    ? { userId: session.user.id }
    : { error: "Administrator permission required.", status: 403 as const };
}

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  status: z.enum(["upcoming", "live", "completed"]).optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  prizePool: z.string().trim().max(80).nullable().optional(),
  region: z.string().trim().max(80).nullable().optional(),
  stage: z.string().trim().max(80).nullable().optional(),
  format: z.string().trim().max(80).nullable().optional(),
  sourceName: z.string().trim().min(2).max(100).optional(),
  sourceUrl: z.string().url().startsWith("https://").optional(),
  license: z.string().trim().min(2).max(120).optional(),
}).refine((value) => Object.keys(value).length > 0);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await adminId();
  if ("error" in actor)
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid event update." }, { status: 400 });
  const { startsAt, endsAt, ...fields } = parsed.data;
  try {
    const event = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.proSceneEvent.update({
        where: { id },
        data: {
          ...fields,
          ...(startsAt !== undefined ? { startsAt: startsAt ? new Date(startsAt) : null } : {}),
          ...(endsAt !== undefined ? { endsAt: endsAt ? new Date(endsAt) : null } : {}),
          fetchedAt: new Date(),
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: actor.userId,
          action: "pro-scene.event.update",
          targetType: "pro-scene-event",
          targetId: id,
        },
      });
      return saved;
    });
    return NextResponse.json({ event });
  } catch (error) {
    console.error("Pro Scene event update failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json({ error: "Unable to update sourced event." }, { status: 503 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await adminId();
  if ("error" in actor)
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  const { id } = await params;
  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.proSceneEvent.delete({ where: { id } });
      await transaction.auditLog.create({
        data: {
          actorId: actor.userId,
          action: "pro-scene.event.delete",
          targetType: "pro-scene-event",
          targetId: id,
        },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Pro Scene event deletion failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json({ error: "Unable to delete sourced event." }, { status: 503 });
  }
}
