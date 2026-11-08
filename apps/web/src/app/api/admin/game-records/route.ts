import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@clutchverse/db";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const recordSchema = z.object({
  gameSlug: z.enum(["pubg-mobile", "free-fire", "tekken-8", "fifa"]),
  title: z.string().trim().min(4).max(120),
  holder: z.string().trim().min(2).max(100),
  value: z.string().trim().min(1).max(120),
  achievedAt: z.string().datetime(),
  proofUrl: z
    .string()
    .url()
    .startsWith("https://")
    .optional()
    .or(z.literal("")),
});

async function adminSession() {
  const session = await auth();
  if (!session?.user?.id)
    return { error: "Sign in required.", status: 401 as const };
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "ADMIN")
    return {
      error: "Administrator permission required.",
      status: 403 as const,
    };
  return { userId: session.user.id };
}

export async function GET() {
  const actor = await adminSession();
  if ("error" in actor)
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  const records = await prisma.gameRecord.findMany({
    orderBy: [{ gameSlug: "asc" }, { achievedAt: "desc" }],
  });
  return NextResponse.json({ records });
}

export async function POST(request: Request) {
  const actor = await adminSession();
  if ("error" in actor)
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  const input = await request.json().catch(() => null);
  const parsed = recordSchema.safeParse(input);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Record details are invalid." },
      { status: 400 },
    );
  const { achievedAt, proofUrl, ...data } = parsed.data;
  const record = await prisma.$transaction(async (transaction) => {
    const saved = await transaction.gameRecord.create({
      data: {
        ...data,
        achievedAt: new Date(achievedAt),
        proofUrl: proofUrl || null,
        verificationLabel: "community-verified",
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId: actor.userId,
        action: "game-record.create",
        targetType: "game-record",
        targetId: saved.id,
        metadata: { gameSlug: saved.gameSlug, title: saved.title },
      },
    });
    return saved;
  });
  return NextResponse.json({ record }, { status: 201 });
}
