"use client";

import Link from "next/link";
import { useLocale } from "@/i18n/locale-context";
import { CreatorPublicActions } from "@/components/creator-public-actions";

export type CreatorPublicData = {
  userId: string;
  slug: string;
  displayName: string;
  bio: string;
  followers: number;
  schedules: { id: string; title: string; scheduledAt: string; streamUrl: string | null }[];
  parties: { id: string; title: string; description: string; startsAt: string; participants: number }[];
  clips: { id: string; title: string; votes: number; trimStartMs: number; trimEndMs: number | null }[];
  rewards: { id: string; title: string; description: string; cost: number }[];
};

export function CreatorPublicProfile({ creator }: { creator: CreatorPublicData }) {
  const { messages, locale } = useLocale();
  const copy = messages.creatorTools;
  return (
    <div>
      <article className="panel profile-section">
        <span className="eyebrow">{copy.profile} · {creator.followers} {copy.followers}</span>
        <h1 className="page-title">{creator.displayName}</h1>
        <p>{creator.bio}</p>
        <CreatorPublicActions slug={creator.slug} ownerId={creator.userId} />
      </article>
      <section className="panel profile-section">
        <h2>{copy.upcomingStreams}</h2>
        {creator.schedules.length ? creator.schedules.map((item) => (
          <div className="match-row" key={item.id}>
            <strong>{item.title}</strong>
            <time dateTime={item.scheduledAt}>{new Date(item.scheduledAt).toLocaleString(locale)}</time>
            {item.streamUrl && <a href={item.streamUrl} target="_blank" rel="noreferrer">{copy.watchStream}</a>}
          </div>
        )) : <p>{copy.noUpcomingStreams}</p>}
      </section>
      <section className="panel profile-section">
        <h2>{copy.clips}</h2>
        {creator.clips.length ? creator.clips.map((clip) => (
          <article key={clip.id} className="panel profile-section">
            <h3>{clip.title}</h3>
            <video controls preload="metadata" src={`/api/creator/clips/${encodeURIComponent(clip.id)}/media`} style={{ width: "100%", maxWidth: "42rem" }} />
            <p>{clip.votes} {copy.votesCount} · {copy.trim} {Math.round(clip.trimStartMs / 1000)}s{clip.trimEndMs ? `–${Math.round(clip.trimEndMs / 1000)}s` : ""}</p>
            <CreatorPublicActions slug={creator.slug} ownerId={creator.userId} clipId={clip.id} />
          </article>
        )) : <p>{copy.noPublicClips}</p>}
      </section>
      <section className="panel profile-section">
        <h2>{copy.upcomingWatchParties}</h2>
        {creator.parties.length ? creator.parties.map((party) => (
          <div className="match-row" key={party.id}>
            <span><strong>{party.title}</strong><small>{party.description}</small></span>
            <time dateTime={party.startsAt}>{new Date(party.startsAt).toLocaleString(locale)}</time>
            <span>{party.participants} {copy.joined}</span>
            <CreatorPublicActions slug={creator.slug} ownerId={creator.userId} watchPartyId={party.id} />
          </div>
        )) : <p>{copy.noUpcomingWatchParties}</p>}
      </section>
      <section className="panel profile-section">
        <h2>{copy.rewards}</h2>
        {creator.rewards.length ? creator.rewards.map((reward) => (
          <div className="match-row" key={reward.id}>
            <span><strong>{reward.title}</strong><small>{reward.description}</small></span>
            <span>{reward.cost} {copy.virtualPointsLabel}</span>
            <CreatorPublicActions slug={creator.slug} ownerId={creator.userId} rewardId={reward.id} />
          </div>
        )) : <p>{copy.noRewards}</p>}
      </section>
      <p className="muted"><Link href="/creator">{copy.title}</Link></p>
    </div>
  );
}
