import { describe, expect, it } from "vitest";
import { rankCandidates } from "./search-matcher";

describe("rankCandidates", () => {
  it("ranks exact and typo-tolerant matches above unrelated records", () => {
    const results = rankCandidates(
      "tekkn",
      ["Tekken 8", "Free Fire", "Tekken tournament"],
      (value) => value,
    );
    expect(results.map(({ item }) => item)).toEqual([
      "Tekken 8",
      "Tekken tournament",
    ]);
  });

  it("matches all query words and ignores punctuation and case", () => {
    const results = rankCandidates(
      "PUBG mobile",
      ["PUBG MOBILE", "PUBG", "Mobile-only event"],
      (value) => value,
    );
    expect(results[0]?.item).toBe("PUBG MOBILE");
  });
});
