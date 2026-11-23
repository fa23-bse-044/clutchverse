import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { checkRateLimit, getRequestAddress } from "@/lib/rate-limit";
import { isCreatorToolsEnabled } from "@/lib/creator-tools";

type CreatorActor = { userId: string };

export async function getCreatorActor(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ error: "Sign in required." }, { status: 401 }),
    } as const;
  }
  if (!(await isCreatorToolsEnabled())) {
    return {
      error: NextResponse.json({ error: "Creator tools are unavailable." }, { status: 404 }),
    } as const;
  }
  const limit = await checkRateLimit(
    `creator-tools:${session.user.id}:${getRequestAddress(request)}`,
    30,
    60_000,
  );
  if (!limit.allowed) {
    return {
      error: NextResponse.json({ error: "Too many creator-tool requests." }, { status: 429 }),
    } as const;
  }
  return { actor: { userId: session.user.id } satisfies CreatorActor } as const;
}
