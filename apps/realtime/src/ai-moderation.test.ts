import { describe, expect, it } from "vitest";
import { parseModerationResult } from "./ai-moderation";

describe("AI moderation review threshold", () => {
  it("only queues valid high-confidence flagged content for human review", () => {
    expect(parseModerationResult({ flagged: true, category: "harassment", confidence: 0.9 })).toMatchObject({
      flagged: true,
      category: "harassment",
    });
    expect(parseModerationResult({ flagged: true, category: "threat", confidence: 0.84 })).toBeNull();
    expect(parseModerationResult({ flagged: false, category: "none", confidence: 1 })).toBeNull();
    expect(parseModerationResult({ flagged: true, category: "unknown", confidence: 0.99 })).toBeNull();
  });
});
