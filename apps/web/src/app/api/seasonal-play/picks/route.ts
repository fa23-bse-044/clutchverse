import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@clutchverse/db";
import { getSeasonalPlayActor } from "@/lib/seasonal-play-api";
import { ensureCurrentSeason } from "@/lib/seasonal-play";

const schema = z.object({
  leagueId: z.string().min(1).max(64),
  eventType: z.enum(["match", "pro-scene"]),
  eventRefId: z.string().min(1).max(64),
  selectionRefId: z.string().min(1).max(64),
});

export async function POST(request: Request) {
  const result = await getSeasonalPlayActor(request);
  if ("error" in result) return result.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pick details are invalid." }, { status: 400 });
  const season = await ensureCurrentSeason();
  const league = await prisma.seasonLeagueMember.findFirst({
    where: { leagueId: parsed.data.leagueId, userId: result.actor.userId, league: { seasonId: season.id } },
    select: { leagueId: true },
  });
  if (!league) return NextResponse.json({ error: "Join this current-season league before making picks." }, { status: 403 });
  const now = new Date();
  if (parsed.data.eventType === "match") {
    const match = await prisma.match.findFirst({
      where: {
        id: parsed.data.eventRefId,
        state: { notIn: ["completed", "disputed"] },
        startsAt: { gt: now },
        OR: [
          { entrantAId: parsed.data.selectionRefId },
          { entrantBId: parsed.data.selectionRefId },
        ],
      },
      select: { id: true },
    });
    if (!match) return NextResponse.json({ error: "Pick an entrant from a future, unresolved match." }, { status: 400 });
  } else {
    const event = await prisma.proSceneEvent.findFirst({
      where: {
        id: parsed.data.eventRefId,
        status: "upcoming",
        startsAt: { gt: now },
        teams: { some: { teamId: parsed.data.selectionRefId } },
      },
      select: { id: true },
    });
    if (!event) return NextResponse.json({ error: "Pick a team in an upcoming licensed event." }, { status: 400 });
  }
  try {
    const pick = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.seasonPick.upsert({
        where: {
          leagueId_userId_eventType_eventRefId: {
            leagueId: league.leagueId,
            userId: result.actor.userId,
            eventType: parsed.data.eventType,
            eventRefId: parsed.data.eventRefId,
          },
        },
        create: {
          seasonId: season.id,
          leagueId: league.leagueId,
          userId: result.actor.userId,
          eventType: parsed.data.eventType,
          eventRefId: parsed.data.eventRefId,
          selectionRefId: parsed.data.selectionRefId,
        },
        update: { selectionRefId: parsed.data.selectionRefId },
      });
      await transaction.auditLog.create({
        data: {
          actorId: result.actor.userId,
          action: "seasonal-play.pick.submit",
          targetType: "season-pick",
          targetId: saved.id,
          metadata: { eventType: saved.eventType, eventRefId: saved.eventRefId, leagueId: league.leagueId },
        },
      });
      return saved;
    });
    return NextResponse.json({ pick: { id: pick.id } }, { status: 201 });
  } catch (error) {
    console.error("Seasonal pick submission failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json({ error: "Unable to save this pick." }, { status: 503 });
  }
}
