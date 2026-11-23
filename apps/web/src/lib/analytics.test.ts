import { describe, expect, it } from "vitest";
import { summarizeAnalytics, type AnalyticsRecord } from "./analytics";

const record = (
  id: string,
  outcome: AnalyticsRecord["outcome"],
  extra: Partial<AnalyticsRecord> = {},
): AnalyticsRecord => ({
  id,
  gameSlug: "tekken-8",
  gameName: "Tekken 8",
  playedAt: "2026-01-01T00:00:00.000Z",
  title: "Test event",
  source: "manual",
  outcome,
  opponent: "Rival",
  teamName: "Team A",
  placement: null,
  kills: null,
  deaths: null,
  scoreFor: null,
  scoreAgainst: null,
  ...extra,
});

describe("analytics summary", () => {
  it("calculates outcomes, K/D, placements, head-to-head, and teams", () => {
    const summary = summarizeAnalytics([
      record("1", "win", { kills: 12, deaths: 4, placement: 1 }),
      record("2", "loss", { kills: 3, deaths: 6, placement: 2 }),
      record("3", "unknown", { opponent: null, teamName: null }),
    ]);

    expect(summary).toMatchObject({
      results: 3,
      decided: 2,
      wins: 1,
      losses: 1,
      winRate: 50,
      kills: 15,
      deaths: 10,
      killDeathRatio: 1.5,
    });
    expect(summary.placementDistribution).toEqual([
      { placement: 1, count: 1 },
      { placement: 2, count: 1 },
    ]);
    expect(summary.headToHead).toEqual([
      { opponent: "Rival", played: 2, wins: 1 },
    ]);
    expect(summary.teamPerformance).toEqual([
      { team: "Team A", played: 2, wins: 1 },
    ]);
  });
});
