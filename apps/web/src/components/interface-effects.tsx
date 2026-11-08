"use client";

import { useEffect, useRef } from "react";

export function InterfaceEffects() {
  const cursorRef = useRef<HTMLSpanElement>(null);
  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const moveCursor = (event: PointerEvent) => {
      const cursor = cursorRef.current;
      if (!cursor) return;
      const enabled =
        document.documentElement.dataset.customCursor === "true" &&
        event.pointerType === "mouse";
      cursor.hidden = !enabled;
      if (enabled) {
        cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
      }
    };
    const playClick = (event: MouseEvent) => {
      if (
        document.documentElement.dataset.soundEnabled !== "true" ||
        !(event.target instanceof Element) ||
        !event.target.closest("button, a, [role=button]")
      ) {
        return;
      }
      const AudioContextConstructor =
        window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextConstructor) return;
      audioRef.current ??= new AudioContextConstructor();
      const context = audioRef.current;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 660;
      gain.gain.setValueAtTime(0.035, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        context.currentTime + 0.045,
      );
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.05);
    };
    const preferenceChange = () => {
      if (
        document.documentElement.dataset.customCursor !== "true" &&
        cursorRef.current
      ) {
        cursorRef.current.hidden = true;
      }
    };
    document.addEventListener("pointermove", moveCursor, { passive: true });
    document.addEventListener("click", playClick);
    window.addEventListener("clutchverse:preferences", preferenceChange);
    return () => {
      document.removeEventListener("pointermove", moveCursor);
      document.removeEventListener("click", playClick);
      window.removeEventListener("clutchverse:preferences", preferenceChange);
      if (audioRef.current) void audioRef.current.close();
    };
  }, []);

  return (
    <span ref={cursorRef} className="custom-cursor" aria-hidden="true" hidden />
  );
}
