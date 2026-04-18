import { describe, it, expect } from "vitest";
import { PRESETS, PRESET_LABELS, PRESET_NAMES } from "./presets";
import { DEFAULT_SETTINGS, PARAM_LIMITS } from "./constants";
import type { PresetName } from "./types";

describe("presets", () => {
  it("defines exactly the 4 canonical presets", () => {
    expect(Object.keys(PRESETS).sort()).toEqual(
      ["antique", "lightDust", "warmVinyl", "wornRecord"].sort(),
    );
  });

  it("every preset value is within its parameter limit", () => {
    for (const [name, p] of Object.entries(PRESETS)) {
      expect(p.surface, `${name}.surface`).toBeGreaterThanOrEqual(
        PARAM_LIMITS.surface.min,
      );
      expect(p.surface, `${name}.surface`).toBeLessThanOrEqual(
        PARAM_LIMITS.surface.max,
      );
      expect(p.popsPerSec, `${name}.popsPerSec`).toBeGreaterThanOrEqual(
        PARAM_LIMITS.popsPerSec.min,
      );
      expect(p.popsPerSec, `${name}.popsPerSec`).toBeLessThanOrEqual(
        PARAM_LIMITS.popsPerSec.max,
      );
      expect(p.dust, `${name}.dust`).toBeGreaterThanOrEqual(
        PARAM_LIMITS.dust.min,
      );
      expect(p.dust, `${name}.dust`).toBeLessThanOrEqual(PARAM_LIMITS.dust.max);
    }
  });

  it("presets are strictly ordered from lightest to heaviest", () => {
    const order: PresetName[] = ["lightDust", "warmVinyl", "wornRecord", "antique"];
    for (let i = 1; i < order.length; i++) {
      const prevName = order[i - 1];
      const curName = order[i];
      if (prevName === undefined || curName === undefined) continue;
      const prev = PRESETS[prevName];
      const cur = PRESETS[curName];
      expect(cur.surface, `${curName}.surface > prev`).toBeGreaterThan(
        prev.surface,
      );
      expect(cur.popsPerSec, `${curName}.popsPerSec > prev`).toBeGreaterThan(
        prev.popsPerSec,
      );
      expect(cur.dust, `${curName}.dust > prev`).toBeGreaterThan(prev.dust);
    }
  });

  it("PRESET_LABELS covers every preset name", () => {
    for (const name of PRESET_NAMES) {
      expect(PRESET_LABELS[name]).toBeTruthy();
      expect(typeof PRESET_LABELS[name]).toBe("string");
    }
  });

  it("PRESET_NAMES enumerates every key in PRESETS", () => {
    expect([...PRESET_NAMES].sort()).toEqual(
      (Object.keys(PRESETS) as PresetName[]).sort(),
    );
  });

  it("DEFAULT_SETTINGS.params equals the warmVinyl preset", () => {
    expect(DEFAULT_SETTINGS.preset).toBe("warmVinyl");
    expect(DEFAULT_SETTINGS.params).toEqual(PRESETS.warmVinyl);
  });

  it("DEFAULT_SETTINGS.mode starts as off (privacy-friendly default)", () => {
    expect(DEFAULT_SETTINGS.mode).toBe("off");
  });

  it("DEFAULT_SETTINGS.masterIntensity is within limits", () => {
    expect(DEFAULT_SETTINGS.masterIntensity).toBeGreaterThanOrEqual(
      PARAM_LIMITS.masterIntensity.min,
    );
    expect(DEFAULT_SETTINGS.masterIntensity).toBeLessThanOrEqual(
      PARAM_LIMITS.masterIntensity.max,
    );
  });
});
