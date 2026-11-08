import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight, ArrowUpRight, Users } from "lucide-react";
import { games } from "@clutchverse/core";
import { prisma } from "@clutchverse/db";
import { gameRules } from "@/config/game-rules";

export const metadata = { title: "Game hubs" };
export const dynamic = "force-dynamic";

type GameOverviewStats = {
  rankedPlayers: number | null;
  liveStreams: number | null;
  upcomingTournaments: number | null;
  topPlayer: string | null;
};

async function loadStats(slug: string): Promise<GameOverviewStats> {
  try {
    const [rankedPlayers, liveStreams, upcomingTournaments, topRanking] =
      await Promise.all([
        prisma.ranking.count({
          where: { gameSlug: slug, subjectType: "player", period: "season" },
        }),
        prisma.stream.count({ where: { gameSlug: slug, state: "live" } }),
        prisma.tournament.count({
          where: { game: { slug }, state: "UPCOMING" },
        }),
        prisma.ranking.findFirst({
          where: {
            gameSlug: slug,
            subjectType: "player",
            region: "Global",
            period: "season",
          },
          orderBy: [{ points: "desc" }, { rating: "desc" }],
          select: { subjectId: true },
        }),
      ]);
    const profile = topRanking
      ? await prisma.playerProfile.findUnique({
          where: { userId: topRanking.subjectId },
          select: { handle: true },
        })
      : null;
    return {
      rankedPlayers,
      liveStreams,
      upcomingTournaments,
      topPlayer: profile?.handle ?? null,
    };
  } catch (error) {
    console.warn(`Game overview counters unavailable for ${slug}.`, error);
    return {
      rankedPlayers: null,
      liveStreams: null,
      upcomingTournaments: null,
      topPlayer: null,
    };
  }
}

export default async function GamesPage() {
  const stats = await Promise.all(games.map((game) => loadStats(game.slug)));
  return (
    <section className="section page-top">
      <div className="container">
        <div className="eyebrow">FOUR GAMES. ONE VERSE.</div>
        <h1 className="page-title">Choose your arena.</h1>
        <p className="page-intro">
          Compare the formats, platforms, and community activity, then open a
          game hub for its events, rankings, records, and original community
          rules.
        </p>
        <div className="game-grid game-grid-large">
          {games.map((game, index) => {
            const rules = gameRules[game.slug];
            const gameStats = stats[index];
            return (
              <Link
                className="game-card"
                href={`/games/${game.slug}`}
                key={game.slug}
                style={{ "--game-accent": game.accent } as CSSProperties}
              >
                <div className="game-card-index">
                  0{index + 1} <ArrowUpRight size={15} />
                </div>
                <span className="game-category">{game.category}</span>
                <h3>{game.name}</h3>
                <span className="game-tagline">{game.tag}</span>
                <p className="game-card-description">{game.description}</p>
                <div className="game-card-meta">
                  <span>
                    <Users size={13} /> {rules.genre} · {rules.modes.join("/")}
                  </span>
                  <span>
                    {gameStats.rankedPlayers === null
                      ? "Rankings unavailable"
                      : `${gameStats.rankedPlayers.toLocaleString()} ranked players`}
                  </span>
                  <span>
                    <span className="live-dot" />{" "}
                    {gameStats.liveStreams === null
                      ? "Live status unavailable"
                      : `${gameStats.liveStreams} live streams`}
                  </span>
                  <span>
                    {gameStats.upcomingTournaments === null
                      ? "Events unavailable"
                      : `${gameStats.upcomingTournaments} upcoming events`}
                  </span>
                </div>
                <p className="game-card-top-player">
                  Top player: {gameStats.topPlayer ?? "No season ranking yet"}
                </p>
              </Link>
            );
          })}
        </div>

        <section className="game-comparison">
          <div className="section-heading">
            <div>
              <span className="eyebrow">FIND YOUR FORMAT</span>
              <h2>One platform. Different arenas.</h2>
            </div>
          </div>
          <div className="game-comparison-table panel">
            <div className="game-comparison-row game-comparison-head">
              <span>GAME</span>
              <span>PLATFORMS</span>
              <span>FORMATS</span>
              <span>ACTIVE REGIONS</span>
            </div>
            {games.map((game) => {
              const rules = gameRules[game.slug];
              return (
                <Link
                  className="game-comparison-row"
                  href={`/games/${game.slug}`}
                  key={game.slug}
                >
                  <strong
                    style={{ "--game-accent": game.accent } as CSSProperties}
                  >
                    {game.name}
                  </strong>
                  <span>{rules.platforms}</span>
                  <span>
                    {rules.modes.join(" · ")} · Squad size {rules.squadSize}
                  </span>
                  <span>{rules.activeRegions.join(", ")}</span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="how-to-compete">
          <div>
            <span className="eyebrow">YOUR NEXT PLAY</span>
            <h2>How to compete</h2>
          </div>
          <ol className="compete-steps">
            <li>
              <span>01</span>
              <strong>Choose a game</strong>
              <p>
                Review its modes, platform limits, eligibility, and fair-play
                rules.
              </p>
            </li>
            <li>
              <span>02</span>
              <strong>Find an event</strong>
              <p>
                Filter upcoming, live, or completed tournaments by mode and
                region.
              </p>
            </li>
            <li>
              <span>03</span>
              <strong>Register and check in</strong>
              <p>
                Use your game account ID and follow the event&apos;s roster and
                check-in instructions.
              </p>
            </li>
            <li>
              <span>04</span>
              <strong>Play and report</strong>
              <p>
                Submit results with evidence when requested; organizers resolve
                disputes under event rules.
              </p>
            </li>
          </ol>
          <Link className="button button-primary" href="/tournaments">
            Browse tournaments <ArrowRight size={14} />
          </Link>
        </section>
        <div className="publisher-note">
          ClutchVerse is an independent community and tournament platform. Game
          names are used to identify supported communities; no publisher
          endorsement is implied.
        </div>
      </div>
    </section>
  );
}
