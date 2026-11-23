import { describe, expect, it } from "vitest";
import { nextBracketSlot } from "./match-result-engine";

describe("nextBracketSlot", () => {
  it("places odd-position winners in entrant A and even-position winners in entrant B", () => {
    expect(nextBracketSlot(1)).toEqual({
      position: 1,
      entrantField: "entrantAId",
    });
    expect(nextBracketSlot(2)).toEqual({
      position: 1,
      entrantField: "entrantBId",
    });
    expect(nextBracketSlot(3)).toEqual({
      position: 2,
      entrantField: "entrantAId",
    });
  });
});
