import { describe, expect, it } from "vitest";
import {
  getAssistantMode,
  isMatchRecapRequest,
  isNewsDraftRequest,
} from "./ai-assistant";

describe("AI assistant request intent", () => {
  it("recognizes draft requests that require human approval", () => {
    expect(isNewsDraftRequest("Draft a news article about our finals")).toBe(true);
    expect(getAssistantMode("Write a news announcement for this tournament")).toBe("news-draft");
    expect(isNewsDraftRequest("What is the latest tournament news?")).toBe(false);
  });

  it("recognizes match recap, recommendation, and team/scrim assistance", () => {
    expect(isMatchRecapRequest("Recap my match results")).toBe(true);
    expect(getAssistantMode("Recommend a tournament for Tekken")).toBe("tournament-recommendation");
    expect(getAssistantMode("Help me find a scrim partner")).toBe("team-scrim-helper");
  });
});
