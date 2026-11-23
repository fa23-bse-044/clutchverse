import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { checkRateLimit, getRequestAddress } from "@/lib/rate-limit";
import { getProviderHealth } from "@/lib/spotlight-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin(request: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return { error: "Sign in required.", status: 401 as const };
  const limit = await checkRateLimit(
    `spotlight-status:${session.user.id}:${getRequestAddress(request)}`,
    10,
    60_000,
  );
  if (!limit.allowed)
    return { error: "Too many status checks.", status: 429 as const };
  const actor = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  return actor?.role === "ADMIN"
    ? { userId: session.user.id }
    : { error: "Administrator permission required.", status: 403 as const };
}

export async function GET(request: Request) {
  const actor = await requireAdmin(request);
  if ("error" in actor)
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  try {
    const [providers, latestRecord] = await Promise.all([
      getProviderHealth(),
      prisma.spotlightSourceRecord.findFirst({
        orderBy: { fetchedAt: "desc" },
        select: { sourceName: true, sourceUrl: true, fetchedAt: true },
      }),
    ]);
    return NextResponse.json({
      providers,
      lastSync: latestRecord,
      lastError: "No provider sync has run. Provider endpoint mappings remain unverified.",
      manualSyncAvailable: false,
    });
  } catch (error) {
    console.error("Spotlight provider status failed.", {
      reason: error instanceof Error ? error.name : "status-error",
    });
    return NextResponse.json({ error: "Provider status is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const actor = await requireAdmin(request);
  if ("error" in actor)
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  const providers = await getProviderHealth();
  await prisma.auditLog.create({
    data: {
      actorId: actor.userId,
      action: "spotlight.provider.check",
      targetType: "spotlight-provider",
      targetId: "all",
      metadata: { checked: providers.map((provider) => provider.name) },
    },
  });
  return NextResponse.json({
    providers,
    message: "Provider coverage checked. No event sync was run because endpoint mappings are unverified.",
  });
}
