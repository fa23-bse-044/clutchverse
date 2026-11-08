import { describe, expect, it } from "vitest";
import {
  chatRequestSchema,
  extractChatErrorMessage,
} from "./chat-request";

describe("chat request parsing", () => {
  it("accepts the widget's latest-message request shape", () => {
    expect(
      chatRequestSchema.parse({ message: "Hi", conversationId: null }),
    ).toMatchObject({ message: "Hi" });
  });

  it("extracts only the latest user text from legacy history payloads", () => {
    expect(
      chatRequestSchema.parse({
        history: [
          { role: "user", content: "x".repeat(2000) },
          { role: "assistant", content: "prior answer" },
          { role: "user", content: "  latest question  " },
        ],
      }),
    ).toMatchObject({ message: "latest question" });
  });

  it("does not apply the latest-message limit to earlier history entries", () => {
    const history = Array.from({ length: 45 }, (_, index) => ({
      role: "assistant",
      content: `previous answer ${index}`,
    }));
    history.push({ role: "user", content: "Hi" });
    expect(chatRequestSchema.parse({ history })).toMatchObject({ message: "Hi" });
  });

  it("limits the latest message only and returns clear validation errors", () => {
    expect(
      chatRequestSchema.safeParse({
        messages: [{ role: "user", content: "x".repeat(1001) }],
      }).error?.issues[0]?.message,
    ).toBe("The latest message must be 1,000 characters or fewer.");
    expect(chatRequestSchema.safeParse({}).error?.issues[0]?.message).toBe(
      "Provide a non-empty latest user message.",
    );
  });

  it("reports provider reasons without returning credentials", () => {
    const error = extractChatErrorMessage(
      403,
      '{"error":{"status":"PERMISSION_DENIED","message":"restricted"}}',
      "test-api-key",
    );
    expect(error.reason).toContain("PERMISSION_DENIED");
    expect(error.userMessage).toContain("credentials");
    expect(error.reason).not.toContain("test-api-key");
  });
});
