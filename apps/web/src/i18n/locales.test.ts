import { describe, expect, it } from "vitest";
import {
  formatLocalizedDate,
  formatLocalizedNumber,
  getDirection,
  languageOptions,
  locales,
} from "./locales";
import { messages } from "./messages";

describe("supported locale configuration", () => {
  it("provides all six requested languages and complete FAQ categories", () => {
    expect(locales).toEqual(["en", "ur", "ar", "zh", "hi", "es"]);
    for (const locale of locales) {
      expect(messages[locale].faq.questions).toHaveLength(12);
      expect(Object.keys(messages[locale].faq.categories)).toHaveLength(6);
      expect(
        languageOptions.find((option) => option.code === locale),
      ).toBeDefined();
    }
  });

  it("enables right-to-left layout only for Urdu and Arabic", () => {
    expect(getDirection("ur")).toBe("rtl");
    expect(getDirection("ar")).toBe("rtl");
    expect(getDirection("en")).toBe("ltr");
    expect(getDirection("zh")).toBe("ltr");
    expect(getDirection("hi")).toBe("ltr");
    expect(getDirection("es")).toBe("ltr");
  });

  it("formats dates and numbers using the selected locale", () => {
    expect(formatLocalizedNumber(123456, "en")).toBe("123,456");
    expect(formatLocalizedNumber(123456, "es")).toContain(".");
    expect(formatLocalizedDate("2026-01-02T00:00:00Z", "en")).not.toBe(
      formatLocalizedDate("2026-01-02T00:00:00Z", "zh"),
    );
  });
});
