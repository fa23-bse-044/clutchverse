"use client";

import { useEffect, useRef, useState } from "react";
import { readVisualPreferences } from "@/lib/visual-preferences";

type Props = {
  poster: string;
  webm: string;
  mp4: string;
  enabled: boolean;
};

export function GameBackground({ poster, webm, mp4, enabled }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [allowed, setAllowed] = useState(false);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  const [performanceMode, setPerformanceMode] = useState(false);

  useEffect(() => {
    const syncPerformanceMode = () => {
      setPerformanceMode(readVisualPreferences().performanceMode);
    };
    syncPerformanceMode();
    window.addEventListener("clutchverse:preferences", syncPerformanceMode);
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateAllowed = () => {
      setAllowed(
        !reducedMotion.matches &&
          !connection?.saveData &&
          !readVisualPreferences().performanceMode &&
          !["slow-2g", "2g", "3g"].includes(connection?.effectiveType ?? ""),
      );
    };
    updateAllowed();
    reducedMotion.addEventListener("change", updateAllowed);

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry?.isIntersecting ?? false),
      { threshold: 0.3 },
    );
    if (host.current) observer.observe(host.current);
    return () => {
      observer.disconnect();
      reducedMotion.removeEventListener("change", updateAllowed);
      window.removeEventListener("clutchverse:preferences", syncPerformanceMode);
    };
  }, []);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (!enabled || !allowed || performanceMode || !visible || document.hidden || failed) {
      video.pause();
      return;
    }
    void video.play().catch(() => setFailed(true));
  }, [allowed, enabled, failed, performanceMode, visible]);

  useEffect(() => {
    const updateVisibility = () => {
      const video = ref.current;
      if (!video) return;
      if (document.hidden) video.pause();
      else if (enabled && allowed && !performanceMode && visible && !failed)
        void video.play().catch(() => setFailed(true));
    };
    document.addEventListener("visibilitychange", updateVisibility);
    return () =>
      document.removeEventListener("visibilitychange", updateVisibility);
  }, [allowed, enabled, failed, performanceMode, visible]);

  return (
    <div
      ref={host}
      className="game-background"
      aria-hidden="true"
      style={{ backgroundImage: `url("${poster}")` }}
    >
      {enabled && allowed && !performanceMode && visible && !failed && (
        <video
          ref={ref}
          className="game-background-video"
          muted
          playsInline
          loop
          preload="metadata"
          poster={poster}
          onError={() => setFailed(true)}
        >
          <source src={webm} type="video/webm" />
          <source src={mp4} type="video/mp4" />
        </video>
      )}
    </div>
  );
}
