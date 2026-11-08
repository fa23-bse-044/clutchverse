"use client";

import Link from "next/link";
import { games } from "@clutchverse/core";
import { useLocale } from "@/i18n/locale-context";

export function ProSceneWidget() {
  const { messages } = useLocale();
  return (
    <section className="section">
      <div className="container">
        <div className="section-title">
          <div>
            <span className="eyebrow">{messages.proScene.title}</span>
            <h2>{messages.proScene.intro}</h2>
          </div>
          <Link className="button button-quiet" href={`/games/${games[0].slug}/pro-scene`}>
            {messages.proScene.events}
          </Link>
        </div>
        <div className="game-grid">
          {games.map((game) => (
            <Link className="game-card" href={`/games/${game.slug}/pro-scene`} key={game.slug}>
              <span className="game-category">{messages.proScene.title}</span>
              <h3>{game.name}</h3>
              <span className="game-tagline">{game.tag}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
