import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().trim().min(3).max(40),
  gameSlug: z.enum(["pubg-mobile", "free-fire", "tekken-8", "fifa"]),
});

export async function GET() {
  try {
    const teams = await prisma.team.findMany({
      include: { memberships: { include: { user: { select: { name: true, profile: { select: { handle: true } } } } } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ teams });
  } catch (error) {
    console.error("Team directory query failed.", error);
    return NextResponse.json({ error: "Team directory is unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const input = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Team details are invalid." }, { status: 400 });
  const slugBase = parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  const slug = `${slugBase}-${randomUUID().slice(0, 6)}`;
  try {
    const team = await prisma.$transaction(async (transaction) => {
      const created = await transaction.team.create({
        data: {
          name: parsed.data.name,
          slug,
          gameSlug: parsed.data.gameSlug,
          memberships: { create: { userId: session.user.id, role: "captain" } },
          chatRoom: { create: { slug: `team:${slug}`, type: "team" } },
        },
      });
      await transaction.user.updateMany({
        where: { id: session.user.id, role: { in: ["USER", "PLAYER"] } },
        data: { role: "TEAM_CAPTAIN" },
      });
      await transaction.auditLog.create({
        data: { actorId: session.user.id, action: "team.create", targetType: "team", targetId: created.id },
      });
      return created;
    });
    return NextResponse.json({ team }, { status: 201 });
  } catch (error) {
    console.error("Team creation failed.", error);
    return NextResponse.json({ error: "Unable to create team." }, { status: 503 });
  }
}
