import fs from 'fs';
import os from 'os';
import path from 'path';
import { test, expect } from '@playwright/test';
import { launchElectronApp, stopViteServer, getAppWindow } from './electron-utils';

test.setTimeout(60000);

test('create map dialog opens and new map tab appears after creating a map', async () => {
  const projectRoot = path.join(os.tmpdir(), 'PlaywrightMapCreateTests');
  const projectName = `Playwright Map Create Test ${Date.now()}`;
  const projectPath = path.join(projectRoot, projectName);
  const mapFileName = `${projectName}.json`;

  if (!fs.existsSync(projectPath)) {
    fs.mkdirSync(projectPath, { recursive: true });
  }

  fs.writeFileSync(
    path.join(projectPath, 'settings.txt'),
    'description=Playwright map create test\ngame=flare-game\nversion=1.14\nengine_version_min=1.13.01\n',
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

    const createNewMapButton = window.getByRole('button', { name: /Create new map/i }).first();
    await expect(createNewMapButton).toBeVisible({ timeout: 15000 });
    await createNewMapButton.click();

    const createMapDialog = window.locator('div:has(h3:text("Create Map"))').first();
    await expect(createMapDialog).toBeVisible({ timeout: 15000 });

    const mapNameInput = createMapDialog.locator('input[placeholder="Enter map name"]').first();
    await expect(mapNameInput).toBeVisible({ timeout: 15000 });
    await mapNameInput.fill('Created Map Test');

    const widthInput = createMapDialog.locator('input[type="number"]').nth(0);
    const heightInput = createMapDialog.locator('input[type="number"]').nth(1);
    await expect(widthInput).toBeVisible({ timeout: 5000 });
    await expect(heightInput).toBeVisible({ timeout: 5000 });
    await widthInput.fill('24');
    await heightInput.fill('18');

    const createButton = createMapDialog.getByRole('button', { name: 'Create' }).first();
    await expect(createButton).toBeVisible({ timeout: 5000 });
    await createButton.click();

    const createdMapTab = window.locator('button', { hasText: /Created[_ ]Map[_ ]Test/i }).first();
    await expect(createdMapTab).toBeVisible({ timeout: 15000 });
  } finally {
    await electronApp.close();
    await stopViteServer(viteProcess);
  }
});
