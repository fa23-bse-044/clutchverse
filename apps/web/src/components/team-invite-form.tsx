"use client";

import { useState } from "react";
import { Search, UserPlus } from "lucide-react";

type Player = { userId: string; handle: string; region: string };

export function TeamInviteForm({ teamSlug }: { teamSlug: string }) {
  const [query, setQuery] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [message, setMessage] = useState("");
  const search = async () => {
    setMessage("");
    const response = await fetch(`/api/players?q=${encodeURIComponent(query)}`);
    const result = await response.json() as { players?: Player[]; error?: string };
    if (!response.ok) setMessage(result.error ?? "Player search failed.");
    else setPlayers(result.players ?? []);
  };
  const invite = async (inviteeId: string) => {
    const response = await fetch(`/api/teams/${encodeURIComponent(teamSlug)}/invites`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ inviteeId }),
    });
    const result = await response.json() as { error?: string };
    setMessage(response.ok ? "Invitation sent. The player will see it in notifications." : result.error ?? "Invite failed.");
  };
  return <div className="team-invite"><div className="eyebrow">INVITE A PLAYER</div><div className="team-invite-search"><input value={query} onChange={(event) => setQuery(event.target.value)} minLength={2} placeholder="Search handle" aria-label="Search player handle" /><button className="button" onClick={() => void search()}><Search size={13} /> Search</button></div>
    {players.map((player) => <button className="invite-player" key={player.userId} onClick={() => void invite(player.userId)}><span className="player-avatar">{player.handle[0]}</span><span>{player.handle}<small>{player.region}</small></span><UserPlus size={14} /></button>)}
    {message && <p className="invite-message" role="status">{message}</p>}
  </div>;
}
