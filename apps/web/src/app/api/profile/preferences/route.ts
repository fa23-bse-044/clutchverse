import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { locales, isLocale } from "@/i18n/locales";

export const runtime = "nodejs";

const preferencesSchema = z
  .object({
    theme: z
      .enum([
        "neon-cyber",
        "crimson-war",
        "toxic-venom",
        "arctic-frost",
        "royal-gold",
        "light-pro",
      ])
      .optional(),
    locale: z.enum(locales).optional(),
    performanceMode: z.boolean().optional(),
    backgroundVideo: z.boolean().optional(),
    soundEnabled: z.boolean().optional(),
    customCursor: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined));

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      theme: true,
      locale: true,
      performanceMode: true,
      backgroundVideo: true,
      soundEnabled: true,
      customCursor: true,
    },
  });
  if (!user)
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  return NextResponse.json({ preferences: user });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const input = await request.json().catch(() => null);
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Preference values are invalid." },
      { status: 400 },
    );
  try {
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: parsed.data,
      select: {
        theme: true,
        locale: true,
        performanceMode: true,
        backgroundVideo: true,
        soundEnabled: true,
        customCursor: true,
      },
    });
    const response = NextResponse.json({ preferences: user });
    if (parsed.data.locale && isLocale(parsed.data.locale)) {
      response.cookies.set("clutchverse-locale", parsed.data.locale, {
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return response;
  } catch (error) {
    console.error("Profile preference update failed.", error);
    return NextResponse.json(
      { error: "Unable to update preferences." },
      { status: 503 },
    );
  }
}
