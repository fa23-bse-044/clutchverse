import { notFound } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, CalendarDays, MessageCircle, Trophy, Users } from "lucide-react";
import { findGame } from "@clutchverse/core";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { teams, topPlayers } from "@/lib/demo-data";
import { TeamInviteForm } from "@/components/team-invite-form";
import { ChatPanel } from "@/components/chat-panel";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = teams.find((item) => item.slug === slug);
  return { title: team?.name ?? "Team profile" };
}

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sample = teams.find((item) => item.slug === slug);
  const session = await auth();
  let team:
    | { id?: string; slug: string; name: string; game: string; members: number; score: string; roster: { handle: string; rating: number; role: string; userId?: string }[]; sample: boolean }
    | undefined;
  if (sample) {
    team = {
      ...sample,
      roster: topPlayers.slice(0, sample.members).map((player, index) => ({
        handle: player.handle,
        rating: player.rating,
        role: index === 0 ? "Captain" : "Starter",
      })),
      sample: true,
    };
  } else {
    try {
      const record = await prisma.team.findUnique({
        where: { slug },
        include: {
          memberships: {
            include: { user: { select: { id: true, name: true, profile: { select: { handle: true } } } } },
          },
        },
      });
      if (record) {
        const rating = await prisma.ranking.findFirst({
          where: { subjectId: record.id, subjectType: "team", period: "season" },
          orderBy: { rating: "desc" },
          select: { rating: true },
        });
        team = {
          id: record.id,
          slug: record.slug,
          name: record.name,
          game: findGame(record.gameSlug)?.name ?? record.gameSlug.toUpperCase(),
          members: record.memberships.length,
          score: rating?.rating.toLocaleString() ?? "UNRANKED",
          roster: record.memberships.map((member) => ({
            userId: member.userId,
            handle: member.user.profile?.handle ?? member.user.name ?? "Player",
            rating: 0,
            role: member.role,
          })),
          sample: false,
        };
      }
    } catch (error) {
      console.error("Team profile lookup failed.", error);
    }
  }
  if (!team) notFound();

  const isMember = Boolean(session?.user?.id && team.roster.some((member) => member.userId === session.user.id));
  const isCaptain = team.roster.some((member) => member.userId === session?.user?.id && ["captain", "owner"].includes(member.role));
  return <section className="section page-top"><div className="container">
    <div className="team-profile-banner panel"><div className="team-emblem team-emblem-xl">{team.name.slice(0, 1)}</div><div><span className="eyebrow">{team.game} / {team.sample ? "COMMUNITY ROSTER" : "ROSTER"}</span><h1 className="page-title">{team.name}</h1><p className="muted">{team.sample ? "South Asia · Competing since Season 02" : `${team.members} active players`}</p></div><Link className="button button-primary" href="/register">Follow team</Link></div>
    {team.sample && <p className="publisher-note">Sample roster profile.</p>}
    <div className="profile-stats"><div><span className="eyebrow">TEAM RATING</span><strong>{team.score}</strong><small>Season leaderboard</small></div><div><span className="eyebrow">ROSTER</span><strong>{team.members}</strong><small>Active players</small></div><div><span className="eyebrow">EVENTS PLAYED</span><strong>{team.sample ? "28" : "—"}</strong><small>Verified results</small></div><div><span className="eyebrow">TOP 3 FINISHES</span><strong>{team.sample ? "12" : "—"}</strong><small><BadgeCheck size={12} /> Verified results</small></div></div>
    <div className="team-profile-grid"><section className="panel profile-section"><div className="detail-section-title"><div><span className="eyebrow">THE SQUAD</span><h2>Team roster</h2></div><span className="tag"><Users size={11} /> {team.members} MEMBERS</span></div>{team.roster.map((player, index) => <div className="roster-row" key={player.handle}><span className={`player-avatar avatar-${index % 5}`}>{player.handle[0]}</span><span><strong>{player.handle}</strong><small>{player.role}</small></span><strong className="leader-rating">{player.rating ? player.rating.toLocaleString() : "—"}</strong></div>)}
      {isCaptain && !team.sample && <TeamInviteForm teamSlug={team.slug} />}
    </section>
      <aside className="team-side"><section className="panel profile-section"><span className="eyebrow">TEAM ACTIVITY</span><div className="team-activity"><Trophy size={16} /><span><strong>{team.sample ? "2nd place" : "No recorded podiums yet"}</strong><small>{team.sample ? "Drop Zone Invitational · Nov 04" : "New results will appear here"}</small></span></div><div className="team-activity"><CalendarDays size={16} /><span><strong>Event schedule</strong><small>View upcoming tournaments in the game hub</small></span></div></section>
      {team.id && isMember && <section className="profile-section"><div className="team-chat-title"><MessageCircle size={16} /><strong>Team room</strong></div><ChatPanel room={`team:${team.slug}`} /></section>}</aside>
    </div>
  </div></section>;
}
