import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CrackleEngine } from "./crackle-engine";
import type { CrackleParams } from "./types";

const SR = 48_000;
const ZERO_PARAMS: CrackleParams = { surface: 0, popsPerSec: 0, dust: 0 };

/**
 * Creates a seedable PRNG to make DSP output deterministic during tests.
 * Uses Mulberry32 (short, well-distributed, good enough for these unit tests).
 */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function renderBlock(
  engine: CrackleEngine,
  params: CrackleParams,
  masterIntensity: number,
  samples: number,
): Float32Array {
  const out = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    out[i] = engine.renderSample(params, masterIntensity, SR);
  }
  return out;
}

describe("CrackleEngine.renderSample", () => {
  let engine: CrackleEngine;

  beforeEach(() => {
    engine = new CrackleEngine();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("silence conditions", () => {
    it("returns 0 when all params are 0 and master is 0", () => {
      const out = renderBlock(engine, ZERO_PARAMS, 0, 1024);
      for (const s of out) expect(Math.abs(s)).toBe(0);
    });

    it("returns 0 when masterIntensity is 0 regardless of params", () => {
      vi.spyOn(Math, "random").mockImplementation(mulberry32(42));
      const params: CrackleParams = { surface: 1, popsPerSec: 40, dust: 1 };
      const out = renderBlock(engine, params, 0, 2048);
      // Use Math.abs to treat -0 and +0 as equivalent.
      for (const s of out) expect(Math.abs(s)).toBe(0);
    });

    it("returns 0 when all params are 0 even with max master", () => {
      vi.spyOn(Math, "random").mockImplementation(mulberry32(1));
      const out = renderBlock(engine, ZERO_PARAMS, 1, 2048);
      for (const s of out) expect(Math.abs(s)).toBe(0);
    });
  });

  describe("numerical safety", () => {
    it("never produces NaN or Infinity over a long render", () => {
      vi.spyOn(Math, "random").mockImplementation(mulberry32(7));
      const params: CrackleParams = { surface: 1, popsPerSec: 40, dust: 1 };
      const out = renderBlock(engine, params, 1, SR); // 1 second

      for (const s of out) {
        expect(Number.isFinite(s)).toBe(true);
      }
    });

    it("keeps output amplitude within a safe envelope", () => {
      // Target: no single sample exceeds master*something_reasonable.
      // The 3 components sum to at most ~(0.15 + ~0.35 + ~0.14) ≈ 0.64 before master,
      // so with master=1 we set a generous safety cap at 2.0.
      vi.spyOn(Math, "random").mockImplementation(mulberry32(13));
      const params: CrackleParams = { surface: 1, popsPerSec: 40, dust: 1 };
      const out = renderBlock(engine, params, 1, SR);

      for (const s of out) {
        expect(Math.abs(s)).toBeLessThan(2);
      }
    });
  });

  describe("actually produces signal", () => {
    it("surface-only rendering has non-zero mean-abs", () => {
      vi.spyOn(Math, "random").mockImplementation(mulberry32(99));
      const params: CrackleParams = { surface: 1, popsPerSec: 0, dust: 0 };
      const out = renderBlock(engine, params, 1, 4096);

      const meanAbs = out.reduce((a, b) => a + Math.abs(b), 0) / out.length;
      expect(meanAbs).toBeGreaterThan(0);
    });

    it("pop-only rendering fires impulses at roughly expected rate", () => {
      // With popsPerSec=40 and SR=48000, expected fires in 1s ≈ 40.
      // Allow a wide band [10, 120] to tolerate RNG variance across seeds.
      vi.spyOn(Math, "random").mockImplementation(mulberry32(2025));
      const params: CrackleParams = { surface: 0, popsPerSec: 40, dust: 0 };
      const out = renderBlock(engine, params, 1, SR);

      const impulseCount = out.reduce((n, v) => (v !== 0 ? n + 1 : n), 0);
      expect(impulseCount).toBeGreaterThan(10);
      expect(impulseCount).toBeLessThan(120);
    });

    it("pop impulses span both polarities", () => {
      vi.spyOn(Math, "random").mockImplementation(mulberry32(2026));
      const params: CrackleParams = { surface: 0, popsPerSec: 40, dust: 0 };
      const out = renderBlock(engine, params, 1, SR);

      const hasPositive = [...out].some((v) => v > 0);
      const hasNegative = [...out].some((v) => v < 0);
      expect(hasPositive).toBe(true);
      expect(hasNegative).toBe(true);
    });

    it("dust-only rendering emits bursts of consecutive non-zero samples", () => {
      vi.spyOn(Math, "random").mockImplementation(mulberry32(11));
      const params: CrackleParams = { surface: 0, popsPerSec: 0, dust: 1 };
      const out = renderBlock(engine, params, 1, SR);

      // Find longest run of consecutive non-zero samples; should be >= 1ms worth (~48)
      let longest = 0;
      let run = 0;
      for (const s of out) {
        if (s !== 0) {
          run++;
          if (run > longest) longest = run;
        } else {
          run = 0;
        }
      }
      expect(longest).toBeGreaterThan(20);
    });
  });

  describe("master intensity scales linearly", () => {
    it("output at master=0.5 is half of master=1.0 for same seed and state", () => {
      vi.spyOn(Math, "random").mockImplementation(mulberry32(777));

      const params: CrackleParams = { surface: 1, popsPerSec: 0, dust: 0 };
      const e1 = new CrackleEngine();
      const full = renderBlock(e1, params, 1, 256);

      vi.spyOn(Math, "random").mockImplementation(mulberry32(777));
      const e2 = new CrackleEngine();
      const half = renderBlock(e2, params, 0.5, 256);

      for (let i = 0; i < full.length; i++) {
        const f = full[i];
        const h = half[i];
        if (f === undefined || h === undefined) continue;
        expect(h).toBeCloseTo(f * 0.5, 10);
      }
    });
  });

  describe("determinism with seeded RNG", () => {
    it("produces identical output for identical seeds", () => {
      const params: CrackleParams = { surface: 0.5, popsPerSec: 10, dust: 0.3 };

      vi.spyOn(Math, "random").mockImplementation(mulberry32(12345));
      const a = renderBlock(new CrackleEngine(), params, 1, 1024);

      vi.spyOn(Math, "random").mockImplementation(mulberry32(12345));
      const b = renderBlock(new CrackleEngine(), params, 1, 1024);

      for (let i = 0; i < a.length; i++) {
        expect(b[i]).toBe(a[i]);
      }
    });
  });
});
