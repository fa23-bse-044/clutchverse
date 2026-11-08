import { afterEach, describe, expect, it, vi } from "vitest";
import { sendContactNotification } from "./contact-email";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("contact email adapter", () => {
  it("uses a development mock when provider credentials are absent", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    await expect(
      sendContactNotification({
        name: "Player One",
        email: "player@example.com",
        topic: "general",
        message: "I have a question about an event.",
      }),
    ).resolves.toBe("development-mock");
  });

  it("sends a server-side Resend request when configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-token");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      sendContactNotification({
        name: "Player One",
        email: "player@example.com",
        topic: "privacy",
        message: "Please tell me about account data retention.",
      }),
    ).resolves.toBe("sent");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      }),
    );
  });
});
