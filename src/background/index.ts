import { loadSettings, saveSettings } from "../shared/storage";
import type {
  Message,
  MessageResponse,
  PlaybackMode,
  Settings,
} from "../shared/types";
import { closeDocument, ensureDocument } from "./offscreen-manager";

let cachedSettings: Settings | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

async function getSettings(): Promise<Settings> {
  if (!cachedSettings) cachedSettings = await loadSettings();
  return cachedSettings;
}

function debouncedSave(settings: Settings): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveSettings(settings).catch(() => {});
  }, 1000);
}

async function broadcastSettings(settings: Settings): Promise<void> {
  const msg = { type: "SETTINGS_CHANGED", payload: settings };

  try { await chrome.runtime.sendMessage(msg); } catch { /* no receiver */ }

  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.id) continue;
    try { await chrome.tabs.sendMessage(tab.id, msg); } catch { /* 미주입 탭 */ }
  }
}

const BADGE_BY_MODE: Record<PlaybackMode, { text: string; bg: string; fg: string }> = {
  off: { text: "○", bg: "#2a2a2a", fg: "#9ca3af" },
  overlay: { text: "◐", bg: "#2a2a2a", fg: "#c97d3a" },
  ambient: { text: "●", bg: "#2a2a2a", fg: "#c97d3a" },
};

async function updateBadge(mode: PlaybackMode): Promise<void> {
  try {
    const badge = BADGE_BY_MODE[mode];
    await chrome.action.setBadgeText({ text: badge.text });
    await chrome.action.setBadgeBackgroundColor({ color: badge.bg });
    if (chrome.action.setBadgeTextColor) {
      await chrome.action.setBadgeTextColor({ color: badge.fg });
    }
  } catch {
    // ignore
  }
}

async function syncOffscreen(mode: PlaybackMode): Promise<void> {
  if (mode === "ambient") {
    await ensureDocument();
  } else {
    await closeDocument();
  }
  await updateBadge(mode);
}

async function applyMode(next: Settings): Promise<void> {
  cachedSettings = next;
  await saveSettings(next);
  await syncOffscreen(next.mode);
  await broadcastSettings(next);
}

async function applyParams(next: Settings): Promise<void> {
  cachedSettings = next;
  debouncedSave(next);
  await broadcastSettings(next);
}

chrome.runtime.onMessage.addListener(
  (message: Message, _sender, sendResponse: (resp: MessageResponse) => void) => {
    (async () => {
      switch (message.type) {
        case "GET_SETTINGS": {
          const settings = await getSettings();
          sendResponse({ success: true, settings });
          break;
        }

        case "SET_MODE": {
          const payload = message.payload as { mode: PlaybackMode };
          const current = await getSettings();
          const next: Settings = { ...current, mode: payload.mode };
          await applyMode(next);
          sendResponse({ success: true, settings: next });
          break;
        }

        case "UPDATE_SETTINGS": {
          const next = message.payload as Settings;
          const current = await getSettings();
          if (current.mode !== next.mode) {
            await applyMode(next);
          } else {
            await applyParams(next);
          }
          sendResponse({ success: true, settings: next });
          break;
        }
      }
    })();

    return true;
  }
);

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await getSettings();
  await syncOffscreen(settings.mode);
});

chrome.runtime.onStartup.addListener(async () => {
  const settings = await getSettings();
  await syncOffscreen(settings.mode);
});
