import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  dispatchSpotlightEvent,
  spotlightEventSchema,
} from "./spotlight-events";

describe("spotlight realtime event contract", () => {
  it("validates and emits recorded updates into the event room", () => {
    const fixture = readFileSync(
      new URL("./fixtures/spotlight-counts-updated.json", import.meta.url),
      "utf8",
    );
    const message = spotlightEventSchema.parse(JSON.parse(fixture) as unknown);
    const emitted: Array<{ room: string; event: string; payload: Record<string, unknown> }> = [];
    dispatchSpotlightEvent(message, (room, event, payload) => {
      emitted.push({ room, event, payload });
    });
    expect(emitted).toEqual([{
      room: "spotlight:fixture-event",
      event: "counts:updated",
      payload: {
        slug: "fixture-event",
        confirmedTeams: 0,
        updatedAt: "2026-11-23T00:00:00.000Z",
      },
    }]);
  });

  it("rejects malformed or unknown event names", () => {
    expect(() => spotlightEventSchema.parse({
      slug: "bad slug",
      event: "team:added",
      payload: {},
      updatedAt: "not-a-date",
    })).toThrow();
  });
});
