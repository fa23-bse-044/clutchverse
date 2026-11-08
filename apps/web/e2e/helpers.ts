import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import argon2 from "argon2";
import { expect, type Page } from "@playwright/test";
import { prisma } from "@clutchverse/db";

const require = createRequire(resolve(process.cwd(), "package.json"));
const socketClientEntry = require.resolve("socket.io-client");
export const socketClientBundlePath = resolve(
  dirname(socketClientEntry),
  "../../dist/socket.io.js",
);

export type TestPlayer = {
  id: string;
  email: string;
  handle: string;
  password: string;
};

export type TournamentFixture = {
  id: string;
  slug: string;
  title: string;
  registrations: { id: string; userId: string }[];
};

export function newScope() {
  return `cv-e2e-${randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

export async function createPlayer(
  scope: string,
  suffix: string,
  role: "PLAYER" | "ORGANIZER" = "PLAYER",
): Promise<TestPlayer> {
  const identifier = randomUUID().replaceAll("-", "").slice(0, 8);
  const handle = `E${identifier}${suffix.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 8)}`;
  const email = `${scope}-${suffix}-${identifier}@example.test`;
  const password = `CvE2E-${randomUUID()}-Pass!`;
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
  const user = await prisma.user.create({
    data: {
      email,
      name: handle,
      role,
      passwordHash,
      profile: { create: { handle } },
    },
    select: { id: true },
  });
  return { id: user.id, email, handle, password };
}

export async function registerPlayer(page: Page, scope: string) {
  const identifier = randomUUID().replaceAll("-", "").slice(0, 8);
  const player = {
    email: `${scope}-registered-${identifier}@example.test`,
    handle: `E${identifier}Reg`,
    password: `CvE2E-${randomUUID()}-Pass!`,
  };
  await page.goto("/register");
  await page.getByLabel("PLAYER HANDLE").fill(player.handle);
  await page.getByLabel("EMAIL ADDRESS").fill(player.email);
  await page.getByLabel("PASSWORD", { exact: true }).fill(player.password);
  await page.getByRole("button", { name: /create player account/i }).click();
  await expect(page).toHaveURL(/\/$/);
  const session = await page.request.get("/api/auth/session");
  expect(session.ok()).toBeTruthy();
  const data = (await session.json()) as { user?: { email?: string } };
  expect(data.user?.email).toBe(player.email);
  const saved = await prisma.user.findUnique({
    where: { email: player.email },
    select: { id: true },
  });
  expect(saved).not.toBeNull();
  return { ...player, id: saved!.id };
}

export async function login(page: Page, player: TestPlayer) {
  await page.goto("/login");
  await page.getByLabel("EMAIL ADDRESS").fill(player.email);
  await page.getByLabel("PASSWORD", { exact: true }).fill(player.password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-undefined",
    /.+/,
  );
  const session = await page.request.get("/api/auth/session");
  expect(session.ok()).toBeTruthy();
  const data = (await session.json()) as { user?: { email?: string } };
  expect(data.user?.email).toBe(player.email);
}

export async function createTournament(
  scope: string,
  organizerId: string,
  options: {
    title: string;
    state: "UPCOMING" | "LIVE";
    startsAt: Date;
    gameSlug?: "pubg-mobile" | "free-fire";
  },
): Promise<TournamentFixture> {
  const gameSlug = options.gameSlug ?? "pubg-mobile";
  const game = await prisma.game.findUnique({ where: { slug: gameSlug } });
  if (!game) throw new Error(`Seeded game ${gameSlug} was not found.`);
  const tournament = await prisma.tournament.create({
    data: {
      slug: `${scope}-${randomUUID().slice(0, 8)}`,
      title: options.title,
      gameId: game.id,
      organizerId,
      format: options.state === "LIVE" ? "BATTLE_ROYALE" : "SINGLE_ELIMINATION",
      state: options.state,
      startsAt: options.startsAt,
      region: "Global",
      prizePool: 10_000,
      entryFee: 0,
      settings: { maxEntries: 128, checkInMinutes: 30, timezone: "UTC" },
    },
    select: { id: true, slug: true, title: true },
  });
  return { ...tournament, registrations: [] };
}

export async function createRegistration(tournamentId: string, userId: string) {
  return prisma.registration.create({
    data: { tournamentId, userId, status: "registered" },
    select: { id: true, userId: true },
  });
}

export async function cleanupScope(scope: string) {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: `${scope}-` } },
    select: { id: true },
  });
  const userIds = users.map(({ id }) => id);
  const teams = await prisma.team.findMany({
    where: { slug: { startsWith: `${scope}-` } },
    select: { id: true },
  });
  const teamIds = teams.map(({ id }) => id);
  const tournaments = await prisma.tournament.findMany({
    where: { slug: { startsWith: `${scope}-` } },
    select: { id: true },
  });
  const tournamentIds = tournaments.map(({ id }) => id);

  if (userIds.length) {
    await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    await prisma.notification.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.teamInvite.deleteMany({
      where: {
        OR: [{ inviterId: { in: userIds } }, { inviteeId: { in: userIds } }],
      },
    });
  }
  if (teamIds.length) {
    await prisma.teamInvite.deleteMany({ where: { teamId: { in: teamIds } } });
    await prisma.teamMembership.deleteMany({
      where: { teamId: { in: teamIds } },
    });
  }
  if (tournamentIds.length) {
    await prisma.auditLog.deleteMany({
      where: { targetId: { in: tournamentIds } },
    });
    await prisma.tournament.deleteMany({
      where: { id: { in: tournamentIds } },
    });
  }
  if (teamIds.length)
    await prisma.team.deleteMany({ where: { id: { in: teamIds } } });
  if (userIds.length) {
    await prisma.ranking.deleteMany({
      where: { subjectId: { in: [...userIds, ...teamIds] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
}
