import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@clutchverse/db";
import { getCreatorActor } from "@/lib/creator-api";
import { deleteCreatorClip, saveCreatorClip } from "@/lib/creator-clip-storage";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const result = await getCreatorActor(request);
  if ("error" in result) return result.error;
  const clips = await prisma.creatorClip.findMany({
    where: { ownerId: result.actor.userId },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { _count: { select: { votes: true } } },
  });
  return NextResponse.json({ clips });
}

export async function POST(request: Request) {
  const result = await getCreatorActor(request);
  if ("error" in result) return result.error;
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 101 * 1024 * 1024)
    return NextResponse.json({ error: "Clip uploads are limited to 100 MB." }, { status: 413 });
  const form = await request.formData().catch(() => null);
  const optionalNumber = z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().min(1).max(3_600_000).optional(),
  );
  const parsed = z.object({
    title: z.string().trim().min(2).max(120),
    file: z.instanceof(File),
    durationMs: optionalNumber,
    trimStartMs: z.coerce.number().int().min(0).max(3_600_000).default(0),
    trimEndMs: optionalNumber,
  }).safeParse(form ? Object.fromEntries(form.entries()) : null);
  if (!parsed.success) return NextResponse.json({ error: "Clip details or video are invalid." }, { status: 400 });
  if (parsed.data.trimEndMs && parsed.data.trimEndMs <= parsed.data.trimStartMs)
    return NextResponse.json({ error: "Clip end must be after its start." }, { status: 400 });
  let stored: Awaited<ReturnType<typeof saveCreatorClip>>;
  try {
    stored = await saveCreatorClip(parsed.data.file);
  } catch (error) {
    const invalid = error instanceof Error && error.message.startsWith("INVALID_CREATOR_CLIP");
    if (!invalid) {
      console.error("Creator clip storage failed.", { reason: error instanceof Error ? error.name : "storage-error" });
    }
    return NextResponse.json({ error: invalid ? "Upload an MP4/WebM video up to 100 MB." : "Unable to store this clip." }, { status: invalid ? 400 : 503 });
  }
  try {
    const clip = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.creatorClip.create({
        data: {
          ownerId: result.actor.userId,
          title: parsed.data.title,
          ...stored,
          durationMs: parsed.data.durationMs,
          trimStartMs: parsed.data.trimStartMs,
          trimEndMs: parsed.data.trimEndMs,
        },
      });
      await transaction.auditLog.create({
        data: { actorId: result.actor.userId, action: "creator.clip.create", targetType: "creator-clip", targetId: saved.id },
      });
      return saved;
    });
    return NextResponse.json({ clip: { id: clip.id, title: clip.title, createdAt: clip.createdAt, trimStartMs: clip.trimStartMs, trimEndMs: clip.trimEndMs } }, { status: 201 });
  } catch (error) {
    await deleteCreatorClip(stored.storageKey).catch((cleanupError: unknown) =>
      console.error("Creator clip cleanup failed.", { reason: cleanupError instanceof Error ? cleanupError.name : "storage-error" }),
    );
    console.error("Creator clip record creation failed.", { reason: error instanceof Error ? error.name : "database-error" });
    return NextResponse.json({ error: "Unable to save clip details." }, { status: 503 });
  }
}
