import { STORAGE_KEY, DEFAULT_SETTINGS } from "./constants";
import type { PlaybackMode, Settings } from "./types";

/**
 * 레거시 형상: { enabled: boolean, ... }
 * 신규 형상:   { mode: 'off' | 'overlay' | 'ambient', ... }
 * enabled 만 있는 저장본은 overlay/off 로 마이그레이션한다.
 */
interface LegacySettings extends Omit<Partial<Settings>, "mode"> {
  enabled?: boolean;
}

export async function loadSettings(): Promise<Settings> {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY] as (Partial<Settings> & LegacySettings) | undefined;

  if (!stored) return { ...DEFAULT_SETTINGS };

  const mode: PlaybackMode =
    stored.mode ?? (stored.enabled === true ? "overlay" : "off");

  const migrated: Settings = {
    mode,
    preset: stored.preset ?? DEFAULT_SETTINGS.preset,
    params: {
      surface: stored.params?.surface ?? DEFAULT_SETTINGS.params.surface,
      popsPerSec: stored.params?.popsPerSec ?? DEFAULT_SETTINGS.params.popsPerSec,
      dust: stored.params?.dust ?? DEFAULT_SETTINGS.params.dust,
    },
    masterIntensity: stored.masterIntensity ?? DEFAULT_SETTINGS.masterIntensity,
  };

  // 레거시 키가 있었다면 새 형상으로 즉시 재저장
  if (stored.enabled !== undefined && stored.mode === undefined) {
    await saveSettings(migrated);
  }

  return migrated;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
}
