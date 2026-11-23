"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useLocale } from "@/i18n/locale-context";
import { spotlightText } from "@/i18n/messages/spotlight";
import styles from "./spotlight.module.css";

export function SpotlightHubCard({
  status,
  startsAt,
}: {
  status: string | null;
  startsAt: string | null;
}) {
  const { locale } = useLocale();
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!startsAt) return;
    const update = () => setRemaining(Math.max(0, new Date(startsAt).getTime() - Date.now()));
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [startsAt]);
  const t = (key: Parameters<typeof spotlightText>[0]) => spotlightText(key, locale);
  const countdown = remaining === null
    ? t("notAvailable")
    : `${Math.floor(remaining / 86_400_000)} ${t("days")} ${String(Math.floor((remaining % 86_400_000) / 3_600_000)).padStart(2, "0")}:${String(Math.floor((remaining % 3_600_000) / 60_000)).padStart(2, "0")}:${String(Math.floor((remaining % 60_000) / 1000)).padStart(2, "0")}`;
  const badge = status === "live" ? t("liveBadge") : status === "completed" ? t("statusCompleted") : t("statusUpcoming");
  return (
    <div className="container" style={{ paddingBlock: "1.25rem" }}>
      <Link
        href="/games/pubg-mobile/pmgc"
        className={`panel ${styles.hubCard}`}
        aria-label={`${badge}: ${t("title")}`}
      >
        <span className={styles.hubBadge}>{badge}</span>
        <span>
          <strong>{t("title")}</strong>
          <small>{status === "live" ? t("statusLive") : status === "completed" ? t("statusCompleted") : `${t("startsIn")} · ${countdown}`}</small>
        </span>
        <ArrowUpRight aria-hidden="true" size={18} />
      </Link>
    </div>
  );
}
