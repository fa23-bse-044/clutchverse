import { describe, expect, it } from "vitest";
import {
  buildYoutubeLiveSearchUrl,
  classifyYoutubeFailure,
} from "./youtube-live";

describe("YouTube live search", () => {
  it("uses the live video search filters and game/language context", () => {
    const url = buildYoutubeLiveSearchUrl("pubg-mobile", "ur", "server-key");
    expect(url.searchParams.get("eventType")).toBe("live");
    expect(url.searchParams.get("type")).toBe("video");
    expect(url.searchParams.get("q")).toContain("PUBG Mobile");
    expect(url.searchParams.get("relevanceLanguage")).toBe("ur");
    expect(url.searchParams.get("key")).toBe("server-key");
  });

  it("distinguishes quota exhaustion and API restrictions", () => {
    expect(classifyYoutubeFailure("quotaExceeded")).toBe("quota-exceeded");
    expect(classifyYoutubeFailure("accessNotConfigured")).toBe("api-restricted");
    expect(classifyYoutubeFailure("serverError")).toBe("provider-error");
  });
});
