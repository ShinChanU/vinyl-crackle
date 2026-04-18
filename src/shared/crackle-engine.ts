import type { CrackleParams } from "./types";

/**
 * Procedural LP crackle generator.
 *
 * Stateful per-instance (band-pass filter + dust burst) so one engine belongs
 * to one AudioContext / ScriptProcessorNode. Output is mono; caller copies to
 * stereo channels.
 */
export class CrackleEngine {
  private bpY1 = 0;
  private bpY2 = 0;
  private bpX1 = 0;
  private bpX2 = 0;
  private dustBurstRemaining = 0;
  private dustBurstAmplitude = 0;

  renderSample(params: CrackleParams, masterIntensity: number, sr: number): number {
    let sample = 0;
    sample += this.surface(params.surface, sr);
    sample += this.pop(params.popsPerSec, sr);
    sample += this.dust(params.dust, sr);
    return sample * masterIntensity;
  }

  // Band-pass filtered white noise (~1.5kHz center) = LP surface hiss
  private surface(level: number, sr: number): number {
    if (level <= 0) return 0;

    const white = Math.random() * 2 - 1;
    const f0 = 1500 / sr;
    const w0 = 2 * Math.PI * f0;
    const sinW0 = Math.sin(w0);
    const cosW0 = Math.cos(w0);
    const alpha = sinW0 / (2 * 0.7);

    const b0 = alpha;
    const a0 = 1 + alpha;
    const a1 = -2 * cosW0;
    const a2 = 1 - alpha;

    const y =
      (b0 / a0) * white +
      (-b0 / a0) * this.bpX2 +
      (-a1 / a0) * this.bpY1 +
      (-a2 / a0) * this.bpY2;

    this.bpX2 = this.bpX1;
    this.bpX1 = white;
    this.bpY2 = this.bpY1;
    this.bpY1 = y;

    return y * level * 0.15;
  }

  // Poisson impulses = clicks and pops
  private pop(popsPerSec: number, sr: number): number {
    if (popsPerSec <= 0) return 0;
    const probability = popsPerSec / sr;
    if (Math.random() < probability) {
      const amplitude = 0.1 + Math.random() * 0.25;
      const sign = Math.random() > 0.5 ? 1 : -1;
      return amplitude * sign;
    }
    return 0;
  }

  // Short noise bursts = dust particles
  private dust(level: number, sr: number): number {
    if (level <= 0) return 0;

    if (this.dustBurstRemaining <= 0) {
      const burstProbability = level * 0.0005;
      if (Math.random() < burstProbability) {
        const durationMs = 1 + Math.random() * 4;
        this.dustBurstRemaining = Math.floor((durationMs / 1000) * sr);
        this.dustBurstAmplitude = 0.04 + Math.random() * 0.1;
      }
    }

    if (this.dustBurstRemaining > 0) {
      this.dustBurstRemaining--;
      const envelope = this.dustBurstRemaining > 10 ? 1 : this.dustBurstRemaining / 10;
      return (Math.random() * 2 - 1) * this.dustBurstAmplitude * envelope;
    }

    return 0;
  }
}

/**
 * Attach a CrackleEngine to an AudioContext and return the handle.
 * Caller controls start/stop via the returned methods.
 */
export interface CrackleNodeHandle {
  ctx: AudioContext;
  node: ScriptProcessorNode;
  setMuted(muted: boolean): void;
  updateParams(params: CrackleParams, masterIntensity: number): void;
  dispose(): void;
}

export function createCrackleNode(bufferSize = 2048): CrackleNodeHandle {
  const ctx = new AudioContext();
  const node = ctx.createScriptProcessor(bufferSize, 0, 2);
  const engine = new CrackleEngine();

  let muted = true;
  let params: CrackleParams = { surface: 0, popsPerSec: 0, dust: 0 };
  let masterIntensity = 0;

  node.onaudioprocess = (event) => {
    const outL = event.outputBuffer.getChannelData(0);
    const outR = event.outputBuffer.getChannelData(1);

    if (muted) {
      outL.fill(0);
      outR.fill(0);
      return;
    }

    const sr = ctx.sampleRate;
    for (let i = 0; i < outL.length; i++) {
      const s = engine.renderSample(params, masterIntensity, sr);
      outL[i] = s;
      outR[i] = s;
    }
  };

  node.connect(ctx.destination);

  return {
    ctx,
    node,
    setMuted(next) {
      muted = next;
      if (!next && ctx.state === "suspended") void ctx.resume();
    },
    updateParams(nextParams, nextMaster) {
      params = nextParams;
      masterIntensity = nextMaster;
    },
    dispose() {
      try {
        node.disconnect();
      } catch {
        // ignore
      }
      void ctx.close();
    },
  };
}
