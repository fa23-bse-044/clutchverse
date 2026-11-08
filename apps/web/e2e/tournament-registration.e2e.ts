import { expect, test } from "@playwright/test";
import { prisma } from "@clutchverse/db";
import {
  cleanupScope,
  createPlayer,
  createTournament,
  newScope,
  registerPlayer,
} from "./helpers";

test.describe("tournament registration and check-in", () => {
  let scope: string;

  test.beforeEach(() => {
    scope = newScope();
  });

  test.afterEach(async () => cleanupScope(scope));

  test("registers and logs in a player, registers for an event, then checks in", async ({
    page,
    browser,
    request,
  }) => {
    const organizer = await createPlayer(scope, "organizer", "ORGANIZER");
    const tournament = await createTournament(scope, organizer.id, {
      title: `${scope} Check-in Cup`,
      state: "UPCOMING",
      startsAt: new Date(Date.now() + 5 * 60_000),
    });

    const anonymous = await request.post(
      `/api/tournaments/${tournament.id}/register`,
      { data: {} },
    );
    expect(anonymous.status()).toBe(401);
    const anonymousCheckIn = await request.post(
      `/api/tournaments/${tournament.id}/check-in`,
    );
    expect(anonymousCheckIn.status()).toBe(401);

    const player = await registerPlayer(page, scope);
    const loginContext = await browser.newContext();
    try {
      const loginPage = await loginContext.newPage();
      await loginPage.goto("/login");
      await loginPage.getByLabel("EMAIL ADDRESS").fill(player.email);
      await loginPage
        .getByLabel("PASSWORD", { exact: true })
        .fill(player.password);
      await loginPage.getByRole("button", { name: /^sign in$/i }).click();
      await expect(loginPage).toHaveURL(/\/$/);

      await loginPage.goto("/settings");
      const settingsRows = loginPage.locator(
        ".settings-sections .settings-row",
      );
      for (const index of [2, 3, 4, 5]) {
        const preferenceResponse = loginPage.waitForResponse(
          (response) =>
            response.url().endsWith("/api/profile/preferences") &&
            response.request().method() === "PATCH",
        );
        await settingsRows.nth(index).getByRole("checkbox").check();
        expect((await preferenceResponse).status()).toBe(200);
      }

      const themeControl = loginPage.locator(
        ".header-actions .theme-control button",
      );
      await themeControl.click();
      const themeResponse = loginPage.waitForResponse(
        (response) =>
          response.url().endsWith("/api/profile/preferences") &&
          response.request().method() === "PATCH",
      );
      await loginPage.getByRole("button", { name: /Arctic Frost/ }).click();
      expect((await themeResponse).status()).toBe(200);
      await expect(loginPage.locator("html")).toHaveAttribute(
        "data-theme",
        "arctic-frost",
      );

      const savedPreferences = await loginPage.request.get(
        "/api/profile/preferences",
      );
      expect(savedPreferences.status()).toBe(200);
      expect((await savedPreferences.json()).preferences).toMatchObject({
        theme: "arctic-frost",
        performanceMode: true,
        backgroundVideo: true,
        soundEnabled: true,
        customCursor: true,
      });
      const persistedProfilePreferences = await prisma.user.findUnique({
        where: { id: player.id },
        select: {
          theme: true,
          performanceMode: true,
          backgroundVideo: true,
          soundEnabled: true,
          customCursor: true,
        },
      });
      expect(persistedProfilePreferences).toMatchObject({
        theme: "arctic-frost",
        performanceMode: true,
        backgroundVideo: true,
        soundEnabled: true,
        customCursor: true,
      });

      const registrationResponse = await loginPage.request.post(
        `/api/tournaments/${tournament.id}/register`,
        { data: {} },
      );
      expect(registrationResponse.status()).toBe(201);
      const registrationBody = (await registrationResponse.json()) as {
        registration: { id: string; userId: string };
      };
      expect(registrationBody.registration.userId).toBe(player.id);

      const persistedRegistration = await prisma.registration.findUnique({
        where: { id: registrationBody.registration.id },
      });
      expect(persistedRegistration?.status).toBe("registered");

      const checkInResponse = await loginPage.request.post(
        `/api/tournaments/${tournament.id}/check-in`,
      );
      expect(checkInResponse.status()).toBe(200);
      const checkInBody = (await checkInResponse.json()) as {
        registration: {
          id: string;
          status: string;
          checkedInAt: string | null;
        };
      };
      expect(checkInBody.registration.status).toBe("checked-in");
      expect(checkInBody.registration.checkedInAt).not.toBeNull();

      const checkedIn = await prisma.registration.findUnique({
        where: { id: registrationBody.registration.id },
      });
      expect(checkedIn?.status).toBe("checked-in");
      expect(checkedIn?.checkedInAt).not.toBeNull();
    } finally {
      await loginContext.close();
    }
  });
});
