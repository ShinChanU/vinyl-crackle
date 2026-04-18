import { describe, it, expect, beforeEach } from "vitest";
import { loadSettings, saveSettings } from "./storage";
import { DEFAULT_SETTINGS, STORAGE_KEY } from "./constants";
import { PRESETS } from "./presets";
import {
  resetChromeMocks,
  seedSyncStorage,
  getSyncStorage,
} from "../../tests/setup";
import type { Settings } from "./types";

describe("storage", () => {
  beforeEach(() => {
    resetChromeMocks();
  });

  describe("loadSettings — empty storage", () => {
    it("returns a copy of DEFAULT_SETTINGS", async () => {
      const result = await loadSettings();
      expect(result).toEqual(DEFAULT_SETTINGS);
    });

    it("returns a defensive copy, not the exported reference", async () => {
      const result = await loadSettings();
      expect(result).not.toBe(DEFAULT_SETTINGS);
    });
  });

  describe("loadSettings — legacy migration", () => {
    it("migrates { enabled: true } to mode='overlay'", async () => {
      seedSyncStorage(STORAGE_KEY, {
        enabled: true,
        preset: "warmVinyl",
        params: PRESETS.warmVinyl,
        masterIntensity: 0.5,
      });

      const result = await loadSettings();
      expect(result.mode).toBe("overlay");
    });

    it("migrates { enabled: false } to mode='off'", async () => {
      seedSyncStorage(STORAGE_KEY, {
        enabled: false,
        preset: "warmVinyl",
        params: PRESETS.warmVinyl,
        masterIntensity: 0.5,
      });

      const result = await loadSettings();
      expect(result.mode).toBe("off");
    });

    it("writes the migrated settings back to storage immediately", async () => {
      seedSyncStorage(STORAGE_KEY, {
        enabled: true,
        preset: "antique",
        params: PRESETS.antique,
        masterIntensity: 0.8,
      });

      await loadSettings();

      const stored = getSyncStorage().get(STORAGE_KEY) as Settings;
      expect(stored.mode).toBe("overlay");
      expect((stored as unknown as { enabled?: boolean }).enabled).toBeUndefined();
    });

    it("does not migrate when the new 'mode' field is already present", async () => {
      // Even if a stale 'enabled' is present, 'mode' wins and no rewrite happens.
      const existing: Settings & { enabled?: boolean } = {
        mode: "ambient",
        preset: "lightDust",
        params: PRESETS.lightDust,
        masterIntensity: 0.3,
        enabled: true,
      };
      seedSyncStorage(STORAGE_KEY, existing);

      const result = await loadSettings();
      expect(result.mode).toBe("ambient");
    });
  });

  describe("loadSettings — partial data", () => {
    it("fills missing preset with DEFAULT_SETTINGS.preset", async () => {
      seedSyncStorage(STORAGE_KEY, { mode: "overlay" });

      const result = await loadSettings();
      expect(result.preset).toBe(DEFAULT_SETTINGS.preset);
    });

    it("fills missing params fields individually with defaults", async () => {
      seedSyncStorage(STORAGE_KEY, {
        mode: "overlay",
        params: { surface: 0.9 },
      });

      const result = await loadSettings();
      expect(result.params.surface).toBe(0.9);
      expect(result.params.popsPerSec).toBe(DEFAULT_SETTINGS.params.popsPerSec);
      expect(result.params.dust).toBe(DEFAULT_SETTINGS.params.dust);
    });

    it("fills missing masterIntensity with the default", async () => {
      seedSyncStorage(STORAGE_KEY, { mode: "ambient" });

      const result = await loadSettings();
      expect(result.masterIntensity).toBe(DEFAULT_SETTINGS.masterIntensity);
    });
  });

  describe("saveSettings", () => {
    it("persists the object under STORAGE_KEY", async () => {
      const settings: Settings = {
        mode: "ambient",
        preset: "wornRecord",
        params: PRESETS.wornRecord,
        masterIntensity: 0.42,
      };

      await saveSettings(settings);

      const roundTrip = await loadSettings();
      expect(roundTrip).toEqual(settings);
    });

    it("is idempotent — saving twice yields the same state", async () => {
      const settings: Settings = {
        mode: "overlay",
        preset: "antique",
        params: PRESETS.antique,
        masterIntensity: 1,
      };

      await saveSettings(settings);
      await saveSettings(settings);

      const roundTrip = await loadSettings();
      expect(roundTrip).toEqual(settings);
    });
  });
});
