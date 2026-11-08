import { describe, expect, it } from "vitest";
import {
  getRegistrationStatus,
  validateTournamentRegistration,
} from "./tournament-registration";

const valid = {
  mode: "squad",
  teamName: "Clutch Crew",
  region: "South Asia",
  members: [
    { inGameName: "Alpha", inGameId: "a1" },
    { inGameName: "Bravo", inGameId: "b2" },
    { inGameName: "Charlie", inGameId: "c3" },
    { inGameName: "Delta", inGameId: "d4" },
  ],
  eligibilityConfirmed: true,
  rulesAccepted: true,
  idempotencyKey: "0d9b40a4-bfd9-4bf1-9bef-e3502a1ed8a9",
};

describe("tournament registration validation", () => {
  it("accepts a complete PUBG squad and valid solo Tekken registration", () => {
    expect(validateTournamentRegistration(valid, "pubg-mobile").success).toBe(true);
    expect(
      validateTournamentRegistration(
        { ...valid, mode: "solo", teamName: undefined, members: valid.members.slice(0, 1) },
        "tekken-8",
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

  it("waitlists only after the configured capacity is full", () => {
    expect(getRegistrationStatus(0, 1)).toBe("registered");
    expect(getRegistrationStatus(1, 1)).toBe("waitlisted");
  });
});
