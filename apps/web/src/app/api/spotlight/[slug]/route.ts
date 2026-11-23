import { NextResponse } from "next/server";
import { findSpotlightConfig } from "@/config/spotlight-events";
import { getCachedSpotlightSnapshot, isSpotlightEnabled } from "@/lib/spotlight";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!findSpotlightConfig(slug))
    return NextResponse.json({ error: "Spotlight is unavailable." }, { status: 404 });
  try {
    if (!(await isSpotlightEnabled()))
      return NextResponse.json({ error: "Spotlight is unavailable." }, { status: 404 });
    const event = await getCachedSpotlightSnapshot(slug);
    if (!event)
      return NextResponse.json({ event: null, message: "Data not available yet." });
    return NextResponse.json(
      { event },
      { headers: { "cache-control": "private, max-age=10" } },
    );
  } catch (error) {
    console.error("Spotlight read failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json(
      { error: "Spotlight data is temporarily unavailable." },
      { status: 503 },
    );
  }
}
