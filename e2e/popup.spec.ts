import { test, expect } from "./fixtures";

/**
 * Smoke tests for the extension popup. Verifies that the popup renders,
 * that core controls exist, and that clicking a mode persists via
 * chrome.storage.sync.
 */
test.describe("popup smoke", () => {
  test("renders title and all three mode buttons", async ({
    context,
    extensionId,
  }) => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup/index.html`);

    await expect(popup.locator(".title")).toHaveText("Vinyl Crackle");

    const modes = popup.locator('[data-mode]');
    await expect(modes).toHaveCount(3);
    await expect(popup.locator('[data-mode="off"]')).toBeVisible();
    await expect(popup.locator('[data-mode="overlay"]')).toBeVisible();
    await expect(popup.locator('[data-mode="ambient"]')).toBeVisible();
  });

  test("renders the fine-tune sliders and master slider", async ({
    context,
    extensionId,
  }) => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup/index.html`);

    await expect(popup.locator("#slider-surface")).toBeVisible();
    await expect(popup.locator("#slider-pops")).toBeVisible();
    await expect(popup.locator("#slider-dust")).toBeVisible();
    await expect(popup.locator("#slider-master")).toBeVisible();
  });

  test("clicking Ambient persists mode='ambient' to storage", async ({
    context,
    extensionId,
  }) => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup/index.html`);

    await popup.locator('[data-mode="ambient"]').click();

    // Give the popup a moment to dispatch the storage write.
    await popup.waitForTimeout(400);

    const stored = await popup.evaluate(async () => {
      const result = await chrome.storage.sync.get("vinylCrackleSettings");
      return result["vinylCrackleSettings"];
    });

    expect(stored).toMatchObject({ mode: "ambient" });
  });

  test("switching from ambient back to off persists mode='off'", async ({
    context,
    extensionId,
  }) => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup/index.html`);

    // First leave the default 'off' state, then return to it — the popup
    // short-circuits clicks on the currently-active mode.
    await popup.locator('[data-mode="ambient"]').click();
    await popup.waitForTimeout(400);
    await popup.locator('[data-mode="off"]').click();
    await popup.waitForTimeout(400);

    const stored = await popup.evaluate(async () => {
      const result = await chrome.storage.sync.get("vinylCrackleSettings");
      return result["vinylCrackleSettings"];
    });

    expect(stored).toMatchObject({ mode: "off" });
  });

  test("reopening the popup retains the last-selected mode", async ({
    context,
    extensionId,
  }) => {
    // First open: click overlay
    const first = await context.newPage();
    await first.goto(`chrome-extension://${extensionId}/popup/index.html`);
    await first.locator('[data-mode="overlay"]').click();
    await first.waitForTimeout(400);
    await first.close();

    // Second open: the overlay button should be marked as checked
    const second = await context.newPage();
    await second.goto(`chrome-extension://${extensionId}/popup/index.html`);

    await expect(second.locator('[data-mode="overlay"]')).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});
