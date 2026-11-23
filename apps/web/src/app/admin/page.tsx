import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@clutchverse/db";
import Link from "next/link";
import { Activity, AlertTriangle, ArrowUpRight, CreditCard, ShieldCheck, Users } from "lucide-react";
import { FeatureFlagsLink } from "@/components/feature-flags-link";

export const metadata = { title: "Admin overview" };

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin");
  const actor = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (actor?.role !== "ADMIN") redirect("/");
  return <section className="section page-top"><div className="container">
    <div className="eyebrow">CLUTCHVERSE CONTROL ROOM</div><h1 className="page-title">Platform overview.</h1><p className="page-intro">Operations dashboard preview with sample aggregates. Production admin actions require authenticated admin role checks and a configured database.</p>
    <div className="admin-alert panel"><ShieldCheck size={17} /><span><strong>Read-only preview mode</strong><small>No user, payment, or moderation records are accessible in this local sample.</small></span><span className="tag">NO ADMIN SESSION</span></div>
    <div className="admin-kpis"><div className="panel"><Users size={17} /><span>REGISTERED PLAYERS</span><strong>4,218,602</strong><small className="positive">+8.2% this month</small></div><div className="panel"><Activity size={17} /><span>ACTIVE EVENTS</span><strong>18</strong><small>2 live · 16 upcoming</small></div><div className="panel"><AlertTriangle size={17} /><span>OPEN REPORTS</span><strong>12</strong><small>Requires moderator review</small></div><div className="panel"><CreditCard size={17} /><span>PRIZE POOLS</span><strong>$102,500</strong><small>Active tournaments</small></div></div>
    <div className="admin-grid"><section className="panel admin-panel"><div className="detail-section-title"><div><span className="eyebrow">PLATFORM ACTIVITY</span><h2>Weekly engagement</h2></div><span className="tag">LAST 7 DAYS</span></div><div className="activity-chart">{[48, 62, 55, 74, 64, 86, 72, 93, 66, 78, 89, 100, 79, 91].map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}</div><div className="chart-x"><span>MON</span><span>WED</span><span>FRI</span><span>SUN</span></div></section>
      <section className="panel admin-panel"><div className="detail-section-title"><div><span className="eyebrow">NEEDS ATTENTION</span><h2>Review queue</h2></div><span className="tag">SAMPLE</span></div>{[["Match dispute", "PUBG MOBILE · Score mismatch", "OPEN"], ["Player report", "Community conduct · 2 reports", "OPEN"], ["Organizer check", "Free Fire · Identity review", "PENDING"]].map(([title, detail, state]) => <div className="review-row" key={title}><span className="review-icon"><AlertTriangle size={14} /></span><span><strong>{title}</strong><small>{detail}</small></span><span className="tag">{state}</span></div>)}</section></div>
    <div className="admin-quick-links"><Link href="/tournaments" className="panel"><span><strong>Tournament operations</strong><small>Events, match reports, and disputes</small></span><ArrowUpRight size={15} /></Link><Link href="/community" className="panel"><span><strong>Community safety</strong><small>Moderation policy and user reports</small></span><ArrowUpRight size={15} /></Link><Link href="/admin/game-records" className="panel"><span><strong>Game records</strong><small>Review and edit community-verified records</small></span><ArrowUpRight size={15} /></Link><Link href="/admin/pro-scene" className="panel"><span><strong>Pro Scene data</strong><small>Manage sourced competitive events</small></span><ArrowUpRight size={15} /></Link><Link href="/admin/spotlight" className="panel"><span><strong>Event spotlights</strong><small>Manage PMGC data, sources, and provider health</small></span><ArrowUpRight size={15} /></Link><FeatureFlagsLink /></div>
  </div></section>;
}
