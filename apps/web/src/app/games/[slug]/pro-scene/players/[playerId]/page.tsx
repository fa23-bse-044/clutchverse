import { notFound } from "next/navigation";
import { findGame } from "@clutchverse/core";
import { ProSceneProfile } from "@/components/pro-scene-directory";
import { isGameSlug } from "@/lib/pro-scene-provider";
import { prisma } from "@clutchverse/db";

export const dynamic = "force-dynamic";

export default async function ProScenePlayerPage({
  params,
}: {
  params: Promise<{ slug: string; playerId: string }>;
}) {
  const { slug, playerId } = await params;
  if (!findGame(slug) || !isGameSlug(slug)) notFound();
  const player = await prisma.proScenePlayer.findFirst({
    where: { id: playerId, gameSlug: slug },
    include: {
      team: { select: { id: true, name: true } },
      results: {
        include: { event: true },
        orderBy: { resultDate: "desc" },
      },
    },
  });
  if (!player) notFound();
  return <section className="section page-top"><div className="container">
    <ProSceneProfile
      title={player.name}
      region={player.region}
      sourceName={player.sourceName}
      sourceUrl={player.sourceUrl}
      license={player.license}
      groupTitleKey="recentResults"
      entries={player.results.map((result) => ({
        name: result.event.name,
        detail: result.title ?? `${result.placement ?? "—"} place`,
        sourceUrl: result.sourceUrl,
      }))}
      team={player.team ? { ...player.team, gameSlug: slug } : null}
    />
  </div></section>;
}
