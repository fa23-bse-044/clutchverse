import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { MyMatchLobbies } from "@/components/my-match-lobbies";
import { isMatchLobbyEnabled } from "@/lib/match-lobby";

export const dynamic = "force-dynamic";
export const metadata = { title: "My match lobbies" };

export default async function MatchLobbiesPage() {
  if (!(await isMatchLobbyEnabled())) notFound();
  const session = await auth();
  if (!session?.user?.id)
    redirect("/login?callbackUrl=/matches");
  const matches = await prisma.match.findMany({
    where: {
      OR: [
        { entrantA: { userId: session.user.id } },
        { entrantB: { userId: session.user.id } },
        {
          entrantA: {
            team: { memberships: { some: { userId: session.user.id } } },
          },
        },
        {
          entrantB: {
            team: { memberships: { some: { userId: session.user.id } } },
          },
        },
        { tournament: { organizerId: session.user.id } },
      ],
    },
    include: {
      tournament: { select: { title: true } },
      entrantA: {
        select: {
          teamName: true,
          user: { select: { name: true } },
          team: { select: { name: true } },
        },
      },
      entrantB: {
        select: {
          teamName: true,
          user: { select: { name: true } },
          team: { select: { name: true } },
        },
      },
    },
    orderBy: [{ startsAt: "desc" }, { round: "desc" }, { position: "asc" }],
    take: 100,
  });
  return (
    <MyMatchLobbies
      matches={matches.map((match) => ({
        id: match.id,
        tournamentTitle: match.tournament.title,
        state: match.state,
        round: match.round,
        position: match.position,
        startsAt: match.startsAt?.toISOString() ?? null,
        entrantA:
          match.entrantA?.teamName ??
          match.entrantA?.user?.name ??
          match.entrantA?.team?.name ??
          null,
        entrantB:
          match.entrantB?.teamName ??
          match.entrantB?.user?.name ??
          match.entrantB?.team?.name ??
          null,
      }))}
    />
  );
}
