import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma, prisma } from "@clutchverse/db";
import { auth } from "@/auth";
import { getRedisClient } from "@/lib/redis";
import {
  normalizeTeamName,
  getRegistrationStatus,
  validateTournamentRegistration,
} from "@/lib/tournament-registration";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const [tournament, session] = await Promise.all([
      prisma.tournament.findUnique({
        where: { id },
        select: { settings: true },
      }),
      auth(),
    ]);
    if (!tournament) {
      return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
    }
    const config = zodTournamentSettings.safeParse(tournament.settings);
    if (!config.success) {
      return NextResponse.json(
        { error: "Tournament capacity settings are invalid." },
        { status: 503 },
      );
    }
    const [registered, waitlist, registration, entries] = await Promise.all([
      prisma.registration.count({
        where: { tournamentId: id, status: { not: "waitlisted" } },
      }),
      prisma.registration.count({
        where: { tournamentId: id, status: "waitlisted" },
      }),
      session?.user?.id
        ? prisma.registration.findFirst({
            where: { tournamentId: id, userId: session.user.id },
            select: { id: true, status: true, mode: true, teamName: true },
          })
        : Promise.resolve(null),
      prisma.registration.findMany({
        where: { tournamentId: id, status: { not: "waitlisted" } },
        orderBy: { id: "asc" },
        select: { id: true, teamName: true, region: true, mode: true, status: true },
      }),
    ]);
    return NextResponse.json({
      slots: { registered, total: config.data.maxEntries ?? 128, waitlist },
      registration,
      participants: entries.map(({ id: entryId, teamName, region, mode, status }) => ({
        id: entryId,
        teamName: teamName ?? "Solo entry",
        region: region ?? "Region not set",
        mode,
        status,
      })),
    });
  } catch (error) {
    console.error("Tournament registration status lookup failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json(
      { error: "Unable to load current registration status." },
      { status: 503 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const input = await request.json().catch(() => null);

  try {
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: { game: true },
    });
    if (
      !tournament ||
      tournament.state !== "UPCOMING" ||
      tournament.startsAt <= new Date()
    ) {
      return NextResponse.json(
        { error: "This event is not accepting registrations." },
        { status: 409 },
      );
    }

    const settings = zodTournamentSettings.safeParse(tournament.settings);
    if (!settings.success) {
      return NextResponse.json(
        { error: "Tournament registration settings are invalid." },
        { status: 503 },
      );
    }
    const config = settings.data;
    const parsed = validateTournamentRegistration(
      input,
      tournament.game.slug as Parameters<typeof validateTournamentRegistration>[1],
      config.allowedModes,
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "message" in parsed.error ? parsed.error.message : "Invalid registration." },
        { status: 400 },
      );
    }
    if (
      tournament.region.toLowerCase() !== "global" &&
      parsed.data.region.toLowerCase() !== tournament.region.toLowerCase()
    ) {
      return NextResponse.json(
        { error: "Your region does not match this tournament's eligibility." },
        { status: 422 },
      );
    }
    if (tournament.entryFee > 0) {
      const payment = await prisma.payment.findFirst({
        where: {
          userId: session.user.id,
          kind: "tournament_entry",
          targetId: id,
          amount: tournament.entryFee,
          status: "paid",
        },
        select: { id: true },
      });
      if (!payment) {
        return NextResponse.json(
          { error: "Complete the entry-fee payment before registering." },
          { status: 402 },
        );
      }
    }

    const maxEntries = config.maxEntries ?? 128;
    const normalizedTeamName = parsed.data.teamName
      ? normalizeTeamName(parsed.data.teamName)
      : null;
    const saved = await prisma.$transaction(
      async (transaction) => {
        await transaction.$queryRaw`SELECT "id" FROM "Tournament" WHERE "id" = ${id} FOR UPDATE`;
        const existingByKey = await transaction.registration.findUnique({
          where: { idempotencyKey: parsed.data.idempotencyKey },
        });
        if (existingByKey) {
          if (
            existingByKey.userId !== session.user.id ||
            existingByKey.tournamentId !== id
          ) {
            throw new Error("IDEMPOTENCY_KEY_CONFLICT");
          }
          const registered = await transaction.registration.count({
            where: { tournamentId: id, status: { not: "waitlisted" } },
          });
          const waitlisted = await transaction.registration.count({
            where: { tournamentId: id, status: "waitlisted" },
          });
          return {
            registration: existingByKey,
            registered,
            waitlisted,
            maxEntries,
            repeated: true,
          };
        }

        const existingUserEntry = await transaction.registration.findFirst({
          where: { tournamentId: id, userId: session.user.id },
          select: { id: true },
        });
        if (existingUserEntry) throw new Error("PLAYER_ALREADY_REGISTERED");

        const existingEntries = await transaction.registration.findMany({
          where: { tournamentId: id },
          select: { inGamePlayers: true },
        });
        const usedIds = new Set(
          existingEntries.flatMap(({ inGamePlayers }) =>
            Array.isArray(inGamePlayers)
              ? inGamePlayers.flatMap((member) =>
                  typeof member === "object" &&
                  member !== null &&
                  "inGameId" in member &&
                  typeof member.inGameId === "string"
                    ? [member.inGameId.toLowerCase()]
                    : [],
                )
              : [],
          ),
        );
        if (
          parsed.data.members.some((member) =>
            usedIds.has(member.inGameId.toLowerCase()),
          )
        ) {
          throw new Error("DUPLICATE_INGAME_ID");
        }
        const registeredBefore = existingEntries.length -
          (await transaction.registration.count({
            where: { tournamentId: id, status: "waitlisted" },
          }));
        const status = getRegistrationStatus(registeredBefore, maxEntries);
        const registration = await transaction.registration.create({
          data: {
            tournamentId: id,
            userId: session.user.id,
            status,
            mode: parsed.data.mode,
            teamName: parsed.data.teamName,
            normalizedTeamName,
            region: parsed.data.region,
            inGamePlayers: parsed.data.members,
            idempotencyKey: parsed.data.idempotencyKey,
          },
        });
        await transaction.auditLog.create({
          data: {
            actorId: session.user.id,
            action: "tournament.register.player",
            targetType: "registration",
            targetId: registration.id,
            metadata: {
              mode: parsed.data.mode,
              status,
              region: parsed.data.region,
            },
          },
        });
        const registered = await transaction.registration.count({
          where: { tournamentId: id, status: { not: "waitlisted" } },
        });
        const waitlisted = await transaction.registration.count({
          where: { tournamentId: id, status: "waitlisted" },
        });
        return {
          registration,
          registered,
          waitlisted,
          maxEntries,
          repeated: false,
        };
      },
      { maxWait: 10_000, timeout: 20_000 },
    );

    if (!saved.repeated) {
      try {
        const redis = await getRedisClient();
        await redis?.publish(
          "tournament-registration-events",
          JSON.stringify({
            type: "registration:created",
            tournamentId: id,
            registration: {
              id: saved.registration.id,
              teamName: saved.registration.teamName ?? "Solo entry",
              region: saved.registration.region,
              mode: saved.registration.mode,
              status: saved.registration.status,
            },
            slots: {
              registered: saved.registered,
              total: saved.maxEntries,
              waitlist: saved.waitlisted,
            },
            updatedAt: new Date().toISOString(),
          }),
        );
      } catch (error) {
        console.error("Tournament registration saved but realtime publish failed.", {
          reason: error instanceof Error ? error.name : "publish-error",
        });
      }
    }

    return NextResponse.json(
      {
        registration: {
          id: saved.registration.id,
          status: saved.registration.status,
          mode: saved.registration.mode,
          teamName: saved.registration.teamName,
        },
        confirmation:
          saved.registration.status === "waitlisted" ? "waitlisted" : "confirmed",
        slots: {
          registered: saved.registered,
          total: saved.maxEntries,
          waitlist: saved.waitlisted,
        },
      },
      { status: saved.repeated ? 200 : 201 },
    );
  } catch (error) {
    if (error instanceof Error) {
      const messages: Record<string, string> = {
        PLAYER_ALREADY_REGISTERED: "You already have an entry in this tournament.",
        DUPLICATE_INGAME_ID: "An in-game ID in this roster is already registered.",
        IDEMPOTENCY_KEY_CONFLICT: "This request key has already been used.",
      };
      if (messages[error.message]) {
        return NextResponse.json({ error: messages[error.message] }, { status: 409 });
      }
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "This team name or player entry is already registered." },
        { status: 409 },
      );
    }
    console.error("Tournament registration failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json(
      { error: "Unable to register for this tournament." },
      { status: 503 },
    );
  }
}

const zodTournamentSettings = z.object({
  maxEntries: z.number().int().positive().max(100_000).optional(),
  allowedModes: z.array(z.enum(["solo", "duo", "squad"])).optional(),
});
