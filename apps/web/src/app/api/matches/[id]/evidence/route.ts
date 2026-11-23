import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { checkRateLimit, getRequestAddress } from "@/lib/rate-limit";
import {
  isMatchEvidenceStorageConfigured,
  isSupportedMatchEvidenceType,
  removeMatchEvidence,
  saveMatchEvidence,
} from "@/lib/match-evidence-storage";
import { suggestMatchResult } from "@/lib/match-result-vision";
import {
  getMatchLobbyActor,
  isMatchLobbyEnabled,
  publishMatchLobbyEvent,
} from "@/lib/match-lobby";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maxBytes = 8 * 1024 * 1024;

function hasExpectedSignature(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === "image/png")
    return (
      bytes.length >= 8 &&
      Buffer.from(bytes.slice(0, 8)).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      )
    );
  if (mimeType === "image/jpeg")
    return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/webp")
    return (
      bytes.length > 12 &&
      Buffer.from(bytes.slice(0, 4)).toString("ascii") === "RIFF" &&
      Buffer.from(bytes.slice(8, 12)).toString("ascii") === "WEBP"
    );
  return false;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await isMatchLobbyEnabled()))
    return NextResponse.json({ error: "Match lobby is unavailable." }, { status: 404 });
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const limit = await checkRateLimit(
    `match-evidence:${session.user.id}:${getRequestAddress(request)}`,
    5,
    60_000,
  );
  if (!limit.allowed)
    return NextResponse.json({ error: "Too many uploads. Try again shortly." }, { status: 429 });
  const actor = await getMatchLobbyActor(id, session.user.id);
  if (!actor) return NextResponse.json({ error: "Match not found." }, { status: 404 });
  if (!actor.isParticipant && !actor.canManage)
    return NextResponse.json({ error: "Match participant permission required." }, { status: 403 });
  if (!isMatchEvidenceStorageConfigured())
    return NextResponse.json({ error: "Private evidence storage is not configured." }, { status: 503 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxBytes + 65_536)
    return NextResponse.json({ error: "Screenshot must be 8 MB or smaller." }, { status: 413 });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "A screenshot upload is required." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size < 1 || file.size > maxBytes)
    return NextResponse.json({ error: "Screenshot must be 8 MB or smaller." }, { status: 400 });
  if (!isSupportedMatchEvidenceType(file.type))
    return NextResponse.json({ error: "Use a PNG, JPEG, or WebP screenshot." }, { status: 415 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasExpectedSignature(bytes, file.type))
    return NextResponse.json({ error: "Screenshot content does not match its image type." }, { status: 415 });

  let storageKey: string;
  try {
    storageKey = await saveMatchEvidence(bytes, file.type);
  } catch (error) {
    console.error("Match evidence storage failed.", {
      reason: error instanceof Error ? error.message : "storage-error",
    });
    return NextResponse.json({ error: "Unable to store this screenshot." }, { status: 503 });
  }
  let aiSuggestion: { placement?: number; kills?: number; score?: number } | null = null;
  let visionStatus: "suggested" | "unconfigured" | "failed" = "unconfigured";
  if (process.env.GEMINI_API_KEY) {
    try {
      aiSuggestion = await suggestMatchResult(bytes, file.type);
      visionStatus = aiSuggestion ? "suggested" : "failed";
    } catch (error) {
      visionStatus = "failed";
      console.error("Match screenshot suggestion failed.", {
        reason: error instanceof Error ? error.message : "vision-error",
      });
    }
  }
  try {
    const evidence = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.matchEvidence.create({
        data: {
          matchId: id,
          uploaderId: session.user.id,
          storageKey,
          mimeType: file.type,
          sizeBytes: bytes.byteLength,
          aiSuggestion: aiSuggestion ?? undefined,
        },
        select: { id: true, mimeType: true, sizeBytes: true, createdAt: true },
      });
      await transaction.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "match.evidence.upload",
          targetType: "match",
          targetId: id,
          metadata: { evidenceId: saved.id, sizeBytes: saved.sizeBytes },
        },
      });
      return saved;
    });
    const realtime = await publishMatchLobbyEvent(id, "match:lobby:update");
    return NextResponse.json({
      evidence: {
        ...evidence,
        createdAt: evidence.createdAt.toISOString(),
        url: `/api/matches/${encodeURIComponent(id)}/evidence/${encodeURIComponent(evidence.id)}`,
        aiSuggestion,
        visionStatus,
      },
      realtime,
    }, { status: 201 });
  } catch (error) {
    try {
      await removeMatchEvidence(storageKey);
    } catch (cleanupError) {
      console.error("Orphaned match evidence cleanup failed.", {
        reason: cleanupError instanceof Error ? cleanupError.name : "storage-error",
      });
    }
    console.error("Match evidence metadata save failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json({ error: "Unable to save screenshot evidence." }, { status: 503 });
  }
}
