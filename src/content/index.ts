import { DEFAULT_SETTINGS } from "../shared/constants";
import type { Settings } from "../shared/types";

let currentSettings: Settings = { ...DEFAULT_SETTINGS, enabled: true };
let audioCtx: AudioContext | null = null;
let processorNode: ScriptProcessorNode | null = null;
let isMediaPlaying = false;

// --- DSP State ---
let bpY1 = 0, bpY2 = 0, bpX1 = 0, bpX2 = 0;
let dustBurstRemaining = 0;
let dustBurstAmplitude = 0;

// Band-pass filtered white noise (~1.5kHz center) simulating LP surface hiss
function generateSurfaceNoise(level: number, sr: number): number {
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
    (-b0 / a0) * bpX2 +
    (-a1 / a0) * bpY1 +
    (-a2 / a0) * bpY2;

  bpX2 = bpX1;
  bpX1 = white;
  bpY2 = bpY1;
  bpY1 = y;

  return y * level * 0.15;
}

// Poisson-distributed random impulses simulating vinyl clicks and pops
function generatePop(popsPerSec: number, sr: number): number {
  if (popsPerSec <= 0) return 0;

  const probability = popsPerSec / sr;
  if (Math.random() < probability) {
    const amplitude = 0.1 + Math.random() * 0.25;
    const sign = Math.random() > 0.5 ? 1 : -1;
    return amplitude * sign;
  }
  return 0;
}

// Short noise bursts simulating dust particles hitting the stylus
function generateDust(level: number, sr: number): number {
  if (level <= 0) return 0;

  if (dustBurstRemaining <= 0) {
    const burstProbability = level * 0.0005;
    if (Math.random() < burstProbability) {
      const durationMs = 1 + Math.random() * 4;
      dustBurstRemaining = Math.floor((durationMs / 1000) * sr);
      dustBurstAmplitude = 0.04 + Math.random() * 0.1;
    }
  }

  if (dustBurstRemaining > 0) {
    dustBurstRemaining--;
    const envelope = dustBurstRemaining > 10 ? 1 : dustBurstRemaining / 10;
    return (Math.random() * 2 - 1) * dustBurstAmplitude * envelope;
  }

  return 0;
}

function initAudio(): void {
  if (audioCtx) return;

  audioCtx = new AudioContext();
  const bufferSize = 2048;
  processorNode = audioCtx.createScriptProcessor(bufferSize, 0, 2);

  processorNode.onaudioprocess = (event) => {
    const outputL = event.outputBuffer.getChannelData(0);
    const outputR = event.outputBuffer.getChannelData(1);

    const { enabled, params, masterIntensity } = currentSettings;

    if (!enabled || !isMediaPlaying) {
      outputL.fill(0);
      outputR.fill(0);
      return;
    }

    const sr = audioCtx!.sampleRate;

    for (let i = 0; i < outputL.length; i++) {
      let sample = 0;
      sample += generateSurfaceNoise(params.surface, sr);
      sample += generatePop(params.popsPerSec, sr);
      sample += generateDust(params.dust, sr);
      sample *= masterIntensity;

      outputL[i] = sample;
      outputR[i] = sample;
    }
  };

  processorNode.connect(audioCtx.destination);
}

function checkMediaPlaying(): boolean {
  const elements = document.querySelectorAll<HTMLMediaElement>("audio, video");
  for (const el of elements) {
    if (!el.paused && !el.ended && el.readyState > 2) {
      return true;
    }
  }
  return false;
}

function startPlaybackMonitor(): void {
  setInterval(() => {
    isMediaPlaying = checkMediaPlaying();
  }, 500);

  document.addEventListener("play", (e) => {
    if (e.target instanceof HTMLMediaElement) {
      isMediaPlaying = true;
      ensureAudioRunning();
    }
  }, true);

  document.addEventListener("pause", () => {
    setTimeout(() => {
      isMediaPlaying = checkMediaPlaying();
    }, 300);
  }, true);

  document.addEventListener("ended", () => {
    isMediaPlaying = checkMediaPlaying();
  }, true);
}

function ensureAudioRunning(): void {
  initAudio();
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "UPDATE_SETTINGS" && message.payload) {
    currentSettings = message.payload as Settings;
    if (currentSettings.enabled) ensureAudioRunning();
    sendResponse({ success: true });
  }

  if (message.type === "GET_SETTINGS") {
    sendResponse({ success: true, settings: currentSettings });
  }

  if (message.type === "TOGGLE_ENABLED") {
    currentSettings.enabled = !currentSettings.enabled;
    if (currentSettings.enabled) ensureAudioRunning();
    sendResponse({ success: true, settings: currentSettings });
  }

  return true;
});

document.addEventListener("click", () => ensureAudioRunning(), { once: true, capture: true });
document.addEventListener("keydown", () => ensureAudioRunning(), { once: true, capture: true });

startPlaybackMonitor();

if (checkMediaPlaying()) {
  isMediaPlaying = true;
  initAudio();
}
