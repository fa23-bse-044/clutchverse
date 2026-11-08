import Link from "next/link";
import type { CSSProperties } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Flame,
  Play,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { games } from "@clutchverse/core";
import { SectionTitle } from "@/components/section-title";
import { TournamentCard } from "@/components/tournament-card";
import { tournaments, topPlayers } from "@/lib/demo-data";
import { LiveCounters } from "@/components/live-counters";
import { ProSceneWidget } from "@/components/pro-scene-widget";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-orb" aria-hidden="true" />
        <div className="container hero-content">
          <div className="hero-copy">
            <div className="eyebrow hero-label">
              <span className="live-dot" /> THE NEXT ROUND STARTS HERE
            </div>
            <h1 className="display">
              PLAY FOR
              <br />
              <span className="hero-accent">THE MOMENT.</span>
            </h1>
            <p className="hero-description">
              Your arena. Your rivals. Your run. Join the community built for
              the plays you&apos;ll talk about forever.
            </p>
            <div className="hero-actions">
              <Link
                className="button button-primary magnetic-button"
                href="/tournaments"
              >
                Find your tournament <ArrowRight size={16} />
              </Link>
              <Link className="button button-quiet" href="#games">
                <Play size={14} /> Explore the games
              </Link>
            </div>
            <LiveCounters />
          </div>
          <div className="hero-feature">
            <div className="hero-feature-art">
              <div className="art-ring" />
              <div className="art-slash" />
              <span className="art-number">01</span>
              <span className="art-mark">CV</span>
              <div className="hero-feature-caption">
                <span className="tag">
                  <span className="live-dot" /> LIVE NOW
                </span>
                <strong>
                  THE DROP ZONE
                  <br />
                  INVITATIONAL
                </strong>
                <span className="muted">PUBG MOBILE · 18.4K WATCHING</span>
              </div>
              <Link
                className="feature-play"
                href="/live"
                aria-label="Watch live broadcasts"
              >
                <Play fill="currentColor" size={18} />
              </Link>
            </div>
          </div>
        </div>
        <div className="hero-bottom container">
          <span className="eyebrow">SCROLL TO ENTER THE VERSE</span>
          <ArrowDown size={16} />
          <span className="hero-coordinate">
            34° 01&apos; N&nbsp; / &nbsp;71° 34&apos; E
          </span>
        </div>
      </section>

      <section className="section" id="games">
        <div className="container">
          <SectionTitle
            label="CHOOSE YOUR ARENA"
            title="Pick your game. Make your name."
            action={{ href: "/games", text: "ALL GAME HUBS" }}
          />
          <div className="game-grid">
            {games.map((game, index) => (
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
                <div className="game-card-meta">
                  <span>
                    <Users size={13} /> {game.players} players
                  </span>
                  <span>
                    <span className="live-dot" /> {game.live} live
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <ProSceneWidget />

      <section className="section section-tinted">
        <div className="container">
          <SectionTitle
            label="THE ARENA IS OPEN"
            title="Your next win is on the line."
            action={{ href: "/tournaments", text: "VIEW ALL EVENTS" }}
          />
          <div className="tournament-grid">
            {tournaments.slice(0, 3).map((tournament) => (
              <TournamentCard key={tournament.slug} tournament={tournament} />
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container split-section">
          <div>
            <div className="eyebrow">THE CLUTCH IS YOURS</div>
            <h2 className="display split-title">
              THE GAME
              <br />
              DOESN&apos;T
              <br />
              <span className="hero-accent">END HERE.</span>
            </h2>
            <p className="muted split-copy">
              Find your squad. Track your climb. Watch the best do it live.
              ClutchVerse brings the whole competitive scene into one place.
            </p>
            <Link href="/community" className="button button-primary">
              Meet your community <ArrowRight size={16} />
            </Link>
          </div>
          <div className="metric-stack">
            <div className="metric-card">
              <span className="metric-icon">
                <Trophy size={18} />
              </span>
              <strong>12,480</strong>
              <span>TOURNAMENTS PLAYED</span>
              <div className="metric-line" />
            </div>
            <div className="metric-card">
              <span className="metric-icon">
                <Flame size={18} />
              </span>
              <strong>84.2K</strong>
              <span>CLUTCH MOMENTS SHARED</span>
              <div className="metric-line" />
            </div>
            <div className="metric-card">
              <span className="metric-icon">
                <Zap size={18} />
              </span>
              <strong>24/7</strong>
              <span>THE ARENA NEVER SLEEPS</span>
              <div className="metric-line" />
            </div>
          </div>
        </div>
      </section>

      <section className="section section-tinted">
        <div className="container">
          <SectionTitle
            label="THE ONES TO WATCH"
            title="The leaderboard doesn't lie."
            action={{ href: "/rankings", text: "FULL RANKINGS" }}
          />
          <div className="leaderboard panel">
            <div className="leaderboard-head">
              <span>RANK</span>
              <span>PLAYER</span>
              <span>GAME</span>
              <span>W / L</span>
              <span>RATING</span>
            </div>
            {topPlayers.slice(0, 5).map((player, index) => (
              <Link
                href={`/players/${player.handle}`}
                className="leader-row"
                key={player.handle}
              >
                <span className={index === 0 ? "rank-first" : "rank-number"}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="player-cell">
                  <span className={`player-avatar avatar-${index}`}>
                    {player.handle.slice(0, 1)}
                  </span>
                  <strong>{player.handle}</strong>
                  <span className="verified">✦</span>
                </span>
                <span className="leader-game">{player.game}</span>
                <span className="leader-record">{player.record}</span>
                <strong className="leader-rating">
                  {player.rating.toLocaleString()}
                </strong>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionTitle
            label="THIS WEEK IN THE VERSE"
            title="The scene moves fast."
            action={{ href: "/news", text: "MORE STORIES" }}
          />
          <div className="news-grid">
            <article className="news-card news-featured">
              <div className="news-art">
                <span>
                  PATCH
                  <br />
                  NOTES
                </span>
              </div>
              <div className="news-body">
                <span className="eyebrow">PUBG MOBILE · 4 MIN READ</span>
                <h3>
                  The new season shifts the meta. Here&apos;s what top squads
                  are changing.
                </h3>
                <span className="muted">6 hours ago</span>
              </div>
            </article>
            <article className="news-card">
              <div className="news-small-art news-red">
                <span>
                  TOURNAMENT
                  <br />
                  RECAP
                </span>
              </div>
              <div className="news-body">
                <span className="eyebrow">TEKKEN 8 · 3 MIN READ</span>
                <h3>
                  One pixel. One perfect read. A grand final for the ages.
                </h3>
                <span className="muted">Yesterday</span>
              </div>
            </article>
            <article className="news-card">
              <div className="news-small-art news-green">
                <span>
                  COMMUNITY
                  <br />
                  SPOTLIGHT
                </span>
              </div>
              <div className="news-body">
                <span className="eyebrow">EA FC · 5 MIN READ</span>
                <h3>From weekend league to the main stage: meet Vex.</h3>
                <span className="muted">2 days ago</span>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="section final-cta">
        <div className="container final-cta-inner">
          <div>
            <div className="eyebrow">YOUR STORY STARTS NOW</div>
            <h2 className="display">
              READY TO
              <br />
              <span className="hero-accent">CLUTCH UP?</span>
            </h2>
          </div>
          <Link className="button button-primary" href="/register">
            Create your free account <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </>
  );
}
