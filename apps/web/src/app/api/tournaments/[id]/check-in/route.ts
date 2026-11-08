import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@clutchverse/db";
import { auth } from "@/auth";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await params;

  try {
    const registration = await prisma.registration.findFirst({
      where: {
        tournamentId: id,
        OR: [
          { userId: session.user.id },
          { team: { memberships: { some: { userId: session.user.id, role: { in: ["captain", "owner"] } } } } },
        ],
      },
      include: { tournament: true },
    });
    if (!registration) return NextResponse.json({ error: "No registration found for this account." }, { status: 404 });
    const minutesUntilStart = (registration.tournament.startsAt.getTime() - Date.now()) / 60_000;
    const settings = z.object({ checkInMinutes: z.number().int().min(0).max(1440) }).safeParse(registration.tournament.settings);
    const checkInWindow = settings.success ? settings.data.checkInMinutes : 30;
    if (minutesUntilStart > checkInWindow || minutesUntilStart < -15) {
      return NextResponse.json({ error: "Check-in is not open for this event." }, { status: 409 });
    }
    const updated = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.registration.update({
        where: { id: registration.id },
        data: { checkedInAt: new Date(), status: "checked-in" },
      });
      await transaction.auditLog.create({
        data: { actorId: session.user.id, action: "tournament.check-in", targetType: "registration", targetId: saved.id },
      });
      return saved;
    });
    return NextResponse.json({ registration: updated });
  } catch (error) {
    console.error("Tournament check-in failed.", error);
    return NextResponse.json({ error: "Unable to check in to this tournament." }, { status: 503 });
  }
}
