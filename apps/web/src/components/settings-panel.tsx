"use client";

import { useEffect, useState } from "react";
import { Video } from "lucide-react";
import { ThemeSwitcher } from "./theme-switcher";
import {
  applyVisualPreferences,
  readVisualPreferences,
  saveVisualPreferences,
} from "@/lib/visual-preferences";
import { getDirection, isLocale, languageOptions } from "@/i18n/locales";
import { useLocale } from "@/i18n/locale-context";

export function SettingsPanel({ theme }: { theme: string }) {
  const { locale, setLocale, messages } = useLocale();
  const [preferences, setPreferences] = useState({
    backgroundVideo: false,
    performanceMode: false,
    soundEnabled: false,
    customCursor: false,
  });
  useEffect(() => {
    const sync = () => setPreferences(readVisualPreferences());
    sync();
    window.addEventListener("clutchverse:preferences", sync);
    return () => window.removeEventListener("clutchverse:preferences", sync);
  }, []);
  const updatePreference = (key: keyof typeof preferences, value: boolean) => {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    applyVisualPreferences({ [key]: value });
    void saveVisualPreferences({ [key]: value });
  };
  return (
    <div className="settings-sections">
      <section className="settings-row panel">
        <div>
          <span className="eyebrow">APPEARANCE</span>
          <h2>Choose your theme</h2>
          <p className="muted">
            Current theme: {theme.replaceAll("-", " ")}. Updates are saved to
            your account when connected.
          </p>
        </div>
        <ThemeSwitcher />
      </section>
      <section className="settings-row panel">
        <div>
          <span className="eyebrow">{messages.language}</span>
          <h2>{messages.language}</h2>
          <p className="muted">
            {languageOptions.find((option) => option.code === locale)?.name} ·{" "}
            {getDirection(locale).toUpperCase()}
          </p>
        </div>
        <label className="settings-language">
          <span className="sr-only">{messages.language}</span>
          <select
            value={locale}
            onChange={(event) => {
              if (isLocale(event.target.value)) setLocale(event.target.value);
            }}
          >
            {languageOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.nativeName} — {option.name}
              </option>
            ))}
          </select>
        </label>
      </section>
      <section className="settings-row panel">
        <div>
          <span className="eyebrow">MEDIA</span>
          <h2>Game hub backgrounds</h2>
          <p className="muted">
            Loop licensed game video only when the owner has supplied the media
            files.
          </p>
        </div>
        <label className="settings-switch">
          <Video size={15} />
          <input
            type="checkbox"
            checked={preferences.backgroundVideo}
            onChange={(event) =>
              updatePreference("backgroundVideo", event.target.checked)
            }
          />
          <span>Background video</span>
        </label>
      </section>
      <section className="settings-row panel">
        <div>
          <span className="eyebrow">AUDIO</span>
          <h2>Interface sound effects</h2>
          <p className="muted">
            Optional subtle feedback sounds. Disabled by default.
          </p>
        </div>
        <label className="settings-switch">
          <input
            type="checkbox"
            checked={preferences.soundEnabled}
            onChange={(event) =>
              updatePreference("soundEnabled", event.target.checked)
            }
          />
          <span>Sound effects</span>
        </label>
      </section>
      <section className="settings-row panel">
        <div>
          <span className="eyebrow">POINTER</span>
          <h2>Custom cursor</h2>
          <p className="muted">
            Enable a lightweight accent cursor on pointer devices.
          </p>
        </div>
        <label className="settings-switch">
          <input
            type="checkbox"
            checked={preferences.customCursor}
            onChange={(event) =>
              updatePreference("customCursor", event.target.checked)
            }
          />
          <span>Custom cursor</span>
        </label>
      </section>
      <section className="settings-row panel">
        <div>
          <span className="eyebrow">PERFORMANCE & ACCESSIBILITY</span>
          <h2>Performance mode</h2>
          <p className="muted">
            Disables ambient effects and magnetic motion. Reduced-motion
            preferences are always respected.
          </p>
        </div>
        <label className="settings-switch">
          <input
            type="checkbox"
            checked={preferences.performanceMode}
            onChange={(event) =>
              updatePreference("performanceMode", event.target.checked)
            }
          />
          <span>Performance mode</span>
        </label>
      </section>
    </div>
  );
}
