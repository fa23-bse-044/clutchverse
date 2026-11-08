import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";

export const runtime = "nodejs";

const directSchema = z.object({ recipientId: z.string().min(1).max(64) });

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const input = await request.json().catch(() => null);
  const parsed = directSchema.safeParse(input);
  if (!parsed.success || parsed.data.recipientId === session.user.id) {
    return NextResponse.json({ error: "A valid recipient is required." }, { status: 400 });
  }
  try {
    const recipient = await prisma.user.findUnique({ where: { id: parsed.data.recipientId }, select: { id: true } });
    if (!recipient) return NextResponse.json({ error: "Player not found." }, { status: 404 });
    const participantIds = [session.user.id, recipient.id].sort();
    const digest = createHash("sha256").update(participantIds.join(":")).digest("hex").slice(0, 40);
    const slug = `dm:${digest}`;
    const room = await prisma.$transaction(async (transaction) => {
      const created = await transaction.chatRoom.upsert({
        where: { slug },
        update: {},
        create: { slug, type: "dm" },
      });
      for (const userId of participantIds) {
        await transaction.chatRoomMember.upsert({
          where: { roomId_userId: { roomId: created.id, userId } },
          update: {},
          create: { roomId: created.id, userId },
        });
      }
      return created;
    });
    return NextResponse.json({ room: { slug: room.slug } }, { status: 201 });
  } catch (error) {
    console.error("Direct conversation creation failed.", error);
    return NextResponse.json({ error: "Unable to open a direct conversation." }, { status: 503 });
  }
}
