import { test, expect, _electron as electron } from '@playwright/test';

test('create new project flow and transition into the editor', async () => {
  const electronApp = await electron.launch({ args: ['.'] });

  try {
    await electronApp.evaluate(async ({ dialog }) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: ['C:\\Users\\Public\\Documents\\PlaywrightTest'] });
    });

    const appWindow = async () => {
      const existing = electronApp.windows().find((w) => {
        const url = w.url();
        return url && !url.startsWith('devtools://') && !url.startsWith('about:blank');
      });
      if (existing) return existing;

      while (true) {
        const next = await electronApp.waitForEvent('window');
        const url = next.url();
        if (url && !url.startsWith('devtools://') && !url.startsWith('about:blank')) {
          return next;
        }
      }
    };

    const window = await appWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.waitForLoadState('load');

    await expect(window.getByRole('button', { name: /Create New Project/i })).toBeVisible({ timeout: 15000 });
  await window.getByRole('button', { name: /Create New Project/i }).click();

  await expect(window.getByRole('heading', { name: /Create a New Flare Project/i })).toBeVisible();

  await window.locator('input[placeholder="Enter map name"]').fill('Playwright Test Project');

  const folderButton = window.locator('input[placeholder="Select folder for your project"] + button');
  await expect(folderButton).toHaveCount(1);
  await folderButton.click({ force: true });

  await expect(window.locator('input[placeholder="Select folder for your project"]')).toHaveValue(/PlaywrightTest/);

  await window.getByRole('button', { name: /Confirm/i }).click();

  await expect(window.getByRole('heading', { name: /Create a New Flare Project/i })).toHaveCount(0);
  await expect(window.getByRole('button', { name: /Confirm/i })).toHaveCount(0);
  } finally {
    await electronApp.close();
  }
});
