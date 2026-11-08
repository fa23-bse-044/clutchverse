"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import {
  ArrowRight,
  Bell,
  MessageCircle,
  Play,
  Users,
  Video,
} from "lucide-react";
import type { Game } from "@clutchverse/core";
import type { Tournament, teams as demoTeams } from "@/lib/demo-data";
import { TournamentCard } from "./tournament-card";
import { ChatPanel } from "./chat-panel";
import { GameBackground } from "./game-background";
import { gameMedia } from "@/config/games";
import { gameRules } from "@/config/game-rules";
import { GameRankings } from "./game-rankings";
import { useLocale } from "@/i18n/locale-context";
import {
  applyVisualPreferences,
  readVisualPreferences,
  saveVisualPreferences,
} from "@/lib/visual-preferences";

const tabs = [
  "Overview",
  "Tournaments",
  "Leaderboard",
  "Records",
  "Rules",
  "FAQ",
  "Live",
  "Teams",
  "Players",
  "Clips",
  "News",
  "Chat",
  "Guides",
] as const;
type Tab = (typeof tabs)[number];

type HubPlayer = {
  handle: string;
  game: string;
  record: string;
  rating: number;
  region: string;
  winRate: string;
};
type HubTeam = (typeof demoTeams)[number];
type HubRecord = {
  id: string;
  title: string;
  holder: string;
  value: string;
  achievedAt: string;
  proofUrl: string | null;
};

export function GameHub({
  game,
  events,
  players,
  teams,
  records,
  liveStreams,
  playerCount,
  liveCount,
}: {
  game: Game;
  events: Tournament[];
  players: HubPlayer[];
  teams: HubTeam[];
  records: HubRecord[];
  liveStreams: { id: string; title: string; provider: string }[];
  playerCount: number;
  liveCount: number;
}) {
  const { messages } = useLocale();
  const [tab, setTab] = useState<Tab>("Overview");
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [eventState, setEventState] = useState("all");
  const [eventRegion, setEventRegion] = useState("all");
  const [eventMode, setEventMode] = useState("all");
  useEffect(() => {
    const sync = () => setVideoEnabled(readVisualPreferences().backgroundVideo);
    sync();
    window.addEventListener("clutchverse:preferences", sync);
    return () => window.removeEventListener("clutchverse:preferences", sync);
  }, []);
  const gameEvents = events;
  const gameInfo = gameRules[game.slug];
  const eventRegions = [...new Set(gameEvents.map(({ region }) => region))];
  const filteredEvents = gameEvents.filter((event) => {
    const stateMatches = eventState === "all" || event.state === eventState;
    const regionMatches = eventRegion === "all" || event.region === eventRegion;
    const modeMatches =
      eventMode === "all" ||
      (event.mode ?? event.format).toLowerCase().includes(eventMode);
    return stateMatches && regionMatches && modeMatches;
  });
  const accent = { "--game-accent": game.accent } as CSSProperties;
  const media = gameMedia[game.slug];

  return (
    <div className="game-hub" style={accent}>
      <section
        className="game-hub-hero"
        style={{
          backgroundImage: `linear-gradient(90deg,rgba(8,9,16,.97),rgba(8,9,16,.68) 58%,rgba(8,9,16,.42)),linear-gradient(0deg,var(--background),transparent 40%),radial-gradient(ellipse at 75% 38%,${game.color}77,transparent 50%)`,
        }}
      >
        <GameBackground
          poster={media.poster}
          webm={media.webm}
          mp4={media.mp4}
          enabled={videoEnabled}
        />
        <div className="container game-hub-inner">
          <div className="eyebrow">
            <span className="game-accent-dot" /> {game.category} / CLUTCHVERSE
            GAME HUB
          </div>
          <div className="game-hub-title">{game.name}</div>
          <p className="game-hub-tagline">{game.tag}</p>
          <p className="game-hub-description">{game.description}</p>
          <div className="game-hub-actions">
            <Link href="/tournaments" className="button button-primary">
              Find a tournament <ArrowRight size={15} />
            </Link>
            <Link href="/rankings" className="button">
              <Users size={15} /> View rankings
            </Link>
            <Link href={`/games/${game.slug}/pro-scene`} className="button">
              {messages.proScene.title} <ArrowRight size={15} />
            </Link>
            <button
              className="button button-quiet"
              aria-pressed={videoEnabled}
              onClick={() => {
                const next = !videoEnabled;
                setVideoEnabled(next);
                applyVisualPreferences({ backgroundVideo: next });
                void saveVisualPreferences({ backgroundVideo: next });
              }}
            >
              <Video size={15} /> Background video:{" "}
              {videoEnabled ? "On" : "Off"}
            </button>
          </div>
          {videoEnabled && (
            <p className="video-note">
              Video starts only if licensed media files are installed. Without
              them, the original poster remains visible.
            </p>
          )}
          <div className="game-hub-stats">
            <div>
              <strong>{playerCount.toLocaleString()}</strong>
              <span>PLAYERS</span>
            </div>
            <div>
              <strong>{liveCount.toLocaleString()}</strong>
              <span>LIVE EVENTS</span>
            </div>
            <div>
              <strong>
                {
                  gameEvents.filter((event) => event.state !== "COMPLETED")
                    .length
                }
              </strong>
              <span>OPEN EVENTS</span>
            </div>
          </div>
        </div>
      </section>
      <div className="hub-tabs-wrap">
        <div
          className="container hub-tabs"
          role="tablist"
          aria-label={`${game.name} hub sections`}
        >
          {tabs.map((item) => (
            <button
              key={item}
              role="tab"
              aria-selected={tab === item}
              className={tab === item ? "hub-tab hub-tab-active" : "hub-tab"}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <section className="section hub-content">
        <div className="container">
          {tab === "Overview" && (
            <>
              <div className="hub-overview-grid">
                <div className="hub-highlight panel">
                  <span className="eyebrow">THE COMMUNITY IS LIVE</span>
                  <h2>
                    Make this your
                    <br />
                    next big moment.
                  </h2>
                  <p className="muted">
                    Tournaments, rivals, and a place to share your run. It all
                    starts in this hub.
                  </p>
                  <button
                    className="button button-primary"
                    onClick={() => setTab("Tournaments")}
                  >
                    Enter the arena <ArrowRight size={14} />
                  </button>
                </div>
                <div className="hub-quick-links panel">
                  {(
                    ["Tournaments", "Leaderboard", "Live", "Teams"] as const
                  ).map((item) => (
                    <button key={item} onClick={() => setTab(item)}>
                      <span>{item}</span>
                      <ArrowRight size={15} />
                    </button>
                  ))}
                </div>
              </div>
              <HubEvents items={gameEvents.slice(0, 2)} />
              <HubPlayers players={players} />
              <div className="game-facts panel">
                <span>
                  <strong>GENRE</strong>
                  {gameInfo.genre}
                </span>
                <span>
                  <strong>PLATFORMS</strong>
                  {gameInfo.platforms}
                </span>
                <span>
                  <strong>COMPETITIVE MODES</strong>
                  {gameInfo.modes.join(" · ")}
                </span>
                <span>
                  <strong>ACTIVE REGIONS</strong>
                  {gameInfo.activeRegions.join(" · ")}
                </span>
              </div>
            </>
          )}
          {tab === "Tournaments" && (
            <>
              <HubHeading
                title="Events for this game"
                note="Filter upcoming, live, and completed community events."
              />
              <div className="game-event-filters panel">
                <label>
                  EVENT STATUS
                  <select
                    value={eventState}
                    onChange={(event) => setEventState(event.target.value)}
                  >
                    <option value="all">All events</option>
                    <option value="UPCOMING">Upcoming</option>
                    <option value="LIVE">Live</option>
                    <option value="COMPLETED">Past</option>
                  </select>
                </label>
                <label>
                  REGION
                  <select
                    value={eventRegion}
                    onChange={(event) => setEventRegion(event.target.value)}
                  >
                    <option value="all">All regions</option>
                    {eventRegions.map((region) => (
                      <option key={region}>{region}</option>
                    ))}
                  </select>
                </label>
                <label>
                  MODE
                  <select
                    value={eventMode}
                    onChange={(event) => setEventMode(event.target.value)}
                  >
                    <option value="all">All modes</option>
                    {gameInfo.modes.map((mode) => (
                      <option key={mode} value={mode.toLowerCase()}>
                        {mode}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="tournament-grid">
                {filteredEvents.map((event) => (
                  <TournamentCard key={event.slug} tournament={event} />
                ))}
              </div>
              {!filteredEvents.length && (
                <div className="empty-panel panel">
                  No tournaments match these filters.
                </div>
              )}
            </>
          )}
          {tab === "Leaderboard" && (
            <>
              <HubHeading
                title="Live game rankings"
                note="Player and team standings by period and region."
              />
              <GameRankings gameSlug={game.slug} />
            </>
          )}
          {tab === "Records" && (
            <>
              <HubHeading
                title="Community records"
                note="Community-verified achievements, not official publisher records."
              />
              {records.length ? (
                <div className="game-record-grid">
                  {records.map((record) => (
                    <article className="game-record-card panel" key={record.id}>
                      <span className="tag">COMMUNITY-VERIFIED</span>
                      <h3>{record.title}</h3>
                      <strong>{record.value}</strong>
                      <p className="muted">Holder: {record.holder}</p>
                      <time dateTime={record.achievedAt}>
                        {new Date(record.achievedAt).toLocaleDateString()}
                      </time>
                      {record.proofUrl && (
                        <a
                          className="text-link"
                          href={record.proofUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          VIEW SUBMITTED PROOF <ArrowRight size={13} />
                        </a>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-panel panel">
                  No community-verified records have been submitted for this
                  game yet.
                </div>
              )}
            </>
          )}
          {tab === "Rules" && (
            <>
              <HubHeading
                title={`${game.shortName} rules & eligibility`}
                note="Original ClutchVerse community event rules. Each event may publish additional requirements."
              />
              <div className="game-rules-list">
                {[
                  ["Eligibility", gameInfo.eligibility],
                  [
                    "Registration size",
                    `Supported modes: ${gameInfo.modes.join(", ")}. Maximum roster size: ${gameInfo.squadSize}.`,
                  ],
                  ["Platforms & devices", gameInfo.deviceRules],
                  ["Fair play", gameInfo.fairPlay],
                  ["Anti-cheat review", gameInfo.antiCheat],
                  ["Scoring", gameInfo.scoring],
                  ["Dispute process", gameInfo.disputes],
                  ["Prize rules", gameInfo.prizes],
                ].map(([title, detail]) => (
                  <details className="game-rule panel" key={title}>
                    <summary>{title}</summary>
                    <p>{detail}</p>
                  </details>
                ))}
                <p className="publisher-note">
                  Event eligibility may include a minimum age of 13 or the
                  higher age required by local law. Always review the
                  event-specific rules before registering.
                </p>
              </div>
            </>
          )}
          {tab === "FAQ" && (
            <>
              <HubHeading
                title={`${game.shortName} FAQ`}
                note="Common questions about entering community events."
              />
              <div className="game-rules-list">
                {gameInfo.faqs.map(({ question, answer }) => (
                  <details className="game-rule panel" key={question}>
                    <summary>{question}</summary>
                    <p>{answer}</p>
                  </details>
                ))}
              </div>
            </>
          )}
          {tab === "Live" && (
            <>
              <HubHeading
                title="Live broadcasts"
                note="Community broadcasts currently listed for this game."
              />
              {liveStreams.length ? (
                <div className="stream-grid">
                  {liveStreams.map((stream) => (
                    <Link
                      className="stream-card panel"
                      href="/live"
                      key={stream.id}
                    >
                      <div className="stream-art">
                        <span className="status-pill status-live">
                          <i className="live-dot" /> LIVE
                        </span>
                      </div>
                      <div className="stream-info">
                        <strong>{stream.title}</strong>
                        <span className="muted">{stream.provider}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="empty-panel panel">
                  No live broadcasts are listed for this game right now.
                </div>
              )}
            </>
          )}
          {tab === "Teams" && (
            <>
              <HubHeading
                title="Teams to watch"
                note="Find your squad and compete together."
              />
              <div className="team-grid">
                {teams.map((team) => (
                  <div className="team-card panel" key={team.slug}>
                    <div className={`team-emblem ${team.color}`}>
                      {team.name.slice(0, 1)}
                    </div>
                    <span className="eyebrow">{team.game}</span>
                    <h3>{team.name}</h3>
                    <span className="muted">
                      <Users size={13} /> {team.members} players
                    </span>
                    <Link className="text-link" href={`/teams/${team.slug}`}>
                      TEAM PROFILE <ArrowRight size={13} />
                    </Link>
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === "Players" && (
            <>
              <HubHeading
                title="Players in the spotlight"
                note="The names making noise in this game."
              />
              <HubPlayers players={players} />
            </>
          )}
          {tab === "Clips" && (
            <>
              <HubHeading
                title="Clutch moments"
                note="Community highlights, voted up by players."
              />
              <div className="clip-grid">
                {[
                  "The 1 HP comeback",
                  "Perfect rotation, perfect timing",
                  "Read like a book",
                ].map((clip, index) => (
                  <article className="clip-card panel" key={clip}>
                    <div className={`clip-art clip-art-${index}`}>
                      <Play fill="currentColor" size={21} />
                    </div>
                    <strong>{clip}</strong>
                    <span className="muted">
                      Community highlight · {132 - index * 27} votes
                    </span>
                  </article>
                ))}
              </div>
            </>
          )}
          {tab === "News" && (
            <>
              <HubHeading
                title="Latest from the scene"
                note="Updates, recaps, and stories from the community."
              />
              <div className="news-grid">
                <article className="news-card panel">
                  <div className="news-small-art">
                    <span>
                      SEASON
                      <br />
                      UPDATE
                    </span>
                  </div>
                  <div className="news-body">
                    <span className="eyebrow">
                      {game.shortName} · COMMUNITY
                    </span>
                    <h3>
                      New season. New rivalries. The race for the top starts
                      now.
                    </h3>
                    <span className="muted">Today · 4 min read</span>
                  </div>
                </article>
              </div>
            </>
          )}
          {tab === "Chat" && (
            <>
              <HubHeading
                title={`${game.shortName} community chat`}
                note="Keep it competitive. Respect the community."
              />
              <div className="chat-layout">
                <ChatPanel room={`game:${game.slug}`} />
                <aside className="chat-guidelines panel">
                  <MessageCircle size={19} />
                  <h3>Play fair. Talk fair.</h3>
                  <p className="muted">
                    Messages are rate-limited and community guidelines apply.
                    Moderators can remove content and restrict accounts.
                  </p>
                  <Link className="text-link" href="/fair-play">
                    COMMUNITY GUIDELINES <ArrowRight size={13} />
                  </Link>
                </aside>
              </div>
            </>
          )}
          {tab === "Guides" && (
            <>
              <HubHeading
                title="Learn the game"
                note="Community-built guides to help you level up."
              />
              <div className="guide-grid">
                {[
                  [
                    "Competitive basics",
                    "A first look at the competitive format and scoring.",
                  ],
                  [
                    "Build your game plan",
                    "Practice habits and preparation for tournament day.",
                  ],
                  [
                    "Fair-play standards",
                    "Rules, reporting, and what to expect from events.",
                  ],
                ].map(([title, description]) => (
                  <article className="guide-card panel" key={title}>
                    <span className="eyebrow">FIELD GUIDE</span>
                    <h3>{title}</h3>
                    <p className="muted">{description}</p>
                    <Link href="/fair-play" className="text-link">
                      READ THE GUIDE <ArrowRight size={13} />
                    </Link>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function HubHeading({ title, note }: { title: string; note: string }) {
  return (
    <div className="hub-heading">
      <div>
        <h2>{title}</h2>
        <p className="muted">{note}</p>
      </div>
      <Bell size={18} />
    </div>
  );
}

function HubEvents({ items }: { items: Tournament[] }) {
  return (
    <div className="hub-subsection">
      <HubHeading title="In the arena" note="Events worth watching." />
      {items.length ? (
        <div className="tournament-grid">
          {items.map((event) => (
            <TournamentCard key={event.slug} tournament={event} />
          ))}
        </div>
      ) : (
        <div className="empty-panel panel">
          No tournaments are published for this game yet.
        </div>
      )}
    </div>
  );
}

function HubPlayers({ players }: { players: HubPlayer[] }) {
  return (
    <div className="hub-subsection">
      <div className="hub-heading">
        <div>
          <h2>Players on the rise</h2>
          <p className="muted">Top rated competitors in this game.</p>
        </div>
        <Link className="text-link" href="/rankings">
          ALL RANKINGS <ArrowRight size={13} />
        </Link>
      </div>
      {players.length ? (
        <div className="hub-player-list panel">
          {players.slice(0, 5).map((player, index) => (
            <div className="leader-row" key={player.handle}>
              <span className="rank-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="player-cell">
                <span className={`player-avatar avatar-${index}`}>
                  {player.handle.slice(0, 1)}
                </span>
                <strong>{player.handle}</strong>
              </span>
              <span className="leader-record">
                {player.record} · {player.region} · {player.winRate}
              </span>
              <strong className="leader-rating">
                {player.rating.toLocaleString()}
              </strong>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-panel panel">
          No ranked players yet. Take part in an event to start the ladder.
        </div>
      )}
    </div>
  );
}
