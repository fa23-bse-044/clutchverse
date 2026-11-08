import argon2 from "argon2";
import { prisma } from "../src/index.js";

const gameSeeds = [
  {
    slug: "pubg-mobile",
    name: "PUBG MOBILE",
    accent: "#d5bb63",
    config: { scoring: "placement+kills" },
  },
  {
    slug: "free-fire",
    name: "FREE FIRE",
    accent: "#ff6b35",
    config: { scoring: "placement+kills" },
  },
  {
    slug: "tekken-8",
    name: "TEKKEN 8",
    accent: "#e74463",
    config: { scoring: "elo" },
  },
  {
    slug: "fifa",
    name: "EA SPORTS FC",
    accent: "#4bdf9b",
    config: { scoring: "elo" },
  },
];

const players = [
  {
    handle: "Vex",
    email: "vex@example.invalid",
    rating: 2840,
    gameSlug: "tekken-8",
  },
  {
    handle: "NOVA_Rex",
    email: "nova-rex@example.invalid",
    rating: 2725,
    gameSlug: "pubg-mobile",
  },
  {
    handle: "MOON",
    email: "moon@example.invalid",
    rating: 2668,
    gameSlug: "free-fire",
  },
  {
    handle: "Kairo",
    email: "kairo@example.invalid",
    rating: 2590,
    gameSlug: "fifa",
  },
  {
    handle: "Sable",
    email: "sable@example.invalid",
    rating: 2512,
    gameSlug: "tekken-8",
  },
  {
    handle: "Astra",
    email: "astra@example.invalid",
    rating: 2460,
    gameSlug: "pubg-mobile",
  },
  {
    handle: "Riot",
    email: "riot@example.invalid",
    rating: 2415,
    gameSlug: "free-fire",
  },
  {
    handle: "Juno",
    email: "juno@example.invalid",
    rating: 2358,
    gameSlug: "fifa",
  },
];

async function seed() {
  const games = new Map<string, string>();
  for (const game of gameSeeds) {
    const saved = await prisma.game.upsert({
      where: { slug: game.slug },
      update: { name: game.name, accent: game.accent, config: game.config },
      create: game,
    });
    games.set(game.slug, saved.id);
  }

  const users = new Map<string, string>();
  for (const player of players) {
    const user = await prisma.user.upsert({
      where: { email: player.email },
      update: {},
      create: {
        email: player.email,
        name: player.handle,
        role: "PLAYER",
        profile: { create: { handle: player.handle } },
      },
    });
    users.set(player.handle, user.id);
    await prisma.ranking.upsert({
      where: {
        gameSlug_subjectId_subjectType_region_period: {
          gameSlug: player.gameSlug,
          subjectId: user.id,
          subjectType: "player",
          region: "Global",
          period: "season",
        },
      },
      update: { rating: player.rating, points: player.rating - 1000 },
      create: {
        gameSlug: player.gameSlug,
        subjectId: user.id,
        subjectType: "player",
        region: "Global",
        period: "season",
        rating: player.rating,
        points: player.rating - 1000,
      },
    });
  }

  const teamSeeds = [
    {
      slug: "nova-esports",
      name: "NOVA ESPORTS",
      gameSlug: "pubg-mobile",
      members: ["NOVA_Rex", "Astra", "Sable"],
    },
    {
      slug: "team-phoenix",
      name: "TEAM PHOENIX",
      gameSlug: "free-fire",
      members: ["MOON", "Riot", "Juno"],
    },
    {
      slug: "ironclad",
      name: "IRONCLAD",
      gameSlug: "tekken-8",
      members: ["Vex", "Sable", "Kairo"],
    },
  ];
  for (const teamSeed of teamSeeds) {
    const team = await prisma.team.upsert({
      where: { slug: teamSeed.slug },
      update: {},
      create: {
        slug: teamSeed.slug,
        name: teamSeed.name,
        gameSlug: teamSeed.gameSlug,
      },
    });
    for (const [index, handle] of teamSeed.members.entries()) {
      const userId = users.get(handle);
      if (!userId) continue;
      await prisma.teamMembership.upsert({
        where: { userId_teamId: { userId, teamId: team.id } },
        update: {},
        create: {
          userId,
          teamId: team.id,
          role: index === 0 ? "captain" : "member",
        },
      });
    }
    await prisma.chatRoom.upsert({
      where: { slug: `team:${team.slug}` },
      update: { teamId: team.id },
      create: { slug: `team:${team.slug}`, type: "team", teamId: team.id },
    });
  }

  const organizer = await prisma.user.upsert({
    where: { email: "events@example.invalid" },
    update: {},
    create: {
      email: "events@example.invalid",
      name: "ClutchVerse Events",
      role: "ORGANIZER",
    },
  });
  const eventSeeds = [
    {
      slug: "drop-zone-invitational",
      title: "The Drop Zone Invitational",
      gameSlug: "pubg-mobile",
      format: "BATTLE_ROYALE" as const,
      state: "LIVE" as const,
      startsAt: new Date("2026-11-06T15:00:00Z"),
      prizePool: 2500000,
      entryFee: 0,
      mode: "squad",
    },
    {
      slug: "flame-open",
      title: "Flame Open: Clash Series",
      gameSlug: "free-fire",
      format: "BATTLE_ROYALE" as const,
      state: "UPCOMING" as const,
      startsAt: new Date("2026-11-09T13:00:00Z"),
      prizePool: 1250000,
      entryFee: 0,
      mode: "squad",
    },
    {
      slug: "iron-fist-cup",
      title: "Iron Fist Cup // Season 04",
      gameSlug: "tekken-8",
      format: "DOUBLE_ELIMINATION" as const,
      state: "UPCOMING" as const,
      startsAt: new Date("2026-11-12T15:00:00Z"),
      prizePool: 800000,
      entryFee: 0,
      mode: "solo",
    },
    {
      slug: "club-championship",
      title: "ClutchVerse Club Championship",
      gameSlug: "fifa",
      format: "SWISS" as const,
      state: "COMPLETED" as const,
      startsAt: new Date("2026-11-02T15:00:00Z"),
      prizePool: 1500000,
      entryFee: 0,
      mode: "solo",
    },
  ];
  for (const event of eventSeeds) {
    const gameId = games.get(event.gameSlug);
    if (!gameId) throw new Error(`Missing seeded game ${event.gameSlug}`);
    const saved = await prisma.tournament.upsert({
      where: { slug: event.slug },
      update: {
        settings: {
          maxEntries: 128,
          checkInMinutes: 30,
          timezone: "UTC",
          mode: event.mode,
        },
      },
      create: {
        slug: event.slug,
        title: event.title,
        format: event.format,
        state: event.state,
        startsAt: event.startsAt,
        prizePool: event.prizePool,
        entryFee: event.entryFee,
        gameId,
        organizerId: organizer.id,
        region: "Global",
        settings: {
          maxEntries: 128,
          checkInMinutes: 30,
          timezone: "UTC",
          mode: event.mode,
        },
      },
    });
    if (event.state !== "COMPLETED") {
      const entries =
        event.slug === "drop-zone-invitational"
          ? ["NOVA_Rex", "Astra", "Sable", "Vex"]
          : ["Kairo", "MOON"];
      for (const handle of entries) {
        const userId = users.get(handle);
        if (userId) {
          await prisma.registration.upsert({
            where: { tournamentId_userId: { tournamentId: saved.id, userId } },
            update: {},
            create: { tournamentId: saved.id, userId, status: "confirmed" },
          });
        }
      }
    }
  }

  const room = await prisma.chatRoom.upsert({
    where: { slug: "global" },
    update: {},
    create: { slug: "global", type: "global" },
  });
  for (const game of gameSeeds) {
    await prisma.chatRoom.upsert({
      where: { slug: `game:${game.slug}` },
      update: { type: "game", gameSlug: game.slug },
      create: { slug: `game:${game.slug}`, type: "game", gameSlug: game.slug },
    });
  }

  const recordSeeds = [
    {
      gameSlug: "pubg-mobile",
      title: "Most eliminations in a community-verified match",
      holder: "NOVA_Rex",
      value: "18 eliminations",
      achievedAt: new Date("2026-10-18T16:00:00Z"),
    },
    {
      gameSlug: "free-fire",
      title: "Longest community-verified win streak",
      holder: "MOON",
      value: "11 matches",
      achievedAt: new Date("2026-10-20T16:00:00Z"),
    },
    {
      gameSlug: "tekken-8",
      title: "Fastest community-verified set win",
      holder: "Vex",
      value: "3 rounds · 2m 14s",
      achievedAt: new Date("2026-10-22T16:00:00Z"),
    },
    {
      gameSlug: "fifa",
      title: "Highest community-verified goal difference",
      holder: "Kairo",
      value: "+8 goals",
      achievedAt: new Date("2026-10-24T16:00:00Z"),
    },
  ];
  for (const record of recordSeeds) {
    await prisma.gameRecord.upsert({
      where: {
        gameSlug_title_holder: {
          gameSlug: record.gameSlug,
          title: record.title,
          holder: record.holder,
        },
      },
      update: {
        value: record.value,
        achievedAt: record.achievedAt,
        verificationLabel: "community-verified",
      },
      create: {
        ...record,
        verificationLabel: "community-verified",
      },
    });
  }

  const firstUserId = users.get("NOVA_Rex");
  if (
    firstUserId &&
    !(await prisma.chatMessage.findFirst({ where: { roomId: room.id } }))
  ) {
    await prisma.chatMessage.create({
      data: {
        roomId: room.id,
        authorId: firstUserId,
        body: "Welcome to the global lounge — keep it competitive and kind.",
      },
    });
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    if (adminPassword.length < 16)
      throw new Error("SEED_ADMIN_PASSWORD must be at least 16 characters.");
    const passwordHash = await argon2.hash(adminPassword, {
      type: argon2.argon2id,
    });
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { role: "ADMIN", passwordHash },
      create: {
        email: adminEmail,
        name: "ClutchVerse Admin",
        role: "ADMIN",
        passwordHash,
      },
    });
  }
}

seed()
  .then(() => console.log("ClutchVerse seed data ready."))
  .catch((error: unknown) => {
    console.error("Database seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
