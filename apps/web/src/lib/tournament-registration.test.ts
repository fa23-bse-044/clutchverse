import { describe, expect, it } from "vitest";
import {
  getRegistrationStatus,
  normalizeTeamName,
  validateTournamentRegistration,
} from "./tournament-registration";

const valid = {
  mode: "squad",
  teamName: "Clutch Crew",
  teamTag: "CC",
  platform: "Android",
  region: "South Asia",
  members: [
    { inGameName: "Alpha", inGameId: "10101" },
    { inGameName: "Bravo", inGameId: "20202" },
    { inGameName: "Charlie", inGameId: "30303" },
    { inGameName: "Delta", inGameId: "40404" },
  ],
  substitutes: [],
  eligibilityConfirmed: true,
  rulesAccepted: true,
  idempotencyKey: "0d9b40a4-bfd9-4bf1-9bef-e3502a1ed8a9",
};

describe("tournament registration validation", () => {
  it("accepts a complete PUBG squad and valid solo Tekken registration", () => {
    expect(validateTournamentRegistration(valid, "pubg-mobile").success).toBe(true);
    expect(
      validateTournamentRegistration(
        { ...valid, mode: "solo", teamName: undefined, teamTag: undefined, platform: "PC", members: valid.members.slice(0, 1) },
        "tekken-8",
        ["solo"],
      ).success,
    ).toBe(true);
  });

  it("rejects modes not enabled for a game or tournament", () => {
    expect(validateTournamentRegistration(valid, "tekken-8").success).toBe(false);
    expect(
      validateTournamentRegistration(
        { ...valid, mode: "duo", members: valid.members.slice(0, 2) },
        "pubg-mobile",
        ["solo"],
      ).success,
    ).toBe(false);
  });

  it("rejects wrong roster sizes, duplicate IDs, and missing team names", () => {
    expect(
      validateTournamentRegistration({ ...valid, members: valid.members.slice(0, 3) }, "pubg-mobile").success,
    ).toBe(false);
    expect(
      validateTournamentRegistration(
        { ...valid, members: valid.members.map((member) => ({ ...member, inGameId: "same" })) },
        "pubg-mobile",
      ).success,
    ).toBe(false);
    expect(
      validateTournamentRegistration({ ...valid, teamName: undefined }, "pubg-mobile").success,
    ).toBe(false);
    expect(
      validateTournamentRegistration({ ...valid, teamName: "ClutchVerse Admin" }, "pubg-mobile").success,
    ).toBe(false);
  });

  it("validates game-specific platforms and IDs plus squad substitutes", () => {
    expect(
      validateTournamentRegistration(
        { ...valid, members: valid.members.slice(0, 1), mode: "solo", teamName: undefined, teamTag: undefined, platform: "Android" },
        "pubg-mobile",
      ).success,
    ).toBe(true);
    expect(
      validateTournamentRegistration(
        { ...valid, members: valid.members.map((member) => ({ ...member, inGameId: "player-1" })) },
        "pubg-mobile",
      ).success,
    ).toBe(false);
    expect(
      validateTournamentRegistration(
        { ...valid, platform: "PC" },
        "free-fire",
      ).success,
    ).toBe(false);
    expect(
      validateTournamentRegistration(
        { ...valid, substitutes: [{ inGameName: "Echo", inGameId: "10101" }] },
        "pubg-mobile",
      ).success,
    ).toBe(false);
  });

  it("waitlists only after the configured capacity is full", () => {
    expect(getRegistrationStatus(0, 1)).toBe("registered");
    expect(getRegistrationStatus(1, 1)).toBe("waitlisted");
    expect(normalizeTeamName("  CLUTCH  Crew ")).toBe(
      normalizeTeamName("clutch crew"),
    );
  });
});
