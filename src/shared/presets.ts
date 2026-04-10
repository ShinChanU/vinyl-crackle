import type { CrackleParams, PresetName } from "./types";

export const PRESETS: Record<PresetName, CrackleParams> = {
  lightDust: { surface: 0.15, popsPerSec: 3, dust: 0.1 },
  warmVinyl: { surface: 0.3, popsPerSec: 6, dust: 0.2 },
  wornRecord: { surface: 0.5, popsPerSec: 12, dust: 0.4 },
  antique: { surface: 0.8, popsPerSec: 25, dust: 0.7 },
};

export const PRESET_LABELS: Record<PresetName, string> = {
  lightDust: "Light Dust",
  warmVinyl: "Warm Vinyl",
  wornRecord: "Worn Record",
  antique: "Antique",
};

export const PRESET_NAMES: PresetName[] = [
  "lightDust",
  "warmVinyl",
  "wornRecord",
  "antique",
];
