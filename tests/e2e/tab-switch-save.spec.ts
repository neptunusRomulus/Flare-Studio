import fs from 'fs';
import os from 'os';
import path from 'path';
import { test, expect } from '@playwright/test';
import { launchElectronApp, stopViteServer, getAppWindow } from './electron-utils';

test.setTimeout(60000);

test('switching map tabs saves the previous map and reloads data on the target tab', async () => {
  const projectRoot = path.join(os.tmpdir(), 'PlaywrightTabSwitchSaveTests');
  const projectName = `PlaywrightTabSwitchSave${Date.now()}`;
  const projectPath = path.join(projectRoot, projectName);
  const initialMapName = projectName;
  const secondMapName = 'SecondMap';
  const secondMapFile = path.join(projectPath, `${secondMapName}.json`);

  if (!fs.existsSync(projectPath)) {
    fs.mkdirSync(projectPath, { recursive: true });
  }

  fs.writeFileSync(
    path.join(projectPath, `${initialMapName}.json`),
    JSON.stringify({
      name: initialMapName,
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
        {
          id: 2,
          name: 'NPC',
          type: 'npc',
          data: Array(16 * 16).fill(0),
          visible: true,
        },
      ],
      tilesets: [],
      version: '1.0',
    }, null, 2),
    'utf8'
  );

  fs.writeFileSync(
    path.join(projectPath, 'settings.txt'),
    'description=Playwright tab switch save test\ngame=flare-game\nversion=1.14\nengine_version_min=1.13.01\n',
    'utf8'
  );

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

    const createNewMapButton = window.getByRole('button', { name: /Create new map/i }).first();
    await expect(createNewMapButton).toBeVisible({ timeout: 15000 });
    await createNewMapButton.click();

    const createMapDialog = window.locator('div:has(h3:has-text("Create Map"))').first();
    await expect(createMapDialog).toBeVisible({ timeout: 15000 });

    const mapNameInput = createMapDialog.locator('input[placeholder="Enter map name"]');
    await expect(mapNameInput).toBeVisible({ timeout: 5000 });
    await mapNameInput.fill(secondMapName);

    const widthInput = createMapDialog.locator('input[type="number"]').nth(0);
    const heightInput = createMapDialog.locator('input[type="number"]').nth(1);
    await expect(widthInput).toBeVisible({ timeout: 5000 });
    await expect(heightInput).toBeVisible({ timeout: 5000 });
    await widthInput.fill('16');
    await heightInput.fill('16');

    const createButton = createMapDialog.getByRole('button', { name: 'Create' }).first();
    await expect(createButton).toBeVisible({ timeout: 5000 });
    await createButton.click();

    const secondMapTab = window.locator('div:has(button:has-text("SecondMap"))').first();
    await expect(secondMapTab).toBeVisible({ timeout: 15000 });

    const editMapSettingsButton = window.locator('button[aria-label="Edit Map Settings"]').first();
    await expect(editMapSettingsButton).toBeVisible({ timeout: 15000 });
    await editMapSettingsButton.click();

    const mapSettingsDialog = window.locator('div:has(h3:has-text("Map Settings - SecondMap"))').first();
    await expect(mapSettingsDialog).toBeVisible({ timeout: 15000 });

    const widthInputField = mapSettingsDialog.locator('input[type="number"]').nth(0);
    await expect(widthInputField).toBeVisible({ timeout: 5000 });
    await widthInputField.fill('18');

    const saveSettingsButton = mapSettingsDialog.locator('button[aria-label="Save map settings"]').first();
    await expect(saveSettingsButton).toBeVisible({ timeout: 5000 });
    await saveSettingsButton.click();
    await expect(mapSettingsDialog).toHaveCount(0, { timeout: 15000 });

    const firstMapTabButton = window.locator('button', { hasText: new RegExp(`${initialMapName}`, 'i') }).first();
    await expect(firstMapTabButton).toBeVisible({ timeout: 15000 });
    await firstMapTabButton.click();

    expect(fs.existsSync(secondMapFile)).toBe(true);
    const secondMapJson = JSON.parse(fs.readFileSync(secondMapFile, 'utf8'));
    expect(secondMapJson.width).toBe(18);

    await secondMapTab.click();
    await expect(window.locator('button', { hasText: new RegExp(`${secondMapName}`, 'i') })).toBeVisible({ timeout: 15000 });
  } finally {
    await electronApp.close();
    await stopViteServer(viteProcess);
  }
});
