import fs from 'fs';
import os from 'os';
import path from 'path';
import { test, expect } from '@playwright/test';
import { launchElectronApp, stopViteServer, getAppWindow } from './electron-utils';

test.setTimeout(60000);

test('runtime engine launch sets play button to running and passes correct launch options', async () => {
  const projectRoot = path.join(os.tmpdir(), 'PlaywrightFlareRuntimeLaunchTests');
  const projectName = `Playwright Engine Launch ${Date.now()}`;
  const projectPath = path.join(projectRoot, projectName);
  const mapFileName = `${projectName}.json`;

  if (!fs.existsSync(projectPath)) {
    fs.mkdirSync(projectPath, { recursive: true });
  }

  fs.writeFileSync(
    path.join(projectPath, 'settings.txt'),
    'description=Playwright flare engine launch test\ngame=flare-game\nversion=1.14\nengine_version_min=1.13.01\n',
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
    await electronApp.evaluate(async ({ dialog, ipcMain }, selectedPath) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selectedPath] });
      ipcMain.removeHandler('select-flare-exe');
      ipcMain.removeHandler('ensure-flare-mod-link');
      ipcMain.removeHandler('prepare-flare-quick-launch');
      ipcMain.removeHandler('launch-flare-engine');
      ipcMain.handle('select-flare-exe', async () => 'C:\\fake\\flare\\flare.exe');
      ipcMain.handle('ensure-flare-mod-link', async () => ({ success: true, junctionCreated: false }));
      ipcMain.handle('prepare-flare-quick-launch', async () => ({ success: true, slotNum: 1 }));
      ipcMain.handle('launch-flare-engine', async (_event, options) => {
        (global as any).__lastFlareLaunchOptions = options;
        return { success: true };
      });
    }, projectPath);

    const window = await getAppWindow(electronApp);
    await window.waitForLoadState('domcontentloaded');
    await window.waitForLoadState('load');

    await expect(window.getByRole('button', { name: /Open Existing Project/i })).toBeVisible({ timeout: 15000 });
    await window.getByRole('button', { name: /Open Existing Project/i }).click();

    await expect(window.locator('canvas').first()).toBeVisible({ timeout: 15000 });

    await window.evaluate(() => localStorage.removeItem('flarePath'));

    const playButton = window.getByRole('button', { name: /^Play$/i }).first();
    await expect(playButton).toBeVisible({ timeout: 15000 });
    await playButton.click();

    const newGameButton = window.locator('button:has-text("New Game")').first();
    await expect(newGameButton).toBeVisible({ timeout: 15000 });
    await newGameButton.click({ force: true });

    await expect(window.locator('button:has-text("Running")').first()).toBeVisible({ timeout: 15000 });

    const launchOptions = await electronApp.evaluate(async () => (global as any).__lastFlareLaunchOptions);
    expect(launchOptions).toBeTruthy();
    expect(typeof launchOptions.flarePath).toBe('string');
    expect(launchOptions.flarePath.length).toBeGreaterThan(0);
    expect(launchOptions.dataPath).toBeTruthy();
    expect(Array.isArray(launchOptions.mods)).toBe(true);
    expect(launchOptions.mods).toContain(projectName);
  } finally {
    try {
      await Promise.race([
        electronApp.close(),
        new Promise<void>((resolve) => setTimeout(resolve, 5000)),
      ]);
    } catch {
      // ignore cleanup failures
    }
    await stopViteServer(viteProcess);
  }
});
