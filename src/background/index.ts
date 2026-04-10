import { loadSettings, saveSettings } from "../shared/storage";
import type { Message, MessageResponse, Settings } from "../shared/types";

let cachedSettings: Settings | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

async function getSettings(): Promise<Settings> {
  if (!cachedSettings) {
    cachedSettings = await loadSettings();
  }
  return cachedSettings;
}

function debouncedSave(settings: Settings): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveSettings(settings).catch(() => {});
  }, 1000);
}

async function broadcastToContentScripts(settings: Settings): Promise<void> {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.id) continue;
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: "UPDATE_SETTINGS",
        payload: settings,
      });
    } catch {
      // Tab might not have content script injected
    }
  }
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

        case "UPDATE_SETTINGS": {
          const settings = message.payload as Settings;
          cachedSettings = settings;
          debouncedSave(settings);
          await broadcastToContentScripts(settings);
          sendResponse({ success: true, settings });
          break;
        }

        case "TOGGLE_ENABLED": {
          const settings = await getSettings();
          settings.enabled = !settings.enabled;
          cachedSettings = settings;
          debouncedSave(settings);
          await broadcastToContentScripts(settings);
          sendResponse({ success: true, settings });
          break;
        }
      }
    })();

    return true;
  }
);

chrome.runtime.onInstalled.addListener(async () => {
  await getSettings();
});
