import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";

export const runtime = "nodejs";

const decisionSchema = z.object({ decision: z.enum(["accept", "decline"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;
  const input = await request.json().catch(() => null);
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Invite decision is invalid." }, { status: 400 });
  try {
    const invite = await prisma.teamInvite.findUnique({ where: { id }, include: { team: true } });
    if (!invite || invite.inviteeId !== session.user.id) return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
    if (invite.status !== "pending" || invite.expiresAt <= new Date()) {
      return NextResponse.json({ error: "This invitation is no longer active." }, { status: 409 });
    }
    await prisma.$transaction(async (transaction) => {
      if (parsed.data.decision === "accept") {
        await transaction.teamMembership.upsert({
          where: { userId_teamId: { userId: session.user.id, teamId: invite.teamId } },
          update: {},
          create: { userId: session.user.id, teamId: invite.teamId, role: "member" },
        });
      }
      await transaction.teamInvite.update({
        where: { id },
        data: { status: parsed.data.decision === "accept" ? "accepted" : "declined" },
      });
      await transaction.notification.create({
        data: {
          userId: invite.inviterId,
          type: `team_invite_${parsed.data.decision}`,
          payload: { title: "Team invitation update", message: `${session.user.name ?? "A player"} ${parsed.data.decision === "accept" ? "accepted" : "declined"} your invitation to ${invite.team.name}.` },
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: session.user.id,
          action: `team.invite.${parsed.data.decision}`,
          targetType: "team",
          targetId: invite.teamId,
        },
      });
    });
    return NextResponse.json({ status: parsed.data.decision === "accept" ? "accepted" : "declined" });
  } catch (error) {
    console.error("Team invitation response failed.", error);
    return NextResponse.json({ error: "Unable to update this invitation." }, { status: 503 });
  }
}
