"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useLocale } from "@/i18n/locale-context";
import { spotlightText } from "@/i18n/messages/spotlight";
import { countryFlagEmoji } from "@/lib/spotlight-domain";
import type { SpotlightSnapshot } from "@/components/spotlight-event";
import styles from "./spotlight.module.css";

export function SpotlightTeamPage({
  event,
  participation,
}: {
  event: SpotlightSnapshot;
  participation: SpotlightSnapshot["participants"][number];
}) {
  const { locale } = useLocale();
  const t = (key: Parameters<typeof spotlightText>[0]) => spotlightText(key, locale);
  const countries = useMemo(() => new Intl.DisplayNames([locale], { type: "region" }), [locale]);
  const history = event.standings.filter((standing) => standing.participationId === participation.id);
  return (
    <main className={styles.page}>
      <div className="container">
        <p className="eyebrow">{t("eyebrow")} · {event.displayName}</p>
        <h1 className="page-title">{participation.team.name}</h1>
        <p className="page-intro">{countryFlagEmoji(participation.countryCode)} {participation.countryCode} · {countries.of(participation.countryCode) ?? participation.countryCode}</p>
        <p><strong>{t("qualification")}:</strong> {participation.qualificationPath ?? t("notAvailable")}</p>
        <p><strong>{t("stage")}:</strong> {participation.stage?.name ?? t("notAvailable")} · {participation.status}</p>
        <p>{t("source")}: <a href={participation.sourceUrl} target="_blank" rel="noreferrer">{participation.sourceName}</a></p>
        <section className={styles.section}>
          <h2>{t("roster")}</h2>
          {participation.team.players.length ? (
            <ul>{participation.team.players.map((player) => <li key={player.id}>{player.name}{player.role ? ` · ${player.role}` : ""} · <a href={player.sourceUrl} target="_blank" rel="noreferrer">{t("source")}</a></li>)}</ul>
          ) : <p>{t("noRoster")}</p>}
        </section>
        <section className={styles.section}>
          <h2>{t("history")}</h2>
          {history.length ? <ul>{history.map((standing) => <li key={standing.id}>{standing.stage?.name ?? t("notAvailable")}: {t("placement")} {standing.rank ?? "TBD"}, {standing.points ?? "TBD"} pts, {standing.kills ?? "TBD"} kills · <a href={standing.sourceUrl} target="_blank" rel="noreferrer">{t("source")}</a></li>)}</ul> : <p>{t("notAvailable")}</p>}
        </section>
        <Link className="button button-quiet" href="/games/pubg-mobile/pmgc">{t("explore")}</Link>
      </div>
    </main>
  );
}
