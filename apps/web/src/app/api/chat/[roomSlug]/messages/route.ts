import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { canAccessChatRoom, prisma } from "@clutchverse/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(30),
  cursor: z.string().min(1).max(64).optional(),
});

export async function GET(request: Request, { params }: { params: Promise<{ roomSlug: string }> }) {
  const { roomSlug } = await params;
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid pagination." }, { status: 400 });
  try {
    const room = await prisma.chatRoom.findUnique({ where: { slug: roomSlug } });
    if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });
    if (!["global", "game"].includes(room.type)) {
      const session = await auth();
      if (!session?.user?.id || !(await canAccessChatRoom(roomSlug, session.user.id))) {
        return NextResponse.json({ error: "Room membership required." }, { status: 403 });
      }
    }
    const messages = await prisma.chatMessage.findMany({
      where: { roomId: room.id, deletedAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: parsed.data.limit + 1,
      ...(parsed.data.cursor ? { cursor: { id: parsed.data.cursor }, skip: 1 } : {}),
      include: { author: { select: { id: true, name: true } } },
    });
    const hasMore = messages.length > parsed.data.limit;
    const page = (hasMore ? messages.slice(0, -1) : messages).reverse();
    return NextResponse.json({
      messages: page.map((message) => ({ ...message, createdAt: message.createdAt.toISOString() })),
      nextCursor: hasMore ? page[0]?.id ?? null : null,
    });
  } catch (error) {
    console.error("Chat history query failed.", error);
    return NextResponse.json({ error: "Chat history is unavailable." }, { status: 503 });
  }
}
