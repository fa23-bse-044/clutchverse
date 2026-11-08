import { expect, test } from "@playwright/test";
import { prisma } from "@clutchverse/db";
import { cleanupScope, createPlayer, login, newScope } from "./helpers";

test.describe("community chat", () => {
  let scope: string;

  test.beforeEach(() => {
    scope = newScope();
  });

  test.afterEach(async () => cleanupScope(scope));

  test("sends a chat message, persists history, and records a reaction", async ({
    page,
    request,
  }) => {
    const unauthorized = await request.get("/api/notifications");
    expect(unauthorized.status()).toBe(401);

    const player = await createPlayer(scope, "chatter");
    await login(page, player);
    await page.goto("/community");
    await expect(page.getByText("Connected", { exact: true })).toBeVisible();

    const body = `${scope} realtime chat message`;
    await page.getByRole("textbox", { name: "Message" }).fill(body);
    await page.getByRole("button", { name: "Send message" }).click();
    const message = page.locator(".chat-message").filter({ hasText: body });
    await expect(message).toBeVisible();

    const historyResponse = await page.request.get(
      "/api/chat/global/messages?limit=50",
    );
    expect(historyResponse.status()).toBe(200);
    const history = (await historyResponse.json()) as {
      messages: { id: string; body: string; author: { id: string } }[];
    };
    const savedMessage = history.messages.find((item) => item.body === body);
    expect(savedMessage?.author.id).toBe(player.id);
    expect(savedMessage?.id).toBeTruthy();

    await message.getByRole("button", { name: "React 🔥" }).click();
    await expect(
      message.getByRole("button", { name: /React 🔥/ }),
    ).toContainText("1");
    const persistedReaction = await prisma.chatReaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId: savedMessage!.id,
          userId: player.id,
          emoji: "🔥",
        },
      },
    });
    expect(persistedReaction).not.toBeNull();
  });
});
