import { PRESETS, PRESET_LABELS, PRESET_NAMES } from "../shared/presets";
import { DEFAULT_SETTINGS } from "../shared/constants";
import type { PresetName, Settings } from "../shared/types";

let settings: Settings = { ...DEFAULT_SETTINGS };

const toggleEl = document.getElementById("toggle-enabled") as HTMLInputElement;
const presetsContainer = document.getElementById("presets")!;
const surfaceSlider = document.getElementById("slider-surface") as HTMLInputElement;
const popsSlider = document.getElementById("slider-pops") as HTMLInputElement;
const dustSlider = document.getElementById("slider-dust") as HTMLInputElement;
const masterSlider = document.getElementById("slider-master") as HTMLInputElement;
const surfaceValue = document.getElementById("surface-value")!;
const popsValue = document.getElementById("pops-value")!;
const dustValue = document.getElementById("dust-value")!;
const masterValue = document.getElementById("master-value")!;

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

function syncUI(): void {
  toggleEl.checked = settings.enabled;
  document.body.classList.toggle("disabled", !settings.enabled);

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
    // Service worker might not be ready
  }
}

toggleEl.addEventListener("change", () => {
  settings.enabled = toggleEl.checked;
  syncUI();
  pushSettings();
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
    if (response?.settings) {
      settings = response.settings;
    }
  } catch {
    // Use defaults
  }

  syncUI();
}

init();
