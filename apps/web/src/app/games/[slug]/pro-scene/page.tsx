import { notFound } from "next/navigation";
import { findGame } from "@clutchverse/core";
import { ProSceneExplorer } from "@/components/pro-scene-explorer";
import { databaseProSceneProvider, isGameSlug } from "@/lib/pro-scene-provider";

export const dynamic = "force-dynamic";

export default async function ProScenePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = findGame(slug);
  if (!game || !isGameSlug(slug)) notFound();
  const events = await databaseProSceneProvider.events(slug);
  return (
    <section className="section page-top">
      <div className="container">
        <div className="eyebrow">{game.name} / PRO SCENE</div>
        <ProSceneExplorer
          gameSlug={slug}
          gameName={game.name}
          events={events.map((event) => ({
            ...event,
            startsAt: event.startsAt?.toISOString() ?? null,
            endsAt: event.endsAt?.toISOString() ?? null,
            fetchedAt: event.fetchedAt.toISOString(),
          }))}
        />
      </div>
    </section>
  );
}
