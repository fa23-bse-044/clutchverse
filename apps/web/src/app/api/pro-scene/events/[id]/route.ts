import { NextResponse } from "next/server";
import { databaseProSceneProvider } from "@/lib/pro-scene-provider";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const event = await databaseProSceneProvider.eventDetail(id);
    return event
      ? NextResponse.json({ event })
      : NextResponse.json({ error: "Pro Scene event not found." }, { status: 404 });
  } catch (error) {
    console.error("Pro Scene event detail lookup failed.", {
      reason: error instanceof Error ? error.name : "database-error",
    });
    return NextResponse.json(
      { error: "Pro Scene event details are temporarily unavailable." },
      { status: 503 },
    );
  }
}
