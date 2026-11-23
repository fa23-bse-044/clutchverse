import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isIsoCountryCode,
  isSpotlightDraftReviewable,
  parseSpotlightCsv,
  shouldReplaceSpotlightRecord,
  summarizeSpotlightCounts,
} from "./spotlight-domain";
import { isWithinProviderBudget } from "./spotlight-provider";

describe("spotlight admin data validation", () => {
  it("parses quoted CSV fixtures without changing team fields", () => {
    const csv = readFileSync(
      new URL("./fixtures/spotlight-teams.csv", import.meta.url),
      "utf8",
    );
    expect(parseSpotlightCsv(csv)).toEqual([
      {
        team: "Fixture, Squad",
        country: "US",
        path: "Fixture only",
        source_url: "https://example.invalid/fixture",
      },
    ]);
  });

  it("rejects unknown country codes, duplicate teams, and missing source URLs", () => {
    expect(isIsoCountryCode("TR")).toBe(true);
    expect(isIsoCountryCode("ZZ")).toBe(false);
    expect(() =>
      parseSpotlightCsv(
        "team,country,path,source_url\nAlpha,US,,https://example.invalid/a\nalpha,US,,https://example.invalid/b",
      ),
    ).toThrow(/duplicates/i);
    expect(() =>
      parseSpotlightCsv("team,country,path,source_url\nAlpha,US,,"),
    ).toThrow(/source URL/i);
  });
});

describe("spotlight source precedence and aggregation", () => {
  it("preserves pinned rows and admin facts over provider updates", () => {
    expect(
      shouldReplaceSpotlightRecord({ sourceType: "admin", pinned: true }, "provider"),
    ).toBe(false);
    expect(
      shouldReplaceSpotlightRecord({ sourceType: "admin", pinned: false }, "provider"),
    ).toBe(false);
    expect(
      shouldReplaceSpotlightRecord({ sourceType: "provider", pinned: false }, "admin"),
    ).toBe(true);
  });

  it("counts only confirmed unique countries and uses supplied event totals", () => {
    expect(
      summarizeSpotlightCounts(
        [
          { countryCode: "TR", status: "confirmed" },
          { countryCode: "TR", status: "confirmed" },
          { countryCode: "US", status: "pending" },
        ],
        12,
        2,
        null,
      ),
    ).toEqual({
      confirmedTeams: 2,
      totalSlots: 12,
      countries: 1,
      stages: 2,
      prizePool: null,
    });
  });

  it("never permits provider requests beyond the conservative Redis budget", () => {
    expect(isWithinProviderBudget(60, 120)).toBe(true);
    expect(isWithinProviderBudget(61, 120)).toBe(false);
    expect(isWithinProviderBudget(1, 0)).toBe(false);
  });

  it("only lets a pending AI draft enter the approval path", () => {
    expect(isSpotlightDraftReviewable("pending")).toBe(true);
    expect(isSpotlightDraftReviewable("approved")).toBe(false);
    expect(isSpotlightDraftReviewable("rejected")).toBe(false);
  });
});
