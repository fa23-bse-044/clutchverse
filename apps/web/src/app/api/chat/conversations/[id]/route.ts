import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const idSchema = z.string().cuid();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }
  try {
    const conversation = await prisma.chatbotConversation.findFirst({
      where: { id, userId: session.user.id },
      select: {
        id: true,
        messages: {
          orderBy: { createdAt: "asc" },
          take: 40,
          select: { role: true, content: true, createdAt: true },
        },
      },
    });
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }
    return NextResponse.json({
      conversation: {
        id: conversation.id,
        messages: conversation.messages.map((message) => ({
          role: message.role.toLowerCase(),
          content: message.content,
          createdAt: message.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error("Chatbot conversation could not be loaded.", error);
    return NextResponse.json(
      { error: "Conversation history is unavailable." },
      { status: 503 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }
  try {
    const result = await prisma.chatbotConversation.deleteMany({
      where: { id, userId: session.user.id },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Chatbot conversation could not be deleted.", error);
    return NextResponse.json(
      { error: "Unable to delete this conversation." },
      { status: 503 },
    );
  }
}
