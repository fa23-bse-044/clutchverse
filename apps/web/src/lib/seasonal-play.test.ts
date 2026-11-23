import { describe, expect, it } from "vitest";
import {
  getSeasonLevel,
  getSeasonRewards,
  getSeasonWindow,
  getUtcDayKey,
  getUtcWeekKey,
  scoreMatchPick,
  scoreProScenePick,
} from "./seasonal-play";

describe("seasonal play rules", () => {
  it("uses UTC quarterly seasons and ISO week periods", () => {
    expect(getSeasonWindow(new Date("2026-11-11T09:00:00Z"))).toMatchObject({
      key: "2026-Q4",
      startsAt: new Date("2026-10-01T00:00:00Z"),
      endsAt: new Date("2027-01-01T00:00:00Z"),
    });
    expect(getUtcDayKey(new Date("2026-11-11T23:59:59Z"))).toBe("2026-11-11");
    expect(getUtcWeekKey(new Date("2026-11-11T09:00:00Z"))).toBe("2026-W46");
  });

  it("calculates level track and returns only earned cosmetic rewards", () => {
    expect(getSeasonLevel(0)).toBe(1);
    expect(getSeasonLevel(199)).toBe(2);
    expect(getSeasonRewards(3).filter((reward) => reward.unlocked).map((reward) => reward.kind))
      .toEqual(["badge", "frame", "title"]);
  });

  it("scores only confirmed tournament and licensed-event results", () => {
    expect(scoreMatchPick("scheduled", "registration-a", "registration-a")).toBeNull();
    expect(scoreMatchPick("completed", "registration-a", "registration-a")).toBe(5);
    expect(scoreMatchPick("completed", "registration-a", "registration-b")).toBe(0);
    expect(scoreProScenePick("upcoming", 1, "team-a", "team-a", null)).toBeNull();
    expect(scoreProScenePick("completed", 2, "team-a", "team-a", null)).toBe(5);
  });
});
