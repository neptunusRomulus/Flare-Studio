import fs from 'fs';
import os from 'os';
import path from 'path';
import { test, expect } from '@playwright/test';
import { launchElectronApp, stopViteServer, getAppWindow } from './electron-utils';

test.setTimeout(60000);

test('play dropdown opens and menu items are visible for a loaded project', async () => {
  const projectRoot = path.join(os.tmpdir(), 'PlaywrightPlayButtonTests');
  const projectName = `Playwright Play Test ${Date.now()}`;
  const projectPath = path.join(projectRoot, projectName);
  const mapFileName = `${projectName}.json`;

  if (!fs.existsSync(projectPath)) {
    fs.mkdirSync(projectPath, { recursive: true });
  }

  fs.writeFileSync(
    path.join(projectPath, 'settings.txt'),
    'description=Playwright play flow test\ngame=flare-game\nversion=1.14\nengine_version_min=1.13.01\n',
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

    const playButton = window.getByRole('button', { name: /^Play$/i }).first();
    await expect(playButton).toBeVisible({ timeout: 15000 });
    await playButton.click();

    const playCurrentMap = window.locator('button:has-text("Play Current Map")').first();
    const newGame = window.locator('button:has-text("New Game")').first();
    const mainMenu = window.locator('button:has-text("Flare Main Menu")').first();

    await expect(playCurrentMap).toBeVisible({ timeout: 15000 });
    await expect(newGame).toBeVisible({ timeout: 15000 });
    await expect(mainMenu).toBeVisible({ timeout: 15000 });

    await newGame.click();
    await expect(window.getByRole('button', { name: /Play Current Map/i })).toHaveCount(0, { timeout: 15000 });
  } finally {
    await electronApp.close();
    await stopViteServer(viteProcess);
  }
});
