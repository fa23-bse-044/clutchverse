"use client";

import { type FormEvent, useState } from "react";
import { ArrowRight, Radio } from "lucide-react";
import { resolveStreamEmbed } from "@clutchverse/core";

export function StreamViewer() {
  const [url, setUrl] = useState("");
  const [embed, setEmbed] = useState<ReturnType<typeof resolveStreamEmbed>>(null);
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = resolveStreamEmbed(url, window.location.origin);
    setEmbed(result);
    setError(result ? "" : "Enter a valid Twitch channel or YouTube video URL.");
  }

  return <div className="viewer-shell">
    {embed ? <iframe
      className="stream-iframe"
      src={embed.src}
      title={`${embed.provider} community broadcast`}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    /> : <div className="viewer-empty"><div className="viewer-glyph"><Radio size={27} /></div><span className="eyebrow">THE BROADCAST DESK</span><h2>Pick a stream to watch.</h2><p className="muted">Paste a Twitch channel or YouTube video link to watch an approved broadcast.</p><form className="stream-url-form" onSubmit={submit}><input type="url" required value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://www.twitch.tv/channel" aria-label="Twitch or YouTube stream URL" /><button className="button button-primary" type="submit">Watch <ArrowRight size={14} /></button></form>{error && <p className="stream-error" role="alert">{error}</p>}</div>}
    <div className="viewer-bar"><span>{embed ? <><i className="live-dot" /> {embed.provider.toUpperCase()} EMBED</> : <><span className="chat-offline-dot" /> NO STREAM SELECTED</>}</span><span>External player · provider terms apply</span>{embed && <button aria-label="Close stream" onClick={() => setEmbed(null)}>×</button>}</div>
  </div>;
}
