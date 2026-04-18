import { PRESETS, PRESET_LABELS, PRESET_NAMES } from "../shared/presets";
import { DEFAULT_SETTINGS } from "../shared/constants";
import type { PlaybackMode, PresetName, Settings } from "../shared/types";

let settings: Settings = { ...DEFAULT_SETTINGS };

const presetsContainer = document.getElementById("presets")!;
const segmentedEl = document.getElementById("mode-segmented")!;
const hintEl = document.getElementById("mode-hint")!;
const surfaceSlider = document.getElementById("slider-surface") as HTMLInputElement;
const popsSlider = document.getElementById("slider-pops") as HTMLInputElement;
const dustSlider = document.getElementById("slider-dust") as HTMLInputElement;
const masterSlider = document.getElementById("slider-master") as HTMLInputElement;
const surfaceValue = document.getElementById("surface-value")!;
const popsValue = document.getElementById("pops-value")!;
const dustValue = document.getElementById("dust-value")!;
const masterValue = document.getElementById("master-value")!;

const MODE_HINTS: Record<PlaybackMode, string> = {
  off: "Crackle is disabled.",
  overlay: "Crackle overlays on top of media playback.",
  ambient: "Crackle plays on its own, no media required.",
};

function createPresetButtons(): void {
  presetsContainer.innerHTML = "";
  for (const name of PRESET_NAMES) {
    const btn = document.createElement("button");
    btn.className = "preset-btn";
    btn.dataset.preset = name;
    btn.textContent = PRESET_LABELS[name];
    btn.addEventListener("click", () => selectPreset(name));
    presetsContainer.appendChild(btn);
  }
}

function selectPreset(name: PresetName): void {
  settings.preset = name;
  settings.params = { ...PRESETS[name] };
  syncUI();
  pushSettings();
}

function selectMode(mode: PlaybackMode): void {
  if (settings.mode === mode) return;
  settings.mode = mode;
  syncUI();
  void chrome.runtime.sendMessage({ type: "SET_MODE", payload: { mode } }).catch(() => {});
}

function syncUI(): void {
  document.body.classList.toggle("mode-off", settings.mode === "off");

  segmentedEl.querySelectorAll<HTMLButtonElement>(".segment").forEach((btn) => {
    const active = btn.dataset.mode === settings.mode;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-checked", String(active));
  });
  hintEl.textContent = MODE_HINTS[settings.mode];

  document.querySelectorAll<HTMLButtonElement>(".preset-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.preset === settings.preset);
  });

  surfaceSlider.value = String(Math.round(settings.params.surface * 100));
  popsSlider.value = String(Math.round(settings.params.popsPerSec));
  dustSlider.value = String(Math.round(settings.params.dust * 100));
  masterSlider.value = String(Math.round(settings.masterIntensity * 100));

  surfaceValue.textContent = `${Math.round(settings.params.surface * 100)}%`;
  popsValue.textContent = `${Math.round(settings.params.popsPerSec)}/s`;
  dustValue.textContent = `${Math.round(settings.params.dust * 100)}%`;
  masterValue.textContent = `${Math.round(settings.masterIntensity * 100)}%`;
}

async function pushSettings(): Promise<void> {
  try {
    await chrome.runtime.sendMessage({
      type: "UPDATE_SETTINGS",
      payload: settings,
    });
  } catch {
    // service worker 미기동
  }
}

segmentedEl.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  const btn = target.closest<HTMLButtonElement>(".segment");
  if (!btn) return;
  const mode = btn.dataset.mode as PlaybackMode | undefined;
  if (mode) selectMode(mode);
});

surfaceSlider.addEventListener("input", () => {
  settings.params.surface = Number(surfaceSlider.value) / 100;
  surfaceValue.textContent = `${surfaceSlider.value}%`;
  pushSettings();
});

popsSlider.addEventListener("input", () => {
  settings.params.popsPerSec = Number(popsSlider.value);
  popsValue.textContent = `${popsSlider.value}/s`;
  pushSettings();
});

dustSlider.addEventListener("input", () => {
  settings.params.dust = Number(dustSlider.value) / 100;
  dustValue.textContent = `${dustSlider.value}%`;
  pushSettings();
});

masterSlider.addEventListener("input", () => {
  settings.masterIntensity = Number(masterSlider.value) / 100;
  masterValue.textContent = `${masterSlider.value}%`;
  pushSettings();
});

async function init(): Promise<void> {
  createPresetButtons();

  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
    if (response?.settings) settings = response.settings;
  } catch {
    // 기본값 사용
  }

  syncUI();
}

void init();
