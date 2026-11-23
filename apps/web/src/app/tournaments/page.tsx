import { tournaments } from "@/lib/demo-data";
import { TournamentBrowser } from "@/components/tournament-browser";
import { MatchLobbyEntry } from "@/components/match-lobby-entry";
import { prisma } from "@clutchverse/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "Tournaments" };

export default async function TournamentsPage() {
  let events = tournaments;
  let demo = true;
  try {
    const records = await prisma.tournament.findMany({
      include: { game: true, _count: { select: { registrations: true } } },
      orderBy: [{ startsAt: "asc" }, { title: "asc" }],
      take: 100,
    });
    if (records.length) {
      events = records.flatMap((record) => {
        const supported = ["pubg-mobile", "free-fire", "tekken-8", "fifa"].includes(record.game.slug);
        if (!supported) return [];
        const settings = record.settings as { maxEntries?: number };
        return [{
          id: record.id,
          slug: record.slug,
          title: record.title,
          game: record.game.slug as (typeof tournaments)[number]["game"],
          state: record.state,
          format: record.format.replaceAll("_", " "),
          starts: record.state === "LIVE" ? "Live now" : new Date(record.startsAt).toLocaleString(),
          startsAt: record.startsAt.toISOString(),
          prize: `$${(record.prizePool / 100).toLocaleString()}`,
          entries: `${record._count.registrations} / ${settings.maxEntries ?? 128}`,
          region: record.region,
          entryFee: record.entryFee,
        }];
      });
      demo = false;
    }
  } catch (error) {
    console.error("Falling back to sample tournament listings.", error);
  }
  return <section className="section page-top"><div className="container">
    <div className="eyebrow">YOUR NEXT CHALLENGE</div><h1 className="page-title">The arena is open.</h1>
    <p className="page-intro">Find your format, enter the bracket, and put your game on the line. Every event has a real path from sign-up to final score.</p>
    {demo && <p className="publisher-note">Sample tournaments are displayed until the database is seeded and online.</p>}
    <MatchLobbyEntry />
    <div className="tournament-summary"><span><i className="live-dot" /> <strong>{events.filter((event) => event.state === "LIVE").length}</strong> events live now</span><span><strong>{events.filter((event) => event.state === "UPCOMING").length}</strong> upcoming</span><span><strong>{events.reduce((sum, event) => sum + Number.parseFloat(event.prize.replace(/[^0-9.]/g, "")), 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</strong> total prize pools</span></div>
    <TournamentBrowser events={events} />
  </div></section>;
}
