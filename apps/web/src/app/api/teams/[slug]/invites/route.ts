import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";

export const runtime = "nodejs";

const inviteSchema = z.object({ inviteeId: z.string().min(1).max(64) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { slug } = await params;
  const input = await request.json().catch(() => null);
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invite recipient is invalid." },
      { status: 400 },
    );
  try {
    const team = await prisma.team.findUnique({
      where: { slug },
      include: { memberships: { where: { userId: session.user.id } } },
    });
    if (
      !team ||
      !team.memberships.some((membership) =>
        ["captain", "owner"].includes(membership.role),
      )
    ) {
      return NextResponse.json(
        { error: "Team captain permission required." },
        { status: 403 },
      );
    }
    if (parsed.data.inviteeId === session.user.id) {
      return NextResponse.json(
        { error: "You cannot invite yourself." },
        { status: 400 },
      );
    }
    const invitee = await prisma.user.findUnique({
      where: { id: parsed.data.inviteeId },
      select: { id: true },
    });
    if (!invitee)
      return NextResponse.json({ error: "Player not found." }, { status: 404 });
    const membership = await prisma.teamMembership.findUnique({
      where: { userId_teamId: { userId: invitee.id, teamId: team.id } },
      select: { id: true },
    });
    if (membership)
      return NextResponse.json(
        { error: "This player is already on the roster." },
        { status: 409 },
      );
    const result = await prisma.$transaction(async (transaction) => {
      const invitation = await transaction.teamInvite.upsert({
        where: { teamId_inviteeId: { teamId: team.id, inviteeId: invitee.id } },
        update: {
          inviterId: session.user.id,
          status: "pending",
          expiresAt: new Date(Date.now() + 7 * 86400_000),
        },
        create: {
          teamId: team.id,
          inviterId: session.user.id,
          inviteeId: invitee.id,
          expiresAt: new Date(Date.now() + 7 * 86400_000),
        },
      });
      await transaction.notification.create({
        data: {
          userId: invitee.id,
          type: "team_invite",
          payload: {
            title: `Invitation to ${team.name}`,
            message: "A team captain invited you to join their roster.",
            inviteId: invitation.id,
          },
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "team.invite",
          targetType: "team",
          targetId: team.id,
        },
      });
      return invitation;
    });
    return NextResponse.json(
      {
        invite: {
          id: result.id,
          status: result.status,
          expiresAt: result.expiresAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Team invitation failed.", error);
    return NextResponse.json(
      { error: "Unable to invite this player." },
      { status: 503 },
    );
  }
}
