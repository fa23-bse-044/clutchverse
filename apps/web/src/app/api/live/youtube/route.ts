import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchYoutubeLiveGroup } from "@/lib/youtube-live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const gameSchema = z.enum(["pubg-mobile", "free-fire", "tekken-8", "fifa"]);
const languageSchema = z.enum(["en", "ur", "ar", "zh", "hi", "es"]);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const gameResult = gameSchema.safeParse(params.get("game"));
  const languageResult = languageSchema.safeParse(params.get("language") ?? "en");
  if (!gameResult.success || !languageResult.success) {
    return NextResponse.json(
      { error: "Select a supported game and language." },
      { status: 400 },
    );
  }
  const result = await fetchYoutubeLiveGroup(gameResult.data, languageResult.data);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
