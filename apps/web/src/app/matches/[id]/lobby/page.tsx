import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { MatchLobby } from "@/components/match-lobby";
import { getMatchLobbyActor, isMatchLobbyEnabled } from "@/lib/match-lobby";

export const dynamic = "force-dynamic";
export const metadata = { title: "Match lobby" };

export default async function MatchLobbyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isMatchLobbyEnabled())) notFound();
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id)
    redirect(`/login?callbackUrl=${encodeURIComponent(`/matches/${id}/lobby`)}`);
  const actor = await getMatchLobbyActor(id, session.user.id);
  if (!actor?.canView) notFound();
  return <MatchLobby matchId={id} />;
}
