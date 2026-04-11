import fs from 'fs';
import os from 'os';
import path from 'path';
import { test, expect } from '@playwright/test';
import { launchElectronApp, stopViteServer, getAppWindow } from './electron-utils';

test.setTimeout(60000);

test('engine settings dialog opens and display toggles can be used', async () => {
  const projectRoot = path.join(os.tmpdir(), 'PlaywrightEngineSettingsTests');
  const projectName = `Playwright Engine Settings Test ${Date.now()}`;
  const projectPath = path.join(projectRoot, projectName);
  const mapFileName = `${projectName}.json`;

  if (!fs.existsSync(projectPath)) {
    fs.mkdirSync(projectPath, { recursive: true });
  }

  fs.writeFileSync(
    path.join(projectPath, 'settings.txt'),
    'description=Playwright engine settings test\ngame=flare-game\nversion=1.14\nengine_version_min=1.13.01\n',
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

    await window.evaluate(() => {
      const sidebar = document.querySelector('div.flex.gap-2.justify-center');
      if (!sidebar) return;
      const buttons = Array.from(sidebar.querySelectorAll('button'));
      if (buttons.length >= 3) {
        buttons[2].click();
      }
    });

    const engineSettingsHeading = window.getByRole('heading', { name: /Engine Settings/i }).first();
    await expect(engineSettingsHeading).toBeVisible({ timeout: 15000 });

    await window.evaluate(() => {
      const label = Array.from(document.querySelectorAll('label')).find(el => el.textContent?.includes('Theme (Experimental)'));
      const section = label?.closest('div');
      const button = section?.querySelector('button');
      if (button) button.click();
    });

    await window.evaluate(() => {
      const label = Array.from(document.querySelectorAll('label')).find(el => el.textContent?.includes('Minimap View Mode'));
      const section = label?.closest('div');
      const button = section?.querySelector('button');
      if (button) button.click();
    });

    await expect(engineSettingsHeading).toBeVisible({ timeout: 15000 });
  } finally {
    await electronApp.close();
    await stopViteServer(viteProcess);
  }
});
