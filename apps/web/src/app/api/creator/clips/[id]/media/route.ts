import { NextResponse } from "next/server";
import { prisma } from "@clutchverse/db";
import { readCreatorClip } from "@/lib/creator-clip-storage";
import { isCreatorToolsEnabled } from "@/lib/creator-tools";
import { checkRateLimit, getRequestAddress } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isCreatorToolsEnabled())) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const limit = await checkRateLimit(`creator-clip-media:${getRequestAddress(_request)}`, 60, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Too many media requests." }, { status: 429 });
  const { id } = await params;
  const clip = await prisma.creatorClip.findFirst({
    where: { id, visibility: "public", owner: { creatorProfile: { isNot: null } } },
    select: { storageKey: true, mimeType: true },
  });
  if (!clip) return NextResponse.json({ error: "Clip not found." }, { status: 404 });
  try {
    const bytes = await readCreatorClip(clip.storageKey);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "content-type": clip.mimeType,
        "cache-control": "public, max-age=300",
        "x-content-type-options": "nosniff",
        "content-disposition": "inline",
      },
    });
  } catch (error) {
    console.error("Creator clip read failed.", { reason: error instanceof Error ? error.name : "storage-error" });
    return NextResponse.json({ error: "Clip media is unavailable." }, { status: 503 });
  }
}
