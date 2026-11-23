"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Maximize, Minimize, Theater } from "lucide-react";
import { useLocale } from "@/i18n/locale-context";

type WebkitElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type WebkitDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

export function StreamPlayerFrame({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [theater, setTheater] = useState(false);
  const [error, setError] = useState("");
  const { messages } = useLocale();

  const exitFullscreen = useCallback(async () => {
    const webkitDocument = document as WebkitDocument;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else if (webkitDocument.webkitFullscreenElement) {
      await webkitDocument.webkitExitFullscreen?.();
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const frame = frameRef.current;
    if (!frame) return;
    setError("");
    try {
      if (
        document.fullscreenElement === frame ||
        (document as WebkitDocument).webkitFullscreenElement === frame
      ) {
        await exitFullscreen();
        return;
      }
      const webkitFrame = frame as WebkitElement;
      if (frame.requestFullscreen) {
        await frame.requestFullscreen();
      } else if (webkitFrame.webkitRequestFullscreen) {
        await webkitFrame.webkitRequestFullscreen();
      } else {
        setError(messages.streamPlayer.fullscreenUnavailable);
      }
    } catch (reason) {
      console.error("Could not change stream fullscreen state.", reason);
      setError(messages.streamPlayer.fullscreenUnavailable);
    }
  }, [exitFullscreen, messages.streamPlayer.fullscreenUnavailable]);

  useEffect(() => {
    const updateFullscreen = () => {
      const active =
        document.fullscreenElement ??
        (document as WebkitDocument).webkitFullscreenElement;
      setFullscreen(active === frameRef.current);
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const frame = frameRef.current;
      if (!frame || !frame.contains(document.activeElement)) return;
      if (
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          event.target.closest("input, textarea, select, [contenteditable='true']"))
      ) {
        return;
      }
      if (
        event.key.toLowerCase() === "f" &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        event.preventDefault();
        void toggleFullscreen();
      } else if (event.key === "Escape" && fullscreen) {
        event.preventDefault();
        void exitFullscreen();
      }
    };
    document.addEventListener("fullscreenchange", updateFullscreen);
    document.addEventListener("webkitfullscreenchange", updateFullscreen);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("fullscreenchange", updateFullscreen);
      document.removeEventListener("webkitfullscreenchange", updateFullscreen);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [exitFullscreen, fullscreen, toggleFullscreen]);

  return (
    <div
      ref={frameRef}
      className={`stream-player-frame ${theater ? "stream-player-theater" : ""} ${className}`}
      tabIndex={0}
      aria-label={title}
    >
      <div className="stream-player-content">{children}</div>
      <div className="stream-player-overlay">
        <span className="stream-player-live">
          <i className="live-dot" /> {messages.streamPlayer.live}
        </span>
        <strong>{title}</strong>
        <div className="stream-player-actions">
          <button
            type="button"
            className="icon-button"
            aria-label={theater ? messages.streamPlayer.exitTheater : messages.streamPlayer.theater}
            aria-pressed={theater}
            onClick={() => setTheater((enabled) => !enabled)}
          >
            <Theater size={16} />
          </button>
          {!fullscreen && (
            <button
              type="button"
              className="icon-button"
              aria-label={messages.streamPlayer.fullscreen}
              onClick={() => void toggleFullscreen()}
            >
              <Maximize size={16} />
            </button>
          )}
        </div>
      </div>
      {fullscreen && (
        <button
          type="button"
          className="stream-player-exit"
          onClick={() => void exitFullscreen()}
        >
          <Minimize size={16} /> {messages.streamPlayer.exitFullscreen}
        </button>
      )}
      {error && <span className="stream-player-error" role="status">{error}</span>}
    </div>
  );
}
