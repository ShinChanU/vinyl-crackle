import type { Settings } from "./types";
import { PRESETS } from "./presets";

export const STORAGE_KEY = "vinylCrackleSettings";

export const DEFAULT_SETTINGS: Settings = {
  enabled: false,
  preset: "warmVinyl",
  params: { ...PRESETS.warmVinyl },
  masterIntensity: 0.5,
};

export const PARAM_LIMITS = {
  surface: { min: 0, max: 1 },
  popsPerSec: { min: 0, max: 40 },
  dust: { min: 0, max: 1 },
  masterIntensity: { min: 0, max: 1 },
} as const;
