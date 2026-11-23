import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkRateLimit, getRequestAddress } from "@/lib/rate-limit";
import { isSeasonalPlayEnabled } from "@/lib/seasonal-play";

export async function getSeasonalPlayActor(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) } as const;
  }
  if (!(await isSeasonalPlayEnabled())) {
    return { error: NextResponse.json({ error: "Seasonal play is unavailable." }, { status: 404 }) } as const;
  }
  const limit = await checkRateLimit(
    `seasonal-play:${session.user.id}:${getRequestAddress(request)}`,
    30,
    60_000,
  );
  if (!limit.allowed) {
    return { error: NextResponse.json({ error: "Too many seasonal-play requests." }, { status: 429 }) } as const;
  }
  return { actor: { userId: session.user.id } } as const;
}
