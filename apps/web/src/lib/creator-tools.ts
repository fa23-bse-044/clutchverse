import { randomBytes } from "node:crypto";
import { prisma } from "@clutchverse/db";

export const CREATOR_TOOLS_FLAG = "creator-streamer-tools";

export async function isCreatorToolsEnabled(): Promise<boolean> {
  const flag = await prisma.featureFlag.findUnique({
    where: { key: CREATOR_TOOLS_FLAG },
    select: { enabled: true },
  });
  return flag?.enabled ?? process.env.NODE_ENV !== "production";
}

export function newCreatorToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function ensureCreatorProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      profile: { select: { handle: true } },
      creatorProfile: true,
    },
  });
  if (!user) return null;
  if (user.creatorProfile) return user.creatorProfile;
  const name = user.profile?.handle ?? user.name ?? "Creator";
  const baseSlug =
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) ||
    `creator-${user.id.slice(-8)}`;
  let slug = baseSlug;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.creatorProfile.create({
        data: {
          userId,
          slug,
          displayName: name.slice(0, 80),
        },
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === "PrismaClientKnownRequestError" &&
        "code" in error &&
        error.code === "P2002"
      ) {
        slug = `${baseSlug}-${newCreatorToken().slice(0, 6)}`;
        continue;
      }
      throw error;
    }
  }
  throw new Error("CREATOR_PROFILE_SLUG_COLLISION");
}
