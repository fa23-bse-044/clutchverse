"use client";

import Link from "next/link";
import { useLocale } from "@/i18n/locale-context";

type MatchListItem = {
  id: string;
  tournamentTitle: string;
  state: string;
  round: number;
  position: number;
  startsAt: string | null;
  entrantA: string | null;
  entrantB: string | null;
};

export function MyMatchLobbies({ matches }: { matches: MatchListItem[] }) {
  const { messages, locale } = useLocale();
  const copy = messages.matchLobby;
  return (
    <section className="section page-top">
      <div className="container">
        <div className="eyebrow">{copy.myMatches}</div>
        <h1 className="page-title">{copy.myMatches}.</h1>
        {matches.length ? (
          <div className="admin-quick-links">
            {matches.map((match) => (
              <Link
                className="panel"
                href={`/matches/${encodeURIComponent(match.id)}/lobby`}
                key={match.id}
              >
                <span>
                  <strong>{match.tournamentTitle}</strong>
                  <small>
                    {match.entrantA ?? "—"} vs {match.entrantB ?? "—"} ·{" "}
                    {copy.round} {match.round} · {copy.position} {match.position}
                    {match.startsAt
                      ? ` · ${copy.scheduledAt}: ${new Date(match.startsAt).toLocaleString(locale)}`
                      : ""}
                  </small>
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="page-intro">{copy.noMatches}</p>
        )}
      </div>
    </section>
  );
}
