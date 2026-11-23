import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { checkRateLimit, getRequestAddress } from "@/lib/rate-limit";
import { readMatchEvidence } from "@/lib/match-evidence-storage";
import { getMatchLobbyActor, isMatchLobbyEnabled } from "@/lib/match-lobby";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; evidenceId: string }> },
) {
  if (!(await isMatchLobbyEnabled()))
    return NextResponse.json({ error: "Match lobby is unavailable." }, { status: 404 });
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const limit = await checkRateLimit(
    `match-evidence-read:${session.user.id}:${getRequestAddress(request)}`,
    30,
    60_000,
  );
  if (!limit.allowed)
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const { id, evidenceId } = await params;
  const actor = await getMatchLobbyActor(id, session.user.id);
  if (!actor) return NextResponse.json({ error: "Match not found." }, { status: 404 });
  if (!actor.canView)
    return NextResponse.json({ error: "Match participant permission required." }, { status: 403 });
  const evidence = await prisma.matchEvidence.findFirst({
    where: { id: evidenceId, matchId: id },
    select: { storageKey: true, mimeType: true },
  });
  if (!evidence)
    return NextResponse.json({ error: "Evidence not found." }, { status: 404 });
  try {
    const bytes = await readMatchEvidence(evidence.storageKey);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "content-type": evidence.mimeType,
        "content-length": String(bytes.byteLength),
        "content-disposition": 'inline; filename="match-evidence"',
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    console.error("Match evidence read failed.", {
      reason: error instanceof Error ? error.name : "storage-error",
    });
    return NextResponse.json({ error: "Evidence storage is unavailable." }, { status: 503 });
  }
}
