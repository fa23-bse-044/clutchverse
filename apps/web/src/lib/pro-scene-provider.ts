import { prisma } from "@clutchverse/db";
import type { GameSlug } from "@clutchverse/core";

export type ProSceneSource = {
  sourceName: string;
  sourceUrl: string;
  fetchedAt: Date;
  license: string;
};

export type ProEvent = ProSceneSource & {
  id: string;
  gameSlug: string;
  name: string;
  startsAt: Date | null;
  endsAt: Date | null;
  status: string;
  prizePool: string | null;
  region: string | null;
  stage: string | null;
  format: string | null;
};

export type ProSceneProvider = {
  events(gameSlug?: GameSlug): Promise<ProEvent[]>;
  eventDetail(eventId: string): Promise<ProEvent | null>;
  standings(eventId: string): Promise<unknown[]>;
  teams(gameSlug: GameSlug): Promise<unknown[]>;
  teamHistory(teamId: string): Promise<unknown[]>;
  players(gameSlug: GameSlug): Promise<unknown[]>;
};

export const databaseProSceneProvider: ProSceneProvider = {
  async events(gameSlug) {
    return prisma.proSceneEvent.findMany({
      where: gameSlug ? { gameSlug } : undefined,
      orderBy: [{ startsAt: "desc" }, { name: "asc" }],
    });
  },
  async eventDetail(eventId) {
    return prisma.proSceneEvent.findUnique({
      where: { id: eventId },
      include: {
        teams: { include: { team: true } },
        standings: {
          include: { team: true, player: true },
          orderBy: { rank: "asc" },
        },
        results: {
          include: { team: true, player: true },
          orderBy: [{ resultDate: "desc" }, { placement: "asc" }],
        },
      },
    });
  },
  async standings(eventId) {
    return prisma.proSceneStanding.findMany({
      where: { eventId },
      include: { team: true, player: true },
      orderBy: { rank: "asc" },
    });
  },
  async teams(gameSlug) {
    return prisma.proSceneTeam.findMany({
      where: { gameSlug },
      include: { players: true },
      orderBy: { name: "asc" },
    });
  },
  async teamHistory(teamId) {
    return prisma.proSceneResult.findMany({
      where: { teamId },
      include: { event: true },
      orderBy: { resultDate: "desc" },
    });
  },
  async players(gameSlug) {
    return prisma.proScenePlayer.findMany({
      where: { gameSlug },
      include: { team: true },
      orderBy: { name: "asc" },
    });
  },
};

export function isGameSlug(value: string): value is GameSlug {
  return ["pubg-mobile", "free-fire", "tekken-8", "fifa"].includes(value);
}
