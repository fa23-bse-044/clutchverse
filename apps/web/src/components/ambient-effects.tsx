"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  speed: number;
  size: number;
  phase: number;
};

const colors: Record<string, string> = {
  "neon-cyber": "#00f5d4",
  "crimson-war": "#ff6b35",
  "toxic-venom": "#84cc16",
  "arctic-frost": "#a5f3fc",
  "royal-gold": "#f5d76e",
  "light-pro": "#4f46e5",
};

export function AmbientEffects() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = true;
    let frame = 0;
    let lastFrame = 0;
    let particles: Particle[] = [];
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      if (visible) frame = requestAnimationFrame(draw);
      else cancelAnimationFrame(frame);
    });
    observer.observe(canvas);

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(window.innerWidth * ratio);
      canvas.height = Math.floor(window.innerHeight * ratio);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = Math.min(
        42,
        Math.ceil((window.innerWidth * window.innerHeight) / 38_000),
      );
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        speed: 0.1 + Math.random() * 0.25,
        size: 0.6 + Math.random() * 1.2,
        phase: Math.random() * Math.PI * 2,
      }));
    };

    const draw = (time = 0) => {
      frame = 0;
      if (
        document.hidden ||
        !visible ||
        reducedMotion.matches ||
        document.documentElement.dataset.performance === "true"
      ) {
        return;
      }
      if (time - lastFrame < 32) {
        frame = requestAnimationFrame(draw);
        return;
      }
      lastFrame = time;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const theme = document.documentElement.dataset.theme ?? "neon-cyber";
      const color = colors[theme] ?? colors["neon-cyber"];
      context.clearRect(0, 0, width, height);
      context.strokeStyle = `${color}14`;
      context.fillStyle = `${color}66`;
      context.lineWidth = 0.6;

      if (theme === "neon-cyber" || theme === "light-pro") {
        const spacing = theme === "light-pro" ? 64 : 48;
        context.beginPath();
        for (let x = 0; x < width; x += spacing) {
          context.moveTo(x, 0);
          context.lineTo(x, height);
        }
        for (let y = 0; y < height; y += spacing) {
          context.moveTo(0, y);
          context.lineTo(width, y);
        }
        context.stroke();
      } else if (theme === "crimson-war") {
        context.fillStyle = `${color}20`;
        for (let i = 0; i < 5; i++) {
          const y = ((time * 0.025 + i * 137) % (height + 20)) - 10;
          context.fillRect(0, y, width, 1);
        }
      } else if (theme === "arctic-frost") {
        context.strokeStyle = `${color}20`;
        context.beginPath();
        for (let x = 0; x < width; x += 8) {
          const y = height * 0.38 + Math.sin(x * 0.003 + time * 0.00015) * 55;
          if (x === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.stroke();
      }

      for (const particle of particles) {
        particle.y -= particle.speed;
        if (particle.y < -3) {
          particle.y = height + 3;
          particle.x = Math.random() * width;
        }
        const flicker =
          theme === "crimson-war"
            ? 0.45 + Math.random() * 0.55
            : 0.65 + Math.sin(time * 0.001 + particle.phase) * 0.25;
        context.globalAlpha = flicker;
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
      frame = requestAnimationFrame(draw);
    };

    const pause = () => {
      if (document.hidden || reducedMotion.matches) cancelAnimationFrame(frame);
      else if (visible) frame = requestAnimationFrame(draw);
    };
    const motionChange = () => pause();
    const preferenceChange = () => pause();
    resize();
    pause();
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", pause);
    window.addEventListener("clutchverse:preferences", preferenceChange);
    reducedMotion.addEventListener("change", motionChange);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", pause);
      window.removeEventListener("clutchverse:preferences", preferenceChange);
      reducedMotion.removeEventListener("change", motionChange);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="ambient-effects" aria-hidden="true" />
  );
}
