import { describe, expect, it } from "vitest";
import { contactSchema } from "./contact-validation";

const validSubmission = {
  name: "Player One",
  email: "player@example.com",
  topic: "general",
  message: "I would like to ask about tournament eligibility.",
  website: "",
};

describe("contact form validation", () => {
  it("accepts a complete community enquiry", () => {
    expect(contactSchema.safeParse(validSubmission).success).toBe(true);
  });

  it("rejects malformed email, short messages, and filled honeypot fields", () => {
    expect(
      contactSchema.safeParse({ ...validSubmission, email: "invalid" }).success,
    ).toBe(false);
    expect(
      contactSchema.safeParse({ ...validSubmission, message: "hello" }).success,
    ).toBe(false);
    expect(
      contactSchema.safeParse({ ...validSubmission, website: "spam" }).success,
    ).toBe(false);
  });
});
