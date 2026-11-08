"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function TeamCreateForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/teams", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: form.get("name"), gameSlug: form.get("gameSlug") }),
    });
    const result = await response.json() as { team?: { slug: string }; error?: string };
    setBusy(false);
    if (!response.ok || !result.team) {
      setError(result.error ?? "Unable to create team.");
      return;
    }
    router.push(`/teams/${result.team.slug}`);
    router.refresh();
  }
  return <form className="auth-form" onSubmit={submit}>
    <label>TEAM NAME<input name="name" minLength={3} maxLength={40} required placeholder="Your squad's name" /></label>
    <label>GAME<select name="gameSlug" required><option value="pubg-mobile">PUBG MOBILE</option><option value="free-fire">FREE FIRE</option><option value="tekken-8">TEKKEN 8</option><option value="fifa">EA SPORTS FC</option></select></label>
    {error && <p className="auth-error" role="alert">{error}</p>}
    <button className="button button-primary full-button" disabled={busy}>{busy ? "CREATING..." : "CREATE TEAM"}</button>
  </form>;
}
