import { SignJWT } from "jose";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true, name: true } });
  if (!user) return NextResponse.json({ error: "Account is unavailable." }, { status: 401 });
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) {
    return NextResponse.json({ error: "Realtime authentication is not configured." }, { status: 503 });
  }
  const token = await new SignJWT({
    name: user.name ?? "Player",
    role: user.role.toLowerCase(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.user.id)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(secret));
  return NextResponse.json({ token });
}
