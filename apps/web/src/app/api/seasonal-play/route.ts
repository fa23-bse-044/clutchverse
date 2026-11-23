import { NextResponse } from "next/server";
import { getSeasonalPlayDashboard } from "@/lib/seasonal-play";
import { getSeasonalPlayActor } from "@/lib/seasonal-play-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const result = await getSeasonalPlayActor(request);
  if ("error" in result) return result.error;
  try {
    return NextResponse.json(await getSeasonalPlayDashboard(result.actor.userId));
  } catch (error) {
    console.error("Seasonal play dashboard load failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json({ error: "Unable to load seasonal play." }, { status: 503 });
  }
}
