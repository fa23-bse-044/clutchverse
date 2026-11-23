import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@clutchverse/db";
import { getSeasonalPlayActor } from "@/lib/seasonal-play-api";
import { ensureCurrentSeason, newSeasonInviteCode } from "@/lib/seasonal-play";

const schema = z.object({ name: z.string().trim().min(3).max(64) });

export async function POST(request: Request) {
  const result = await getSeasonalPlayActor(request);
  if ("error" in result) return result.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "League name must be 3–64 characters." }, { status: 400 });
  const season = await ensureCurrentSeason();
  try {
    const count = await prisma.seasonLeague.count({ where: { seasonId: season.id, ownerId: result.actor.userId } });
    if (count >= 5) return NextResponse.json({ error: "You can create up to five leagues per season." }, { status: 409 });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const league = await prisma.$transaction(async (transaction) => {
          const created = await transaction.seasonLeague.create({
            data: {
              seasonId: season.id,
              ownerId: result.actor.userId,
              name: parsed.data.name,
              inviteCode: newSeasonInviteCode(),
            },
          });
          await transaction.seasonLeagueMember.create({
            data: { leagueId: created.id, userId: result.actor.userId },
          });
          await transaction.auditLog.create({
            data: {
              actorId: result.actor.userId,
              action: "seasonal-play.league.create",
              targetType: "season-league",
              targetId: created.id,
              metadata: { seasonId: season.id },
            },
          });
          return created;
        });
        return NextResponse.json({ league: { id: league.id, name: league.name, inviteCode: league.inviteCode } }, { status: 201 });
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "P2002")) throw error;
      }
    }
    return NextResponse.json({ error: "Unable to create a unique invite code." }, { status: 503 });
  } catch (error) {
    console.error("Seasonal league creation failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json({ error: "Unable to create the league." }, { status: 503 });
  }
}
