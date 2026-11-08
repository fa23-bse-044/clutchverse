import argon2 from "argon2";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma, prisma } from "@clutchverse/db";

export const runtime = "nodejs";

const registrationSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(12).max(128),
  handle: z.string().trim().min(3).max(20).regex(/^[a-zA-Z0-9_]{3,20}$/),
});

const attempts = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const address = forwarded?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const rate = attempts.get(address);
  if (rate && rate.resetAt > now && rate.count >= 5) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
  }
  attempts.set(address, rate && rate.resetAt > now
    ? { count: rate.count + 1, resetAt: rate.resetAt }
    : { count: 1, resetAt: now + 60_000 });

  const input = await request.json().catch(() => null);
  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json({ error: "Provide a valid email, a 12-character password, and a 3–20 character handle." }, { status: 400 });
  }

  const passwordHash = await argon2.hash(parsed.data.password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  try {
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email.toLowerCase(),
        passwordHash,
        name: parsed.data.handle,
        role: "PLAYER",
        profile: { create: { handle: parsed.data.handle } },
      },
      select: { id: true },
    });
    return NextResponse.json({ userId: user.id }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "That email or player handle is already registered." }, { status: 409 });
    }
    console.error("Registration failed.", error);
    return NextResponse.json({ error: "Account registration is unavailable. Check database configuration." }, { status: 503 });
  }
}
