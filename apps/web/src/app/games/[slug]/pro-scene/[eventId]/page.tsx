import { notFound } from "next/navigation";
import Link from "next/link";
import { findGame } from "@clutchverse/core";
import { databaseProSceneProvider, isGameSlug } from "@/lib/pro-scene-provider";
import { ProSceneEventDetails } from "@/components/pro-scene-event-details";

export const dynamic = "force-dynamic";

export default async function ProSceneEventPage({
  params,
}: {
  params: Promise<{ slug: string; eventId: string }>;
}) {
  const { slug, eventId } = await params;
  const game = findGame(slug);
  if (!game || !isGameSlug(slug)) notFound();
  const event = await databaseProSceneProvider.eventDetail(eventId);
  if (!event || event.gameSlug !== slug) notFound();
  const data = event as typeof event & {
    teams: Array<{ team: { id: string; name: string; sourceUrl: string } }>;
    standings: Array<{
      id: string;
      rank: number | null;
      points: number | null;
      team: { id: string; name: string } | null;
      player: { id: string; name: string } | null;
      sourceUrl: string;
    }>;
    results: Array<{
      id: string;
      placement: number | null;
      title: string | null;
      resultDate: Date | null;
      team: { id: string; name: string } | null;
      player: { id: string; name: string } | null;
      sourceUrl: string;
    }>;
  };
  return <section className="section page-top"><div className="container">
    <Link href={`/games/${slug}/pro-scene`}>{game.name} / Pro Scene</Link>
    <ProSceneEventDetails event={{
      ...event,
      fetchedAt: event.fetchedAt.toISOString(),
      standings: data.standings.map((standing) => ({
        ...standing,
        team: standing.team ? { id: standing.team.id, name: standing.team.name } : null,
        player: standing.player ? { id: standing.player.id, name: standing.player.name } : null,
      })),
      teams: data.teams.map(({ team }) => ({
        id: team.id,
        name: team.name,
        sourceUrl: team.sourceUrl,
      })),
      results: data.results.map((result) => ({
        ...result,
        resultDate: result.resultDate?.toISOString() ?? null,
        team: result.team ? { id: result.team.id, name: result.team.name } : null,
        player: result.player ? { id: result.player.id, name: result.player.name } : null,
      })),
    }} />
  </div></section>;
}
