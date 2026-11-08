import { NextResponse } from "next/server";
import { isGameSlug, databaseProSceneProvider } from "@/lib/pro-scene-provider";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!isGameSlug(slug)) {
    return NextResponse.json({ error: "Unknown game." }, { status: 404 });
  }
  try {
    const events = await databaseProSceneProvider.events(slug);
    return NextResponse.json({
      events,
      source: "ClutchVerse admin-managed records",
      updatedAt: new Date().toISOString(),
      attribution:
        "Each record carries its own source URL, license, and fetched-at timestamp.",
    });
  } catch (error) {
    console.error("Pro Scene event lookup failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json(
      { error: "Pro Scene records are temporarily unavailable." },
      { status: 503 },
    );
  }
}
