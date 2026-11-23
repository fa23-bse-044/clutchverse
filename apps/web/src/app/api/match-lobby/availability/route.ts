import { NextResponse } from "next/server";
import { checkRateLimit, getRequestAddress } from "@/lib/rate-limit";
import { isMatchLobbyEnabled } from "@/lib/match-lobby";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limit = await checkRateLimit(
    `match-lobby-availability:${getRequestAddress(request)}`,
    60,
    60_000,
  );
  if (!limit.allowed)
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  return NextResponse.json({ enabled: await isMatchLobbyEnabled() });
}
