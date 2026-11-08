import { expect, test } from "@playwright/test";
import { prisma } from "@clutchverse/db";
import { cleanupScope, createPlayer, login, newScope } from "./helpers";

test.describe("team invitation lifecycle", () => {
  let scope: string;

  test.beforeEach(() => {
    scope = newScope();
  });

  test.afterEach(async () => cleanupScope(scope));

  test("invites players and persists accept and decline responses", async ({
    page,
    browser,
    request,
  }) => {
    const captain = await createPlayer(scope, "captain");
    const accepts = await createPlayer(scope, "accepts");
    const declines = await createPlayer(scope, "declines");
    const team = await prisma.team.create({
      data: {
        slug: `${scope}-invite-squad`,
        name: `${scope} Invite Squad`,
        gameSlug: "pubg-mobile",
        memberships: {
          create: {
            userId: captain.id,
            role: "captain",
          },
        },
      },
    });

    const unauthorizedCreate = await request.post(
      `/api/teams/${team.slug}/invites`,
      { data: { inviteeId: accepts.id } },
    );
    expect(unauthorizedCreate.status()).toBe(401);
    const unauthorizedDecision = await request.patch(
      "/api/team-invites/unknown-invite",
      { data: { decision: "accept" } },
    );
    expect(unauthorizedDecision.status()).toBe(401);

    await login(page, captain);
    await page.goto(`/teams/${team.slug}`);
    const search = page.getByRole("textbox", { name: "Search player handle" });
    const searchAndInvite = async (handle: string) => {
      await search.fill(handle);
      await page.getByRole("button", { name: "Search" }).click();
      const playerButton = page.getByRole("button", {
        name: new RegExp(handle),
      });
      await expect(playerButton).toBeVisible();
      await playerButton.click();
      await expect(
        page.getByRole("status").filter({ hasText: "Invitation sent." }),
      ).toBeVisible();
    };
    await searchAndInvite(accepts.handle);
    await searchAndInvite(declines.handle);

    const invites = await prisma.teamInvite.findMany({
      where: { teamId: team.id },
      orderBy: { inviteeId: "asc" },
    });
    expect(invites).toHaveLength(2);
    expect(invites.every(({ status }) => status === "pending")).toBe(true);
    expect(invites.map(({ inviteeId }) => inviteeId).sort()).toEqual(
      [accepts.id, declines.id].sort(),
    );
    const inviteNotifications = await prisma.notification.findMany({
      where: {
        userId: { in: [accepts.id, declines.id] },
        type: "team_invite",
      },
    });
    expect(inviteNotifications).toHaveLength(2);
    expect(
      inviteNotifications.map((notification) => {
        const payload = notification.payload as { inviteId?: string };
        return payload.inviteId;
      }),
    ).toEqual(expect.arrayContaining(invites.map(({ id }) => id)));

    const acceptContext = await browser.newContext();
    const declineContext = await browser.newContext();
    try {
      const acceptPage = await acceptContext.newPage();
      await login(acceptPage, accepts);
      const acceptSession = (await (
        await acceptPage.request.get("/api/auth/session")
      ).json()) as { user?: { email?: string } };
      expect(acceptSession.user?.email).toBe(accepts.email);
      const acceptInvite = invites.find(
        ({ inviteeId }) => inviteeId === accepts.id,
      );
      expect(acceptInvite).toBeTruthy();
      const persistedAcceptInvite = await prisma.teamInvite.findUnique({
        where: { id: acceptInvite!.id },
      });
      expect(persistedAcceptInvite?.inviteeId).toBe(accepts.id);
      await acceptPage.goto("/notifications");
      await expect(
        acceptPage.getByText(`Invitation to ${team.name}`),
      ).toBeVisible();
      const acceptResponse = acceptPage.waitForResponse(
        (response) =>
          response.url().includes("/api/team-invites/") &&
          response.request().method() === "PATCH",
      );
      await acceptPage.getByRole("button", { name: "Accept" }).click();
      const acceptResult = await acceptResponse;
      expect(
        acceptResult.status(),
        JSON.stringify(await acceptResult.json()),
      ).toBe(200);
      await expect(
        acceptPage.getByRole("button", { name: "Accept" }),
      ).toBeHidden();

      const declinePage = await declineContext.newPage();
      await login(declinePage, declines);
      const notificationsResponse = declinePage.waitForResponse(
        (response) =>
          response.url().endsWith("/api/notifications") &&
          response.request().method() === "GET",
      );
      await declinePage.goto("/notifications");
      const notificationResponse = await notificationsResponse;
      expect(notificationResponse.status()).toBe(200);
      const notificationBody = (await notificationResponse.json()) as {
        notifications: { payload: { title?: string } }[];
      };
      expect(notificationBody.notifications).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            payload: expect.objectContaining({
              title: `Invitation to ${team.name}`,
            }),
          }),
        ]),
      );
      await expect(
        declinePage.getByText(`Invitation to ${team.name}`),
      ).toBeVisible();
      const declineResponse = declinePage.waitForResponse(
        (response) =>
          response.url().includes("/api/team-invites/") &&
          response.request().method() === "PATCH",
      );
      await declinePage.getByRole("button", { name: "Decline" }).click();
      expect((await declineResponse).status()).toBe(200);
      await expect(
        declinePage.getByRole("button", { name: "Decline" }),
      ).toBeHidden();

      const savedInvites = await prisma.teamInvite.findMany({
        where: { teamId: team.id },
      });
      expect(savedInvites.map(({ status }) => status).sort()).toEqual([
        "accepted",
        "declined",
      ]);
      const acceptedMembership = await prisma.teamMembership.findUnique({
        where: { userId_teamId: { userId: accepts.id, teamId: team.id } },
      });
      const declinedMembership = await prisma.teamMembership.findUnique({
        where: { userId_teamId: { userId: declines.id, teamId: team.id } },
      });
      expect(acceptedMembership).not.toBeNull();
      expect(declinedMembership).toBeNull();
    } finally {
      await Promise.all([acceptContext.close(), declineContext.close()]);
    }
  });
});
