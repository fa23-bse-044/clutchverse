import { NextResponse } from "next/server";
import type { SpotlightCsvTeam } from "@/lib/spotlight-domain";
import { z } from "zod";
import { auth } from "@/auth";
import { findSpotlightConfig } from "@/config/spotlight-events";
import { prisma } from "@clutchverse/db";
import { checkRateLimit, getRequestAddress } from "@/lib/rate-limit";
import {
  isIsoCountryCode,
  isSpotlightDraftReviewable,
  isValidSourceUrl,
  parseSpotlightCsv,
} from "@/lib/spotlight-domain";
import {
  getCachedSpotlightSnapshot,
  getSpotlightSnapshot,
  publishSpotlightChange,
} from "@/lib/spotlight";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

class SpotlightInputError extends Error {
  name = "SpotlightInputError";
}

const sourceFields = {
  sourceName: z.string().trim().min(1).max(120),
  sourceUrl: z.string().trim().url().max(2048).refine(isValidSourceUrl),
};
const eventSchema = z.object({
  action: z.literal("event"),
  displayName: z.string().trim().min(1).max(160),
  status: z.enum(["upcoming", "live", "completed"]),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  venue: z.string().trim().max(160).nullable().optional(),
  prizePool: z.string().trim().max(80).nullable().optional(),
  totalSlots: z.number().int().positive().max(500).nullable().optional(),
  officialLinks: z.array(z.string().url().max(2048).refine(isValidSourceUrl)).max(20),
  ...sourceFields,
});
const teamSchema = z.object({
  action: z.literal("team"),
  name: z.string().trim().min(1).max(100),
  countryCode: z.string().length(2).refine(isIsoCountryCode),
  region: z.string().trim().max(80).nullable().optional(),
  qualificationPath: z.string().trim().max(160).nullable().optional(),
  status: z.enum(["confirmed", "pending", "withdrawn"]).default("confirmed"),
  ...sourceFields,
});
const stageSchema = z.object({
  action: z.literal("stage"),
  name: z.string().trim().min(1).max(120),
  sortOrder: z.number().int().min(0).max(100).default(0),
  status: z.enum(["upcoming", "live", "completed"]),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  ...sourceFields,
});
const playerSchema = z.object({
  action: z.literal("player"),
  teamSlug: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(100),
  role: z.string().trim().max(80).nullable().optional(),
  ...sourceFields,
});
const standingSchema = z.object({
  action: z.literal("standing"),
  teamSlug: z.string().trim().min(1).max(120),
  stageName: z.string().trim().max(120).optional(),
  rank: z.number().int().positive().nullable().optional(),
  points: z.number().finite().nullable().optional(),
  placementPoints: z.number().finite().nullable().optional(),
  kills: z.number().int().nonnegative().nullable().optional(),
  ...sourceFields,
});
const matchSchema = z.object({
  action: z.literal("match"),
  title: z.string().trim().min(1).max(160),
  stageName: z.string().trim().max(120).optional(),
  teamSlug: z.string().trim().max(120).optional(),
  status: z.enum(["scheduled", "live", "completed", "cancelled"]),
  startsAt: z.string().datetime().nullable().optional(),
  results: z.array(z.object({
    team: z.string().trim().min(1).max(100),
    placement: z.number().int().positive().optional(),
    points: z.number().finite().optional(),
    kills: z.number().int().nonnegative().optional(),
  })).max(100).optional(),
  ...sourceFields,
});
const removeSchema = z.object({
  action: z.literal("removeTeam"),
  participationId: z.string().min(1).max(64),
});
const pinSchema = z.object({
  action: z.literal("pin"),
  entity: z.enum(["event", "team", "participation", "player", "stage", "standing", "match"]),
  id: z.string().min(1).max(64),
  pinned: z.boolean(),
});
const championSchema = z.object({
  action: z.literal("champion"),
  name: z.string().trim().min(1).max(100),
  ...sourceFields,
});
const reviewSchema = z.object({
  action: z.literal("review"),
  draftId: z.string().min(1).max(64),
  decision: z.enum(["approve", "reject"]),
});
const csvSchema = z.object({ action: z.literal("csv"), csv: z.string().min(1).max(100_000) });
const mutationSchema = z.discriminatedUnion("action", [
  eventSchema,
  teamSchema,
  stageSchema,
  playerSchema,
  standingSchema,
  matchSchema,
  removeSchema,
  pinSchema,
  championSchema,
  reviewSchema,
  csvSchema,
]);

async function admin(request: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return { error: "Sign in required.", status: 401 as const };
  const limit = await checkRateLimit(
    `spotlight-write:${session.user.id}:${getRequestAddress(request)}`,
    30,
    60_000,
  );
  if (!limit.allowed)
    return { error: "Too many requests.", status: 429 as const };
  const actor = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  return actor?.role === "ADMIN"
    ? { userId: session.user.id }
    : { error: "Administrator permission required.", status: 403 as const };
}

function teamSlug(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

async function audit(
  transaction: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata?: { count: number },
) {
  await transaction.auditLog.create({
    data: { actorId, action, targetType, targetId, ...(metadata ? { metadata } : {}) },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const actor = await admin(request);
  if ("error" in actor)
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  const { slug } = await params;
  if (!findSpotlightConfig(slug))
    return NextResponse.json({ error: "Unknown spotlight event." }, { status: 404 });
  const event = await getCachedSpotlightSnapshot(slug);
  return NextResponse.json({ event });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const actor = await admin(request);
  if ("error" in actor)
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  const { slug } = await params;
  const config = findSpotlightConfig(slug);
  if (!config)
    return NextResponse.json({ error: "Unknown spotlight event." }, { status: 404 });
  const body = await request.json().catch(() => null);
  const parsed = mutationSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid spotlight input." }, { status: 400 });

  const emitted: { value: "team:added" | "team:updated" | "team:removed" | "counts:updated" |
    "standings:updated" | "match:updated" | "status:changed" } = { value: "counts:updated" };
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const current = await transaction.spotlightEvent.findUnique({ where: { slug } });
      const input = parsed.data;
      if (input.action === "event") {
        const statusChanged = current?.status !== input.status;
        const event = await transaction.spotlightEvent.upsert({
          where: { slug },
          create: {
            slug,
            gameSlug: config.game,
            displayName: input.displayName,
            status: input.status,
            startsAt: input.startsAt ? new Date(input.startsAt) : null,
            endsAt: input.endsAt ? new Date(input.endsAt) : null,
            venue: input.venue ?? null,
            prizePool: input.prizePool ?? null,
            totalSlots: input.totalSlots ?? null,
            officialLinks: input.officialLinks,
            sourceType: "admin",
            sourceName: input.sourceName,
            sourceUrl: input.sourceUrl,
            verifiedBy: actor.userId,
          },
          update: {
            displayName: input.displayName,
            status: input.status,
            startsAt: input.startsAt ? new Date(input.startsAt) : null,
            endsAt: input.endsAt ? new Date(input.endsAt) : null,
            venue: input.venue ?? null,
            prizePool: input.prizePool ?? null,
            totalSlots: input.totalSlots ?? null,
            officialLinks: input.officialLinks,
            sourceType: "admin",
            sourceName: input.sourceName,
            sourceUrl: input.sourceUrl,
            fetchedAt: new Date(),
            verifiedBy: actor.userId,
          },
        });
        await transaction.spotlightSourceRecord.create({
          data: {
            eventSlug: slug,
            entityType: "event",
            entityId: event.id,
            sourceType: "admin",
            sourceName: input.sourceName,
            sourceUrl: input.sourceUrl,
            verifiedBy: actor.userId,
          },
        });
        await audit(transaction, actor.userId, "spotlight.event.save", "spotlight-event", event.id);
        emitted.value = statusChanged ? "status:changed" : "counts:updated";
        return { id: event.id };
      }

      if (!current)
        throw new SpotlightInputError("Create the sourced event record before adding its data.");

      if (input.action === "team") {
        const teamKey = teamSlug(input.name);
        if (!teamKey) throw new SpotlightInputError("Team name must contain a letter or number.");
        const existing = await transaction.spotlightTeam.findUnique({
          where: { slug: teamKey },
        });
        if (
          existing &&
          existing.name.normalize("NFKC").toLocaleLowerCase("en-US") !==
            input.name.normalize("NFKC").toLocaleLowerCase("en-US")
        )
          throw new SpotlightInputError("Team name collides with an existing team slug.");
        const participation = await transaction.spotlightParticipation.findFirst({
          where: { eventId: current.id, team: { slug: teamKey } },
          select: { id: true },
        });
        const team = existing
          ? await transaction.spotlightTeam.update({
              where: { id: existing.id },
              data: {
                name: input.name,
                countryCode: input.countryCode.toUpperCase(),
                region: input.region ?? null,
                sourceType: "admin",
                sourceName: input.sourceName,
                sourceUrl: input.sourceUrl,
                fetchedAt: new Date(),
                verifiedBy: actor.userId,
              },
            })
          : await transaction.spotlightTeam.create({
              data: {
                slug: teamKey,
                name: input.name,
                countryCode: input.countryCode.toUpperCase(),
                region: input.region ?? null,
                sourceType: "admin",
                sourceName: input.sourceName,
                sourceUrl: input.sourceUrl,
                verifiedBy: actor.userId,
              },
            });
        const saved = await transaction.spotlightParticipation.upsert({
          where: { eventId_teamId: { eventId: current.id, teamId: team.id } },
          create: {
            eventId: current.id,
            teamId: team.id,
            countryCode: input.countryCode.toUpperCase(),
            qualificationPath: input.qualificationPath ?? null,
            status: input.status,
            sourceType: "admin",
            sourceName: input.sourceName,
            sourceUrl: input.sourceUrl,
            verifiedBy: actor.userId,
          },
          update: {
            countryCode: input.countryCode.toUpperCase(),
            qualificationPath: input.qualificationPath ?? null,
            status: input.status,
            sourceType: "admin",
            sourceName: input.sourceName,
            sourceUrl: input.sourceUrl,
            fetchedAt: new Date(),
            verifiedBy: actor.userId,
          },
        });
        await transaction.spotlightSourceRecord.create({
          data: {
            eventSlug: slug,
            entityType: "participation",
            entityId: saved.id,
            sourceType: "admin",
            sourceName: input.sourceName,
            sourceUrl: input.sourceUrl,
            verifiedBy: actor.userId,
          },
        });
        await audit(transaction, actor.userId, "spotlight.team.save", "spotlight-participation", saved.id);
        emitted.value = participation ? "team:updated" : "team:added";
        return { id: saved.id };
      }

      if (input.action === "stage") {
        const stage = await transaction.spotlightStage.upsert({
          where: { eventId_name: { eventId: current.id, name: input.name } },
          create: {
            eventId: current.id,
            name: input.name,
            sortOrder: input.sortOrder,
            status: input.status,
            startsAt: input.startsAt ? new Date(input.startsAt) : null,
            endsAt: input.endsAt ? new Date(input.endsAt) : null,
            sourceType: "admin",
            sourceName: input.sourceName,
            sourceUrl: input.sourceUrl,
            verifiedBy: actor.userId,
          },
          update: {
            sortOrder: input.sortOrder,
            status: input.status,
            startsAt: input.startsAt ? new Date(input.startsAt) : null,
            endsAt: input.endsAt ? new Date(input.endsAt) : null,
            sourceType: "admin",
            sourceName: input.sourceName,
            sourceUrl: input.sourceUrl,
            fetchedAt: new Date(),
            verifiedBy: actor.userId,
          },
        });
        await audit(transaction, actor.userId, "spotlight.stage.save", "spotlight-stage", stage.id);
        return { id: stage.id };
      }

      if (input.action === "player") {
        const team = await transaction.spotlightTeam.findFirst({
          where: { slug: input.teamSlug, participations: { some: { eventId: current.id } } },
        });
        if (!team) throw new SpotlightInputError("Team is not listed for this event.");
        const player = await transaction.spotlightPlayer.upsert({
          where: { teamId_name: { teamId: team.id, name: input.name } },
          create: {
            teamId: team.id,
            name: input.name,
            role: input.role ?? null,
            sourceType: "admin",
            sourceName: input.sourceName,
            sourceUrl: input.sourceUrl,
            verifiedBy: actor.userId,
          },
          update: {
            role: input.role ?? null,
            sourceType: "admin",
            sourceName: input.sourceName,
            sourceUrl: input.sourceUrl,
            fetchedAt: new Date(),
            verifiedBy: actor.userId,
          },
        });
        await audit(transaction, actor.userId, "spotlight.player.save", "spotlight-player", player.id);
        return { id: player.id };
      }

      if (input.action === "standing") {
        const participation = await transaction.spotlightParticipation.findFirst({
          where: { eventId: current.id, team: { slug: input.teamSlug } },
        });
        if (!participation) throw new SpotlightInputError("Team is not listed for this event.");
        const stage = input.stageName
          ? await transaction.spotlightStage.findUnique({
              where: { eventId_name: { eventId: current.id, name: input.stageName } },
            })
          : null;
        if (input.stageName && !stage) throw new SpotlightInputError("Stage is not listed for this event.");
        const standing = await transaction.spotlightStanding.create({
          data: {
            eventId: current.id,
            stageId: stage?.id,
            participationId: participation.id,
            rank: input.rank ?? null,
            points: input.points ?? null,
            placementPoints: input.placementPoints ?? null,
            kills: input.kills ?? null,
            sourceType: "admin",
            sourceName: input.sourceName,
            sourceUrl: input.sourceUrl,
            verifiedBy: actor.userId,
          },
        });
        await audit(transaction, actor.userId, "spotlight.standing.create", "spotlight-standing", standing.id);
        emitted.value = "standings:updated";
        return { id: standing.id };
      }

      if (input.action === "match") {
        const stage = input.stageName
          ? await transaction.spotlightStage.findUnique({
              where: { eventId_name: { eventId: current.id, name: input.stageName } },
            })
          : null;
        if (input.stageName && !stage) throw new SpotlightInputError("Stage is not listed for this event.");
        const participation = input.teamSlug
          ? await transaction.spotlightParticipation.findFirst({
              where: { eventId: current.id, team: { slug: input.teamSlug } },
            })
          : null;
        if (input.teamSlug && !participation)
          throw new SpotlightInputError("Team is not listed for this event.");
        const match = await transaction.spotlightMatch.create({
          data: {
            eventId: current.id,
            stageId: stage?.id,
            participationId: participation?.id,
            title: input.title,
            status: input.status,
            startsAt: input.startsAt ? new Date(input.startsAt) : null,
            results: input.results,
            sourceType: "admin",
            sourceName: input.sourceName,
            sourceUrl: input.sourceUrl,
            verifiedBy: actor.userId,
          },
        });
        await audit(transaction, actor.userId, "spotlight.match.create", "spotlight-match", match.id);
        emitted.value = "match:updated";
        return { id: match.id };
      }

      if (input.action === "removeTeam") {
        const removed = await transaction.spotlightParticipation.deleteMany({
          where: { id: input.participationId, eventId: current.id },
        });
        if (!removed.count) throw new SpotlightInputError("Team participation was not found.");
        await audit(transaction, actor.userId, "spotlight.team.remove", "spotlight-participation", input.participationId);
        emitted.value = "team:removed";
        return { id: input.participationId };
      }

      if (input.action === "pin") {
        const update = { pinned: input.pinned };
        const updateForEntity = async () => {
          switch (input.entity) {
            case "event": return transaction.spotlightEvent.updateMany({ where: { id: input.id, slug }, data: { ...update, verifiedBy: actor.userId } });
            case "team": return transaction.spotlightTeam.updateMany({ where: { id: input.id, participations: { some: { eventId: current.id } } }, data: update });
            case "participation": return transaction.spotlightParticipation.updateMany({ where: { id: input.id, eventId: current.id }, data: update });
            case "player": return transaction.spotlightPlayer.updateMany({ where: { id: input.id, team: { participations: { some: { eventId: current.id } } } }, data: update });
            case "stage": return transaction.spotlightStage.updateMany({ where: { id: input.id, eventId: current.id }, data: update });
            case "standing": return transaction.spotlightStanding.updateMany({ where: { id: input.id, eventId: current.id }, data: update });
            case "match": return transaction.spotlightMatch.updateMany({ where: { id: input.id, eventId: current.id }, data: update });
          }
        };
        const updated = await updateForEntity();
        if (!updated.count) throw new SpotlightInputError("Record to pin was not found.");
        await audit(transaction, actor.userId, input.pinned ? "spotlight.record.pin" : "spotlight.record.unpin", `spotlight-${input.entity}`, input.id);
        return { id: input.id };
      }

      if (input.action === "champion") {
        const record = await transaction.spotlightSourceRecord.create({
          data: {
            eventSlug: slug,
            entityType: "champion",
            entityId: input.name,
            sourceType: "admin",
            sourceName: input.sourceName,
            sourceUrl: input.sourceUrl,
            verifiedBy: actor.userId,
          },
        });
        await audit(transaction, actor.userId, "spotlight.champion.create", "spotlight-source-record", record.id);
        return { id: record.id };
      }

      if (input.action === "csv") {
        let teams: SpotlightCsvTeam[];
        try {
          teams = parseSpotlightCsv(input.csv);
        } catch (error) {
          throw new SpotlightInputError(error instanceof Error ? error.message : "CSV validation failed.");
        }
        const ids: string[] = [];
        for (const teamInput of teams) {
          const teamKey = teamSlug(teamInput.team);
          if (!teamKey) throw new SpotlightInputError("A CSV team name must contain a letter or number.");
          const existing = await transaction.spotlightTeam.findUnique({
            where: { slug: teamKey },
            select: { id: true, name: true },
          });
          if (
            existing &&
            existing.name.normalize("NFKC").toLocaleLowerCase("en-US") !==
              teamInput.team.normalize("NFKC").toLocaleLowerCase("en-US")
          )
            throw new SpotlightInputError("CSV team name collides with an existing team slug.");
          const team = await transaction.spotlightTeam.upsert({
            where: { slug: teamKey },
            create: {
              slug: teamKey,
              name: teamInput.team,
              countryCode: teamInput.country,
              sourceType: "admin",
              sourceName: "Admin-managed data",
              sourceUrl: teamInput.source_url,
              verifiedBy: actor.userId,
            },
            update: {
              name: teamInput.team,
              countryCode: teamInput.country,
              sourceType: "admin",
              sourceName: "Admin-managed data",
              sourceUrl: teamInput.source_url,
              fetchedAt: new Date(),
              verifiedBy: actor.userId,
            },
          });
          const participation = await transaction.spotlightParticipation.upsert({
            where: { eventId_teamId: { eventId: current.id, teamId: team.id } },
            create: {
              eventId: current.id,
              teamId: team.id,
              countryCode: teamInput.country,
              qualificationPath: teamInput.path ?? null,
              sourceType: "admin",
              sourceName: "Admin-managed data",
              sourceUrl: teamInput.source_url,
              verifiedBy: actor.userId,
            },
            update: {
              countryCode: teamInput.country,
              qualificationPath: teamInput.path ?? null,
              sourceType: "admin",
              sourceName: "Admin-managed data",
              sourceUrl: teamInput.source_url,
              fetchedAt: new Date(),
              verifiedBy: actor.userId,
            },
          });
          ids.push(participation.id);
        }
        await audit(transaction, actor.userId, "spotlight.csv.import", "spotlight-event", current.id, { count: ids.length });
        emitted.value = "team:added";
        return { imported: ids.length };
      }

      if (input.action === "review") {
        const draft = await transaction.spotlightImportDraft.findFirst({
          where: { id: input.draftId, eventSlug: slug },
        });
        if (!draft || !isSpotlightDraftReviewable(draft.status))
          throw new SpotlightInputError("Pending AI import draft was not found.");
        if (input.decision === "approve") {
          const factsSchema = z.array(z.object({
            team: z.string().trim().min(1).max(100),
            country: z.string().length(2).refine(isIsoCountryCode),
            path: z.string().trim().max(160).optional(),
            source_url: z.string().url().max(2048).refine(isValidSourceUrl),
          })).max(200);
          const parsedFacts = factsSchema.safeParse(draft.facts);
          if (!parsedFacts.success)
            throw new SpotlightInputError("AI draft facts failed review validation.");
          const facts = parsedFacts.data;
          for (const candidate of facts) {
            const key = teamSlug(candidate.team);
            if (!key) continue;
            const existing = await transaction.spotlightTeam.findUnique({
              where: { slug: key },
              select: { id: true, name: true },
            });
            if (
              existing &&
              existing.name.normalize("NFKC").toLocaleLowerCase("en-US") !==
                candidate.team.normalize("NFKC").toLocaleLowerCase("en-US")
            )
              throw new SpotlightInputError("AI team name collides with an existing team slug.");
            const team = await transaction.spotlightTeam.upsert({
              where: { slug: key },
              create: {
                slug: key,
                name: candidate.team,
                countryCode: candidate.country,
                sourceType: "ai_assisted_verified",
                sourceName: draft.sourceName,
                sourceUrl: candidate.source_url,
                verifiedBy: actor.userId,
              },
              update: {
                name: candidate.team,
                countryCode: candidate.country,
                sourceType: "ai_assisted_verified",
                sourceName: draft.sourceName,
                sourceUrl: candidate.source_url,
                fetchedAt: new Date(),
                verifiedBy: actor.userId,
              },
            });
            await transaction.spotlightParticipation.upsert({
              where: { eventId_teamId: { eventId: current.id, teamId: team.id } },
              create: {
                eventId: current.id,
                teamId: team.id,
                countryCode: candidate.country,
                qualificationPath: candidate.path ?? null,
                sourceType: "ai_assisted_verified",
                sourceName: draft.sourceName,
                sourceUrl: candidate.source_url,
                verifiedBy: actor.userId,
              },
              update: {
                countryCode: candidate.country,
                qualificationPath: candidate.path ?? null,
                sourceType: "ai_assisted_verified",
                sourceName: draft.sourceName,
                sourceUrl: candidate.source_url,
                fetchedAt: new Date(),
                verifiedBy: actor.userId,
              },
            });
          }
        }
        await transaction.spotlightImportDraft.update({
          where: { id: draft.id },
          data: {
            status: input.decision === "approve" ? "approved" : "rejected",
            reviewedBy: actor.userId,
            reviewedAt: new Date(),
          },
        });
        await audit(transaction, actor.userId, `spotlight.ai-import.${input.decision}`, "spotlight-import-draft", draft.id);
        emitted.value = "team:added";
        return { id: draft.id, status: input.decision === "approve" ? "approved" : "rejected" };
      }
      throw new SpotlightInputError("Unsupported spotlight operation.");
    });
    const emitsCounts = emitted.value.startsWith("team:") || emitted.value === "status:changed";
    const realtimeEvents = emitsCounts
      ? [emitted.value, "counts:updated" as const]
      : [emitted.value];
    let countsPayload: Record<string, unknown> = {};
    if (emitsCounts) {
      try {
        const snapshot = await getSpotlightSnapshot(slug);
        if (snapshot) countsPayload = { counts: snapshot.counts };
      } catch (error) {
        console.error("Spotlight count refresh after save failed.", {
          reason: error instanceof Error ? error.name : "database-error",
        });
      }
    }
    let realtime = true;
    for (const eventName of realtimeEvents) {
      try {
        if (!(await publishSpotlightChange(slug, eventName, { ...result, ...countsPayload })))
          realtime = false;
      } catch (error) {
        console.error("Spotlight saved but Redis broadcast failed.", {
          reason: error instanceof Error ? error.name : "redis-error",
          event: eventName,
        });
        realtime = false;
      }
    }
    return NextResponse.json({
      ...result,
      realtime,
      ...(!realtime ? { message: "Saved. Cross-process live updates are unavailable until Redis is connected." } : {}),
    });
  } catch (error) {
    if (error instanceof SpotlightInputError)
      return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Spotlight admin update failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json({ error: "Unable to save spotlight data." }, { status: 503 });
  }
}
