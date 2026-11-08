export type VisualPreferences = {
  theme?: string;
  performanceMode?: boolean;
  backgroundVideo?: boolean;
  soundEnabled?: boolean;
  customCursor?: boolean;
};

const storageKeys = {
  theme: "clutchverse-theme",
  performanceMode: "clutchverse-performance",
  backgroundVideo: "clutchverse-video",
  soundEnabled: "clutchverse-sound",
  customCursor: "clutchverse-cursor",
} as const;

const datasetKeys = {
  performanceMode: "performance",
  backgroundVideo: "backgroundVideo",
  soundEnabled: "soundEnabled",
  customCursor: "customCursor",
} as const;

export function applyVisualPreferences(preferences: VisualPreferences) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(preferences) as [
    keyof typeof storageKeys,
    string | boolean,
  ][]) {
    localStorage.setItem(storageKeys[key], String(value));
    if (key !== "theme") {
      root.dataset[datasetKeys[key]] = String(value);
    }
  }
  window.dispatchEvent(new CustomEvent("clutchverse:preferences"));
}

export async function saveVisualPreferences(
  preferences: VisualPreferences,
): Promise<void> {
  try {
    const response = await fetch("/api/profile/preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(preferences),
    });
    if (!response.ok && response.status !== 401) {
      const body = (await response.json()) as { error?: string };
      console.error(
        body.error ?? `Could not save visual preferences (${response.status}).`,
      );
    }
  } catch (error) {
    console.error("Could not save visual preferences.", error);
  }
}

export function readVisualPreferences() {
  return {
    performanceMode:
      localStorage.getItem(storageKeys.performanceMode) === "true",
    backgroundVideo:
      localStorage.getItem(storageKeys.backgroundVideo) === "true",
    soundEnabled: localStorage.getItem(storageKeys.soundEnabled) === "true",
    customCursor: localStorage.getItem(storageKeys.customCursor) === "true",
  };
}
