import { DEFAULT_SETTINGS } from "../shared/constants";
import { createCrackleNode, type CrackleNodeHandle } from "../shared/crackle-engine";
import type { Message, Settings } from "../shared/types";

let settings: Settings = { ...DEFAULT_SETTINGS };
let handle: CrackleNodeHandle | null = null;
let isMediaPlaying = false;

function ensureHandle(): CrackleNodeHandle {
  if (!handle) handle = createCrackleNode();
  handle.updateParams(settings.params, settings.masterIntensity);
  return handle;
}

function applyOutput(): void {
  const shouldOverlay = settings.mode === "overlay" && isMediaPlaying;

  if (shouldOverlay) {
    const h = ensureHandle();
    h.updateParams(settings.params, settings.masterIntensity);
    h.setMuted(false);
  } else if (handle) {
    handle.setMuted(true);
  }
}

function checkMediaPlaying(): boolean {
  const elements = document.querySelectorAll<HTMLMediaElement>("audio, video");
  for (const el of elements) {
    if (!el.paused && !el.ended && el.readyState > 2) return true;
  }
  return false;
}

function refreshMediaState(): void {
  const next = checkMediaPlaying();
  if (next !== isMediaPlaying) {
    isMediaPlaying = next;
    applyOutput();
  }
}

function startPlaybackMonitor(): void {
  setInterval(refreshMediaState, 500);

  document.addEventListener(
    "play",
    (e) => {
      if (e.target instanceof HTMLMediaElement) {
        isMediaPlaying = true;
        applyOutput();
      }
    },
    true
  );

  document.addEventListener(
    "pause",
    () => {
      setTimeout(refreshMediaState, 300);
    },
    true
  );

  document.addEventListener("ended", refreshMediaState, true);
}

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  if (message.type === "SETTINGS_CHANGED" || message.type === "UPDATE_SETTINGS") {
    settings = message.payload as Settings;
    if (handle) handle.updateParams(settings.params, settings.masterIntensity);
    applyOutput();
    sendResponse({ success: true });
  }
  return true;
});

async function init(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
    if (response?.settings) settings = response.settings as Settings;
  } catch {
    // service worker not ready
  }

  startPlaybackMonitor();
  isMediaPlaying = checkMediaPlaying();
  applyOutput();
}

void init();
