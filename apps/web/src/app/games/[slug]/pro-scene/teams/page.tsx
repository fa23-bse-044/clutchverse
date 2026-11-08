import { notFound } from "next/navigation";
import { findGame } from "@clutchverse/core";
import { ProSceneDirectory } from "@/components/pro-scene-directory";
import { isGameSlug } from "@/lib/pro-scene-provider";
import { prisma } from "@clutchverse/db";

export const dynamic = "force-dynamic";

export default async function ProSceneTeamsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = findGame(slug);
  if (!game || !isGameSlug(slug)) notFound();
  const teams = await prisma.proSceneTeam.findMany({
    where: { gameSlug: slug },
    orderBy: { name: "asc" },
  });
  return <section className="section page-top"><div className="container">
    <ProSceneDirectory gameSlug={slug} kind="teams" entries={teams} />
  </div></section>;
}
