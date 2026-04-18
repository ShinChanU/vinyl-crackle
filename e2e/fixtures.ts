import { test as base, chromium, type BrowserContext } from "@playwright/test";
import path from "node:path";

// Playwright compiles specs as CJS; resolve against process.cwd() (repo root)
// rather than import.meta.url so this works without ESM-specific shims.
const extensionPath = path.resolve(process.cwd(), "dist");

/**
 * Fixture that boots Chromium with the built extension loaded.
 *
 * Chrome extensions require a non-headless, persistent context. `--headless=new`
 * supports extensions; classic headless does not. We also capture the service
 * worker so tests can address the extension via its ID.
 */
export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    // IMPORTANT: do NOT pass Playwright's `headless: true` — it forces the
    // legacy headless mode which cannot load extensions. Instead pass
    // `--headless=new` via args so Chromium runs in the new headless mode
    // that supports MV3 service workers.
    const context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [
        "--headless=new",
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });

    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    // MV3 service workers start lazily. Poll for up to ~10s, and as a
    // fallback scrape chrome://extensions for the generated ID.
    const start = Date.now();
    let id: string | undefined;
    while (Date.now() - start < 10_000) {
      const [sw] = context.serviceWorkers();
      if (sw) {
        id = sw.url().split("/")[2];
        if (id) break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    if (!id) {
      // Try nudging the SW to start by opening the extensions page.
      const probe = await context.newPage();
      await probe.goto("chrome://extensions");
      await probe.close();
      const sw =
        context.serviceWorkers()[0] ??
        (await context.waitForEvent("serviceworker", { timeout: 10_000 }));
      id = sw.url().split("/")[2];
    }

    if (!id) throw new Error("Failed to derive extension id from SW url");
    await use(id);
  },
});

export const expect = test.expect;
