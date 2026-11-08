import { PrismaClient } from "@prisma/client";
export { Prisma } from "@prisma/client";

const globalForPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient };
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function canAccessChatRoom(roomSlug: string, userId: string): Promise<boolean> {
  const room = await prisma.chatRoom.findUnique({
    where: { slug: roomSlug },
    include: {
      team: { include: { memberships: { where: { userId }, select: { id: true } } } },
      members: { where: { userId }, select: { id: true } },
    },
  });
  if (!room) return false;
  if (room.type === "global" || room.type === "game") return true;
  if (room.type === "team") return (room.team?.memberships.length ?? 0) > 0;
  return room.type === "dm" && room.members.length > 0;
}
