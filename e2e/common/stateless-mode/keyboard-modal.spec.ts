import { test, expect } from "@playwright/test";

test.describe("Modal keyboard interaction", () => {
  test("Theme modal: open with keyboard, Tab cycles inside, Escape closes, focus returns", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    // Focus the Appearance Settings trigger in the titlebar
    const trigger = page.getByRole("button", { name: /Appearance Settings/i });
    await trigger.focus();
    await expect(trigger).toBeFocused();

    // Activate with Enter — opens the modal
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Appearance Settings" });
    await expect(dialog).toBeVisible();

    // Tab cycles focus within the dialog — no descendant gets focus to the trigger
    // (which is behind the overlay). Press Tab several times and verify activeElement
    // stays inside the dialog.
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      const insideDialog = await page.evaluate(() => {
        const active = document.activeElement;
        const dlg = document.querySelector('[role="dialog"]');
        return !!(active && dlg && (dlg.contains(active) || active === dlg));
      });
      expect(insideDialog, `Tab #${i + 1} kept focus inside the dialog`).toBe(true);
    }

    // Escape closes the modal
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // Focus returns to the trigger
    await expect(trigger).toBeFocused();
  });
});
