import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@clutchverse/db";

export const dynamic = "force-dynamic";

const querySchema = z.string().trim().min(2).max(32);

export async function GET(request: Request) {
  const parsed = querySchema.safeParse(new URL(request.url).searchParams.get("q"));
  if (!parsed.success) return NextResponse.json({ error: "Search needs at least two characters." }, { status: 400 });
  try {
    const players = await prisma.playerProfile.findMany({
      where: { handle: { contains: parsed.data, mode: "insensitive" } },
      select: { userId: true, handle: true, region: true },
      take: 20,
      orderBy: { handle: "asc" },
    });
    return NextResponse.json({ players });
  } catch (error) {
    console.error("Player search failed.", error);
    return NextResponse.json({ error: "Player search is unavailable." }, { status: 503 });
  }
}
