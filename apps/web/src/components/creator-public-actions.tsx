"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useLocale } from "@/i18n/locale-context";

export function CreatorPublicActions({
  slug,
  ownerId,
  clipId,
  rewardId,
  watchPartyId,
}: {
  slug: string;
  ownerId: string;
  clipId?: string;
  rewardId?: string;
  watchPartyId?: string;
}) {
  const { data } = useSession();
  const { messages } = useLocale();
  const copy = messages.creatorTools;
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const viewerId = data?.user?.id;

  async function send(url: string, method: string, body?: unknown) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(url, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? copy.error);
      setNotice(copy.saved);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : copy.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {viewerId && viewerId !== ownerId && !clipId && !rewardId && (
        <button className="button button-primary" disabled={busy} onClick={() => void send(`/api/creator/follow/${encodeURIComponent(slug)}`, "POST")}>{copy.follow}</button>
      )}
      {viewerId && viewerId !== ownerId && clipId && (
        <button className="button button-secondary" disabled={busy} onClick={() => void send(`/api/creator/clips/${encodeURIComponent(clipId)}/vote`, "POST")}>{copy.vote}</button>
      )}
      {viewerId && viewerId !== ownerId && rewardId && (
        <button className="button button-secondary" disabled={busy} onClick={() => void send("/api/creator/rewards/redeem", "POST", { rewardId })}>{copy.redeem}</button>
      )}
      {viewerId && watchPartyId && (
        <button className="button button-secondary" disabled={busy} onClick={() => void send(`/api/creator/watch-parties/${encodeURIComponent(watchPartyId)}/join`, "POST")}>{copy.joinParty}</button>
      )}
      <span role="status" aria-live="polite">{notice}</span>
    </div>
  );
}
