import { STORAGE_KEY, DEFAULT_SETTINGS } from "./constants";
import type { Settings } from "./types";

export async function loadSettings(): Promise<Settings> {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY] as Partial<Settings> | undefined;

  if (!stored) return { ...DEFAULT_SETTINGS };

  return {
    enabled: stored.enabled ?? DEFAULT_SETTINGS.enabled,
    preset: stored.preset ?? DEFAULT_SETTINGS.preset,
    params: {
      surface: stored.params?.surface ?? DEFAULT_SETTINGS.params.surface,
      popsPerSec: stored.params?.popsPerSec ?? DEFAULT_SETTINGS.params.popsPerSec,
      dust: stored.params?.dust ?? DEFAULT_SETTINGS.params.dust,
    },
    masterIntensity: stored.masterIntensity ?? DEFAULT_SETTINGS.masterIntensity,
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
}
