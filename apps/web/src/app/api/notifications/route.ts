import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateSchema = z.object({ id: z.string().min(1).max(64).optional(), all: z.boolean().optional() })
  .refine((value) => Boolean(value.id) || value.all === true);

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ notifications });
  } catch (error) {
    console.error("Notification query failed.", error);
    return NextResponse.json({ error: "Notifications are unavailable." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const input = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Notification update is invalid." }, { status: 400 });
  try {
    const result = await prisma.notification.updateMany({
      where: {
        userId: session.user.id,
        readAt: null,
        ...(parsed.data.id ? { id: parsed.data.id } : {}),
      },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ updated: result.count });
  } catch (error) {
    console.error("Notification update failed.", error);
    return NextResponse.json({ error: "Unable to update notifications." }, { status: 503 });
  }
}
