import { readFile } from "node:fs/promises";
import { createClient } from "redis";
import { expect, test, type Page } from "@playwright/test";
import { prisma } from "@clutchverse/db";
import {
  cleanupScope,
  createPlayer,
  createRegistration,
  createTournament,
  login,
  newScope,
  socketClientBundlePath,
} from "./helpers";

type SocketAck = { ok?: boolean; channel?: string; error?: string };
type BrowserSocket = {
  on(event: string, listener: (payload?: unknown) => void): BrowserSocket;
  emit(
    event: string,
    payload: unknown,
    ack: (result: SocketAck) => void,
  ): BrowserSocket;
  disconnect(): void;
};
type RankingBrowserWindow = Window & {
  io?: (
    url: string,
    options: { auth: { token: string }; transports: string[] },
  ) => BrowserSocket;
  __clutchVerseRankingEvents?: unknown[];
};

async function subscribeToRankings(page: Page, gameSlug: string) {
  const tokenResponse = await page.request.get("/api/realtime-token");
  expect(tokenResponse.status()).toBe(200);
  const { token } = (await tokenResponse.json()) as { token: string };
  await page.addScriptTag({
    content: await readFile(socketClientBundlePath, "utf8"),
  });
  const subscribed = await page.evaluate(
    ({ token, gameSlug, realtimeURL }) =>
      new Promise<string>((resolve, reject) => {
        const browserWindow = window as RankingBrowserWindow;
        if (!browserWindow.io) {
          reject(new Error("Socket.IO browser client did not initialize."));
          return;
        }
        browserWindow.__clutchVerseRankingEvents = [];
        const socket = browserWindow.io(realtimeURL, {
          auth: { token },
          transports: ["websocket"],
        });
        socket.on("ranking:update", (event) => {
          browserWindow.__clutchVerseRankingEvents?.push(event);
        });
        socket.on("connect_error", (error) => {
          reject(new Error(String(error ?? "Socket connection failed.")));
        });
        socket.on("connect", () => {
          socket.emit(
            "ranking:subscribe",
            { gameSlug, period: "season", region: "Global" },
            (ack) => {
              if (!ack.ok)
                reject(new Error(ack.error ?? "Ranking subscription failed."));
              else resolve(ack.channel ?? "");
            },
          );
        });
      }),
    {
      token,
      gameSlug,
      realtimeURL:
        process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://127.0.0.1:4001",
    },
  );
  expect(subscribed).toBe(`ranking:${gameSlug}:season:Global`);
}

test.describe("live tournament rankings", () => {
  let scope: string;

  test.beforeEach(() => {
    scope = newScope();
  });

  test.afterEach(async () => cleanupScope(scope));

  test("persists round scores to PostgreSQL and Redis and pushes updates to another browser", async ({
    page,
    browser,
    request,
  }) => {
    const organizer = await createPlayer(scope, "organizer", "ORGANIZER");
    const first = await createPlayer(scope, "entrantone");
    const second = await createPlayer(scope, "entranttwo");
    const tournament = await createTournament(scope, organizer.id, {
      title: `${scope} Live Royale`,
      state: "LIVE",
      startsAt: new Date(Date.now() - 60_000),
    });
    const firstRegistration = await createRegistration(tournament.id, first.id);
    const secondRegistration = await createRegistration(
      tournament.id,
      second.id,
    );
    const payload = {
      tournamentId: tournament.id,
      round: 1,
      entries: [
        { registrationId: firstRegistration.id, placement: 1, eliminations: 4 },
        {
          registrationId: secondRegistration.id,
          placement: 2,
          eliminations: 1,
        },
      ],
    };

    const unauthorized = await request.post("/api/rankings/scores", {
      data: payload,
    });
    expect(unauthorized.status()).toBe(401);

    await login(page, organizer);
    const receiverContext = await browser.newContext();
    const redis = createClient({ url: process.env.REDIS_URL });
    try {
      const receiverPage = await receiverContext.newPage();
      await login(receiverPage, second);
      await receiverPage.goto("/");
      await subscribeToRankings(receiverPage, "pubg-mobile");

      await redis.connect();
      const response = await page.request.post("/api/rankings/scores", {
        data: payload,
      });
      expect(response.status()).toBe(200);
      const result = (await response.json()) as {
        cacheSynced: boolean;
        results: { subjectId: string; points: number }[];
      };
      expect(result.cacheSynced).toBe(true);
      expect(result.results.map(({ points }) => points)).toEqual([14, 7]);

      await receiverPage.waitForFunction(
        () =>
          (window as RankingBrowserWindow).__clutchVerseRankingEvents?.length,
        undefined,
      );
      const events = await receiverPage.evaluate(
        () => (window as RankingBrowserWindow).__clutchVerseRankingEvents ?? [],
      );
      expect(JSON.stringify(events)).toContain(first.id);
      expect(JSON.stringify(events)).toContain(second.id);

      const rankings = await page.request.get(
        "/api/rankings/pubg-mobile?period=season&region=Global&type=player",
      );
      expect(rankings.status()).toBe(200);
      const leaderboard = (await rankings.json()) as {
        entries: { subjectId: string; points: number }[];
      };
      expect(leaderboard.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ subjectId: first.id, points: 14 }),
          expect.objectContaining({ subjectId: second.id, points: 7 }),
        ]),
      );

      const persistedScores = await prisma.tournamentScore.findMany({
        where: { tournamentId: tournament.id },
        orderBy: { placement: "asc" },
      });
      expect(persistedScores.map(({ points }) => points)).toEqual([14, 7]);
      const redisPoints = await redis.zScore(
        "rank:pubg-mobile:season:Global:player",
        first.id,
      );
      expect(redisPoints).toBe(14);
    } finally {
      if (redis.isOpen) {
        await redis.zRem("rank:pubg-mobile:season:Global:player", [
          first.id,
          second.id,
        ]);
        await redis.quit();
      }
      await receiverContext.close();
    }
  });
});
