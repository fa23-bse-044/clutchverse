import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkRateLimit, getRequestAddress } from "@/lib/rate-limit";
import { getPlayerAnalytics, isPlayerAnalyticsEnabled } from "@/lib/analytics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!(await isPlayerAnalyticsEnabled()))
    return NextResponse.json({ error: "Analytics are unavailable." }, { status: 404 });
  const limit = await checkRateLimit(
    `analytics:read:${session.user.id}:${getRequestAddress(request)}`,
    30,
    60_000,
  );
  if (!limit.allowed)
    return NextResponse.json({ error: "Too many analytics requests." }, { status: 429 });
  try {
    return NextResponse.json(await getPlayerAnalytics(session.user.id));
  } catch (error) {
    console.error("Player analytics load failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json({ error: "Unable to load analytics." }, { status: 503 });
  }
}
