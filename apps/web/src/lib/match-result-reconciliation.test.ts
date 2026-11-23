import { describe, expect, it } from "vitest";
import { matchResultsAgree } from "./match-result-reconciliation";

describe("matchResultsAgree", () => {
  it("accepts identical submissions when optional statistics are omitted", () => {
    expect(
      matchResultsAgree(
        { scoreA: 2, scoreB: 1 },
        { scoreA: 2, scoreB: 1, placementA: null, placementB: null },
      ),
    ).toBe(true);
  });

  it("detects score or optional-statistic mismatches", () => {
    expect(
      matchResultsAgree(
        { scoreA: 2, scoreB: 1, killsA: 8 },
        { scoreA: 2, scoreB: 0, killsA: 8 },
      ),
    ).toBe(false);
    expect(
      matchResultsAgree(
        { scoreA: 2, scoreB: 1, placementA: 1 },
        { scoreA: 2, scoreB: 1, placementA: 2 },
      ),
    ).toBe(false);
  });
});
