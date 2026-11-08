import { notFound } from "next/navigation";
import { findGame } from "@clutchverse/core";
import { ProSceneProfile } from "@/components/pro-scene-directory";
import { isGameSlug } from "@/lib/pro-scene-provider";
import { prisma } from "@clutchverse/db";

export const dynamic = "force-dynamic";

export default async function ProSceneTeamPage({
  params,
}: {
  params: Promise<{ slug: string; teamId: string }>;
}) {
  const { slug, teamId } = await params;
  if (!findGame(slug) || !isGameSlug(slug)) notFound();
  const team = await prisma.proSceneTeam.findFirst({
    where: { id: teamId, gameSlug: slug },
    include: {
      players: { orderBy: { name: "asc" } },
      results: {
        include: { event: true },
        orderBy: { resultDate: "desc" },
      },
    },
  });
  if (!team) notFound();
  const winCounts = new Map<string, { count: number; sourceUrl: string }>();
  for (const result of team.results) {
    if (result.placement !== 1) continue;
    const current = winCounts.get(result.event.name) ?? {
      count: 0,
      sourceUrl: result.sourceUrl,
    };
    current.count += 1;
    winCounts.set(result.event.name, current);
  }
  return <section className="section page-top"><div className="container">
    <ProSceneProfile
      title={team.name}
      region={team.region}
      sourceName={team.sourceName}
      sourceUrl={team.sourceUrl}
      license={team.license}
      groupTitleKey="roster"
      entries={team.players.map((player) => ({
        name: player.name,
        detail: player.role ?? "Player",
        sourceUrl: player.sourceUrl,
      }))}
      wins={[...winCounts.entries()].map(([eventName, win]) => ({
        eventName,
        count: win.count,
        sourceUrl: win.sourceUrl,
      }))}
      history={team.results.map((result) => ({
        name: result.event.name,
        detail: result.title ?? `${result.placement ?? "—"} place`,
        sourceUrl: result.sourceUrl,
      }))}
    />
  </div></section>;
}
