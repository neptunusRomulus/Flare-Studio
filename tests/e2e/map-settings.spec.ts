import fs from 'fs';
import os from 'os';
import path from 'path';
import { test, expect } from '@playwright/test';
import { launchElectronApp, stopViteServer, getAppWindow } from './electron-utils';

test.setTimeout(60000);

test('new map creation and map settings editing work from the title bar', async () => {
  const projectRoot = path.join(os.tmpdir(), 'PlaywrightMapSettingsTests');
  const projectName = `Playwright Map Settings Test ${Date.now()}`;
  const projectPath = path.join(projectRoot, projectName);
  const mapFileName = `${projectName}.json`;

  if (!fs.existsSync(projectPath)) {
    fs.mkdirSync(projectPath, { recursive: true });
  }

  fs.writeFileSync(
    path.join(projectPath, 'settings.txt'),
    'description=Playwright map settings test\ngame=flare-game\nversion=1.14\nengine_version_min=1.13.01\n',
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

    const mapSettingsButton = window.locator('button[aria-label="Edit Map Settings"]').first();
    await expect(mapSettingsButton).toBeVisible({ timeout: 15000 });
    await mapSettingsButton.click();

    const mapSettingsDialog = window.getByRole('heading', { name: new RegExp(`Map Settings - ${projectName}`) }).first();
    await expect(mapSettingsDialog).toBeVisible({ timeout: 15000 });

    const mapSettingsNameInput = window.locator('input[placeholder="Enter map name"]').first();
    await expect(mapSettingsNameInput).toBeVisible({ timeout: 5000 });
    await mapSettingsNameInput.fill('Playwright Map 2 Edited');

    const saveButton = window.getByRole('button', { name: 'Save map settings' }).first();
    await expect(saveButton).toBeVisible({ timeout: 5000 });
    await saveButton.click();

    await expect(window.getByRole('button', { name: /Playwright Map 2 Edited/i })).toBeVisible({ timeout: 15000 });
  } finally {
    await electronApp.close();
    await stopViteServer(viteProcess);
  }
});
