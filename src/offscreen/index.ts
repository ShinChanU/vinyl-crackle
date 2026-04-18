import { createCrackleNode, type CrackleNodeHandle } from "../shared/crackle-engine";
import type { Settings } from "../shared/types";

let handle: CrackleNodeHandle | null = null;

function applySettings(s: Settings): void {
  if (s.mode === "ambient") {
    if (!handle) handle = createCrackleNode();
    handle.updateParams(s.params, s.masterIntensity);
    handle.setMuted(false);
  } else if (handle) {
    handle.setMuted(true);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "SETTINGS_CHANGED" && message.payload) {
    applySettings(message.payload as Settings);
    sendResponse({ success: true });
  }
  return true;
});

async function init(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
    if (response?.settings) {
      applySettings(response.settings as Settings);
    }
  } catch {
    // service worker not ready
  }
}

void init();
