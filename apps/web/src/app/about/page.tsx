import { ShieldCheck, Trophy, Users } from "lucide-react";

export const metadata = { title: "About ClutchVerse" };

export default function AboutPage() {
  return <section className="section page-top"><div className="container narrow-page">
    <div className="eyebrow">INDEPENDENT BY DESIGN</div><h1 className="page-title">Made for the moment.</h1><p className="page-intro">ClutchVerse is a community platform for competitive players: a place to find a bracket, follow a leaderboard, discover a team, and share the plays that make the game.</p>
    <div className="about-pillars"><article className="panel"><Trophy size={20} /><h2>Competition</h2><p>Clear tournament formats and verified match results make every run count.</p></article><article className="panel"><Users size={20} /><h2>Community</h2><p>Players, teams, organizers, and fans share the same arena.</p></article><article className="panel"><ShieldCheck size={20} /><h2>Fair play</h2><p>Respect, transparent rules, and thoughtful moderation are part of the game.</p></article></div>
    <p className="publisher-note">ClutchVerse is an independent community and tournament site. It is not affiliated with or endorsed by Krafton, Garena, Bandai Namco, Electronic Arts, or any game publisher.</p>
  </div></section>;
}
