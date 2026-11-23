import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@clutchverse/db";
import { getSeasonalPlayActor } from "@/lib/seasonal-play-api";
import { ensureCurrentSeason } from "@/lib/seasonal-play";

const schema = z.object({ inviteCode: z.string().trim().min(6).max(16).transform((value) => value.toUpperCase()) });

export async function POST(request: Request) {
  const result = await getSeasonalPlayActor(request);
  if ("error" in result) return result.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invite code is invalid." }, { status: 400 });
  const season = await ensureCurrentSeason();
  const league = await prisma.seasonLeague.findFirst({
    where: { inviteCode: parsed.data.inviteCode, seasonId: season.id },
    select: { id: true },
  });
  if (!league) return NextResponse.json({ error: "No current-season league matches that invite code." }, { status: 404 });
  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.seasonLeagueMember.create({
        data: { leagueId: league.id, userId: result.actor.userId },
      });
      await transaction.auditLog.create({
        data: {
          actorId: result.actor.userId,
          action: "seasonal-play.league.join",
          targetType: "season-league",
          targetId: league.id,
        },
      });
    });
    return NextResponse.json({ joined: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "You are already in this league." }, { status: 409 });
    }
    console.error("Seasonal league join failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json({ error: "Unable to join the league." }, { status: 503 });
  }
}
