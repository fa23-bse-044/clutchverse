import { AlertTriangle, HeartHandshake, ShieldCheck } from "lucide-react";

export const metadata = { title: "Fair play & community standards" };

export default function FairPlayPage() {
  return <section className="section page-top"><div className="container narrow-page">
    <div className="eyebrow">COMPETE HARD. RESPECT EVERYONE.</div><h1 className="page-title">The fair-play code.</h1><p className="page-intro">We want close games, big rivalries, and a community where every player can take part without harassment or cheating.</p>
    <div className="fair-play-list"><article className="panel"><HeartHandshake size={19} /><div><h2>Respect your opponents</h2><p>Keep conversation about the game. Harassment, threats, discrimination, doxxing, and targeted abuse are not allowed.</p></div></article><article className="panel"><ShieldCheck size={19} /><div><h2>Play by the rules</h2><p>Use your registered account, follow event rules, and report results honestly. Exploits, account sharing, collusion, and cheating may lead to removal from events.</p></div></article><article className="panel"><AlertTriangle size={19} /><div><h2>Report with context</h2><p>When you report a concern, include the event or match, what happened, and evidence you are allowed to share. Do not publish private information.</p></div></article></div>
    <div className="policy-callout panel"><strong>Organizer decisions and appeals</strong><p>Organizers review event disputes against published rules. A moderator may request additional context, limit contact while reviewing, and record a reason for the final decision. Retaliation for a good-faith report is not allowed.</p></div>
  </div></section>;
}
