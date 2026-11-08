import { describe, expect, it } from "vitest";
import { games } from "@clutchverse/core";
import { gameRules } from "./game-rules";

describe("game-specific community rules", () => {
  it("defines tournament eligibility and FAQs for every supported game", () => {
    for (const game of games) {
      const rules = gameRules[game.slug];
      expect(rules.eligibility.length).toBeGreaterThan(20);
      expect(rules.deviceRules.length).toBeGreaterThan(20);
      expect(rules.fairPlay.length).toBeGreaterThan(20);
      expect(rules.antiCheat.length).toBeGreaterThan(20);
      expect(rules.scoring.length).toBeGreaterThan(20);
      expect(rules.disputes.length).toBeGreaterThan(20);
      expect(rules.prizes.length).toBeGreaterThan(20);
      expect(rules.faqs.length).toBeGreaterThanOrEqual(3);
      expect(rules.modes.length).toBeGreaterThan(0);
    }
  });

  it("uses the requested competitive modes and squad sizes", () => {
    expect(gameRules["pubg-mobile"].squadSize).toBe(4);
    expect(gameRules["free-fire"].squadSize).toBe(4);
    expect(gameRules["tekken-8"].modes).toEqual(["Solo"]);
    expect(gameRules.fifa.modes).toEqual(["Solo"]);
  });
});
