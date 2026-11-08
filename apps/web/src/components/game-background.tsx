"use client";

import { useEffect, useRef, useState } from "react";

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

  useEffect(() => {
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
          !["slow-2g", "2g", "3g"].includes(connection?.effectiveType ?? ""),
      );
    };
    updateAllowed();
    reducedMotion.addEventListener("change", updateAllowed);

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry?.isIntersecting ?? false),
      { threshold: 0.1 },
    );
    if (host.current) observer.observe(host.current);
    return () => {
      observer.disconnect();
      reducedMotion.removeEventListener("change", updateAllowed);
    };
  }, []);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (!enabled || !allowed || !visible || document.hidden || failed) {
      video.pause();
      return;
    }
    void video.play().catch(() => setFailed(true));
  }, [allowed, enabled, failed, visible]);

  useEffect(() => {
    const updateVisibility = () => {
      const video = ref.current;
      if (!video) return;
      if (document.hidden) video.pause();
      else if (enabled && allowed && visible && !failed)
        void video.play().catch(() => setFailed(true));
    };
    document.addEventListener("visibilitychange", updateVisibility);
    return () =>
      document.removeEventListener("visibilitychange", updateVisibility);
  }, [allowed, enabled, failed, visible]);

  return (
    <div
      ref={host}
      className="game-background"
      aria-hidden="true"
      style={{ backgroundImage: `url("${poster}")` }}
    >
      {enabled && allowed && visible && !failed && (
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
