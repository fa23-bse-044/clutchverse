import Link from "next/link";
import { ArrowRight, Plus, Users } from "lucide-react";
import { teams } from "@/lib/demo-data";
import { prisma } from "@clutchverse/db";

export const metadata = { title: "Teams" };
export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  let directory = teams;
  let usingSamples = true;
  try {
    const records = await prisma.team.findMany({
      include: { memberships: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    if (records.length) {
      directory = records.map((team) => ({
        name: team.name,
        slug: team.slug,
        game: team.gameSlug.replaceAll("-", " ").toUpperCase(),
        members: team.memberships.length,
        score: "UNRANKED",
        color: "violet",
      }));
      usingSamples = false;
    }
  } catch (error) {
    console.error("Using sample team directory.", error);
  }
  return <section className="section page-top"><div className="container">
    <div className="eyebrow">NO ONE CLUTCHES ALONE</div><h1 className="page-title">Find your squad.</h1><p className="page-intro">Good chemistry wins close games. Meet teams looking for their next teammate, or build one of your own.</p>
    {usingSamples && <p className="publisher-note">Sample teams are displayed until the database is seeded and online.</p>}
    <div className="teams-toolbar"><div><span className="tag">ALL REGIONS</span><span className="tag">ALL GAMES</span><span className="tag">RECRUITING</span></div><Link className="button button-primary" href="/teams/create"><Plus size={15} /> Create a team</Link></div>
    <div className="team-grid team-grid-large">{directory.map((team, index) => <article className="team-card panel team-card-large" key={team.slug}><div className={`team-emblem ${team.color}`}>{team.name.slice(0, 1)}</div><span className="eyebrow">{team.game}</span><h3>{team.name}</h3><div className="team-card-meta"><span><Users size={14} /> {team.members} players</span><span>{team.score} rating</span></div><div className="team-members"><span>{team.name[0]}R</span><span>{team.name[1]}X</span><span>{team.name[2]}O</span><span>+{Math.max(team.members - 3, 0)}</span></div><span className={`team-recruitment ${usingSamples && index !== 1 ? "recruiting" : ""}`}>{usingSamples && index !== 1 ? "● RECRUITING" : "● OPEN TO INVITES"}</span><Link className="button full-button" href={`/teams/${team.slug}`}>View team <ArrowRight size={14} /></Link></article>)}</div>
  </div></section>;
}
