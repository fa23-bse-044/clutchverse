"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Palette } from "lucide-react";
import {
  applyVisualPreferences,
  readVisualPreferences,
  saveVisualPreferences,
} from "@/lib/visual-preferences";

const themes = [
  ["neon-cyber", "Neon Cyber", "#9d4edd", "#00f5d4"],
  ["crimson-war", "Crimson War", "#c1121f", "#ff6b35"],
  ["toxic-venom", "Toxic Venom", "#84cc16", "#00e676"],
  ["arctic-frost", "Arctic Frost", "#38bdf8", "#a5f3fc"],
  ["royal-gold", "Royal Gold", "#d4a72c", "#f5d76e"],
  ["light-pro", "Light Pro", "#4f46e5", "#0891b2"],
] as const;

export function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const [performance, setPerformance] = useState(false);
  const { theme, setTheme } = useTheme();
  useEffect(() => {
    const sync = () => setPerformance(readVisualPreferences().performanceMode);
    sync();
    window.addEventListener("clutchverse:preferences", sync);
    return () => window.removeEventListener("clutchverse:preferences", sync);
  }, []);
  return (
    <div className="theme-control">
      <button
        className="icon-button"
        aria-label="Choose appearance theme"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Palette size={16} />
      </button>
      {open && (
        <div className="theme-menu" role="dialog" aria-label="Choose theme">
          <div className="theme-menu-heading">
            <span>YOUR LOOK</span>
            <button
              aria-label="Close theme chooser"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>
          {themes.map(([id, name, primary, accent]) => (
            <button
              className={`theme-option ${theme === id ? "theme-selected" : ""}`}
              key={id}
              onClick={() => {
                setTheme(id);
                applyVisualPreferences({ theme: id });
                void saveVisualPreferences({ theme: id });
                setOpen(false);
              }}
            >
              <span className="theme-swatch">
                <i style={{ background: primary }} />
                <i style={{ background: accent }} />
              </span>
              <span>{name}</span>
              {theme === id && <span className="theme-check">✓</span>}
            </button>
          ))}
          <label className="performance-toggle">
            <input
              type="checkbox"
              checked={performance}
              onChange={(event) => {
                const enabled = event.target.checked;
                setPerformance(enabled);
                applyVisualPreferences({ performanceMode: enabled });
                void saveVisualPreferences({ performanceMode: enabled });
              }}
            />{" "}
            Performance mode <span>Reduce motion and visual effects</span>
          </label>
        </div>
      )}
    </div>
  );
}
