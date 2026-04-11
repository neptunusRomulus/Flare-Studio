import fs from 'fs';
import os from 'os';
import path from 'path';
import { test, expect } from '@playwright/test';
import { launchElectronApp, stopViteServer, getAppWindow } from './electron-utils';

test.setTimeout(60000);

test('engine settings persistence maintains toggles after reopening the dialog', async () => {
  const projectRoot = path.join(os.tmpdir(), 'PlaywrightEngineSettingsPersistenceTests');
  const projectName = `Playwright Engine Settings Persistence Test ${Date.now()}`;
  const projectPath = path.join(projectRoot, projectName);
  const mapFileName = `${projectName}.json`;

  if (!fs.existsSync(projectPath)) {
    fs.mkdirSync(projectPath, { recursive: true });
  }

  fs.writeFileSync(
    path.join(projectPath, 'settings.txt'),
    'description=Playwright engine settings persistence test\ngame=flare-game\nversion=1.14\nengine_version_min=1.13.01\n',
    'utf8'
  );

  const mapData = {
    name: projectName,
    width: 16,
    height: 16,
    tileSize: 16,
    layers: [
      {
        id: 1,
        name: 'Ground',
        type: 'background',
        data: Array(16 * 16).fill(0),
        visible: true,
      },
    ],
    tilesets: [],
    version: '1.0',
  };

  fs.writeFileSync(path.join(projectPath, mapFileName), JSON.stringify(mapData, null, 2), 'utf8');

  const { app: electronApp, viteProcess } = await launchElectronApp();

  try {
    await electronApp.evaluate(async ({ dialog }, selectedPath) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selectedPath] });
    }, projectPath);

    const window = await getAppWindow(electronApp);
    await window.waitForLoadState('domcontentloaded');
    await window.waitForLoadState('load');

    await expect(window.getByRole('button', { name: /Open Existing Project/i })).toBeVisible({ timeout: 15000 });
    await window.getByRole('button', { name: /Open Existing Project/i }).click();
    await expect(window.locator('canvas').first()).toBeVisible({ timeout: 15000 });

    // Open settings dialog
    await window.evaluate(() => {
      const sidebar = document.querySelector('div.flex.gap-2.justify-center');
      if (!sidebar) return;
      const buttons = Array.from(sidebar.querySelectorAll('button'));
      if (buttons.length >= 3) buttons[2].click();
    });

    const engineSettingsDialog = window.locator('div:has(h3:text("Engine Settings"))').first();
    const darkModeToggle = engineSettingsDialog.getByRole('button', { name: 'Toggle dark mode' }).first();
    const minimapToggle = engineSettingsDialog.getByRole('button', { name: 'Toggle Minimap View Mode' }).first();
    await expect(darkModeToggle).toBeVisible({ timeout: 15000 });
    await expect(minimapToggle).toBeVisible({ timeout: 15000 });

    const darkModeClassBefore = await darkModeToggle.evaluate((el) => el.className);
    const minimapClassBefore = await minimapToggle.evaluate((el) => el.className);

    await darkModeToggle.click();
    await minimapToggle.click();

    const closeButton = engineSettingsDialog.locator('button').first();
    await expect(closeButton).toBeVisible({ timeout: 15000 });
    await closeButton.click();

    await window.evaluate(() => {
      const sidebar = document.querySelector('div.flex.gap-2.justify-center');
      if (!sidebar) return;
      const buttons = Array.from(sidebar.querySelectorAll('button'));
      if (buttons.length >= 3) buttons[2].click();
    });

    const engineSettingsDialogAfter = window.locator('div:has(h3:text("Engine Settings"))').first();
    const darkModeToggleAfter = engineSettingsDialogAfter.getByRole('button', { name: 'Toggle dark mode' }).first();
    const minimapToggleAfter = engineSettingsDialogAfter.getByRole('button', { name: 'Toggle Minimap View Mode' }).first();
    await expect(darkModeToggleAfter).toBeVisible({ timeout: 15000 });
    await expect(minimapToggleAfter).toBeVisible({ timeout: 15000 });

    const darkModeClassAfter = await darkModeToggleAfter.evaluate((el) => el.className);
    const minimapClassAfter = await minimapToggleAfter.evaluate((el) => el.className);

    await expect(darkModeClassAfter).not.toBe(darkModeClassBefore);
    await expect(minimapClassAfter).not.toBe(minimapClassBefore);
  } finally {
    await electronApp.close();
    await stopViteServer(viteProcess);
  }
});
