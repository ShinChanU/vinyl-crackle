/**
 * CrackleProcessor — AudioWorklet that generates vinyl crackle noise.
 *
 * Three noise components mixed together:
 * 1. Surface noise: band-filtered white noise (continuous "hiss")
 * 2. Clicks & pops: random impulses (sporadic "tick/pop")
 * 3. Dust particles: short noise bursts (brief "crackle")
 *
 * All parameters are controllable via AudioParam for real-time adjustment.
 */

const PARAM_DESCRIPTORS = [
  { name: "surface", defaultValue: 0.3, minValue: 0, maxValue: 1, automationRate: "k-rate" as const },
  { name: "popsPerSec", defaultValue: 6, minValue: 0, maxValue: 40, automationRate: "k-rate" as const },
  { name: "dust", defaultValue: 0.2, minValue: 0, maxValue: 1, automationRate: "k-rate" as const },
  { name: "masterIntensity", defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: "k-rate" as const },
  { name: "enabled", defaultValue: 1, minValue: 0, maxValue: 1, automationRate: "k-rate" as const },
];

class CrackleProcessor extends AudioWorkletProcessor {
  private dustBurstRemaining = 0;
  private dustBurstAmplitude = 0;

  // Simple band-pass state for surface noise (biquad coefficients)
  private bpY1 = 0;
  private bpY2 = 0;
  private bpX1 = 0;
  private bpX2 = 0;

  static get parameterDescriptors() {
    return PARAM_DESCRIPTORS;
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !output || input.length === 0) return true;

    const enabled = (parameters.enabled?.[0] ?? 1) > 0.5;
    if (!enabled) {
      for (let ch = 0; ch < output.length; ch++) {
        const inp = input[ch];
        const out = output[ch];
        if (inp && out) out.set(inp);
      }
      return true;
    }

    const surfaceLevel = parameters.surface?.[0] ?? 0.3;
    const popsRate = parameters.popsPerSec?.[0] ?? 6;
    const dustLevel = parameters.dust?.[0] ?? 0.2;
    const master = parameters.masterIntensity?.[0] ?? 0.5;

    const blockSize = output[0]?.length ?? 128;
    const crackleBuffer = new Float32Array(blockSize);

    for (let i = 0; i < blockSize; i++) {
      let sample = 0;

      // --- 1. Surface noise: band-pass filtered white noise ---
      sample += this.generateSurfaceNoise(surfaceLevel);

      // --- 2. Clicks & pops: random impulses ---
      sample += this.generatePop(popsRate, blockSize);

      // --- 3. Dust particles: short noise bursts ---
      sample += this.generateDust(dustLevel, blockSize);

      crackleBuffer[i] = sample * master;
    }

    // Mix crackle into all output channels
    for (let ch = 0; ch < output.length; ch++) {
      const inp = input[ch];
      const out = output[ch];
      if (!out) continue;

      for (let i = 0; i < blockSize; i++) {
        const dry = inp?.[i] ?? 0;
        out[i] = dry + crackleBuffer[i]!;
      }
    }

    return true;
  }

  /**
   * Band-pass filtered white noise simulating LP surface hiss.
   * Simple 2nd-order IIR band-pass centered around ~1.5kHz.
   */
  private generateSurfaceNoise(level: number): number {
    if (level <= 0) return 0;

    const white = Math.random() * 2 - 1;

    // Band-pass: center ~1500Hz, Q ~0.7 at 44100Hz
    const f0 = 1500 / sampleRate;
    const w0 = 2 * Math.PI * f0;
    const alpha = Math.sin(w0) / (2 * 0.7);
    const b0 = alpha;
    const a0 = 1 + alpha;
    const a1 = -2 * Math.cos(w0);
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

    return y * level * 0.08;
  }

  /**
   * Random impulses simulating vinyl clicks and pops.
   * Poisson-distributed timing with random amplitude.
   */
  private generatePop(popsPerSec: number, blockSize: number): number {
    if (popsPerSec <= 0) return 0;

    const probability = popsPerSec / sampleRate;
    if (Math.random() < probability) {
      const amplitude = 0.05 + Math.random() * 0.15;
      const sign = Math.random() > 0.5 ? 1 : -1;
      return amplitude * sign;
    }
    return 0;
  }

  /**
   * Short noise bursts simulating dust particles hitting the stylus.
   * Random-length bursts (1-5ms equivalent) with envelope.
   */
  private generateDust(level: number, blockSize: number): number {
    if (level <= 0) return 0;

    // Start a new dust burst randomly
    if (this.dustBurstRemaining <= 0) {
      const burstProbability = level * 0.0003;
      if (Math.random() < burstProbability) {
        const durationMs = 1 + Math.random() * 4;
        this.dustBurstRemaining = Math.floor((durationMs / 1000) * sampleRate);
        this.dustBurstAmplitude = 0.02 + Math.random() * 0.06;
      }
    }

    if (this.dustBurstRemaining > 0) {
      this.dustBurstRemaining--;
      const envelope = this.dustBurstRemaining > 10
        ? 1
        : this.dustBurstRemaining / 10;
      return (Math.random() * 2 - 1) * this.dustBurstAmplitude * envelope;
    }

    return 0;
  }
}

registerProcessor("crackle-processor", CrackleProcessor);
