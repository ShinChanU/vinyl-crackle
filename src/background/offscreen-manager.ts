import { OFFSCREEN_URL } from "../shared/constants";

async function hasDocument(): Promise<boolean> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT" as chrome.runtime.ContextType],
  });
  return contexts.length > 0;
}

export async function ensureDocument(): Promise<void> {
  if (await hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ["AUDIO_PLAYBACK" as chrome.offscreen.Reason],
    justification: "Play standalone vinyl crackle ambient sound.",
  });
}

export async function closeDocument(): Promise<void> {
  if (!(await hasDocument())) return;
  try {
    await chrome.offscreen.closeDocument();
  } catch {
    // already closing/closed
  }
}
