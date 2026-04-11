import fs from 'fs';
import path from 'path';
import { test, expect, type ElectronApplication } from '@playwright/test';
import { launchElectronApp, stopViteServer, getAppWindow } from './electron-utils';

async function safeCloseElectronApp(app: ElectronApplication | null): Promise<void> {
  if (!app) return;
  try {
    await Promise.race([
      app.close(),
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Electron app close timeout')), 5000)),
    ]);
  } catch {
    try {
      await app.close();
    } catch {
      // swallow final close errors
    }
  }
}

test('save workflow and data persistence across reloads', async () => {
  const projectRoot = path.join('C:', 'Users', 'Public', 'Documents', 'PlaywrightSaveTest');
  const projectName = `Playwright Save Test ${Date.now()}`;
  const projectPath = path.join(projectRoot, projectName);
  const mapFileName = `${projectName}.json`;

  if (!fs.existsSync(projectPath)) {
    fs.mkdirSync(projectPath, { recursive: true });
  }

  const settingsPath = path.join(projectPath, 'settings.txt');
  fs.writeFileSync(
    settingsPath,
    'description=Playwright save test\ngame=flare-game\nversion=1.14\nengine_version_min=1.13.01\n',
    'utf8'
  );

  const mapData = {
    name: projectName,
    isStartingMap: true,
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
  const mapFilePath = path.join(projectPath, mapFileName);
  fs.writeFileSync(mapFilePath, JSON.stringify(mapData, null, 2), 'utf8');
  const beforeContent = fs.readFileSync(mapFilePath, 'utf8');

  const { app: electronApp, viteProcess } = await launchElectronApp();
  let reopenedApp: typeof electronApp | null = null;

  try {
    await electronApp.evaluate(async ({ dialog }, selectedPath) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [selectedPath],
      });
    }, projectPath);

    const window = await getAppWindow(electronApp);
    await window.waitForLoadState('domcontentloaded');
    await window.waitForLoadState('load');

    const isElectron = await window.evaluate(() => navigator.userAgent.includes('Electron'));
    expect(isElectron).toBe(true);

    await expect(window.getByRole('button', { name: /Open Existing Project/i })).toBeVisible({ timeout: 15000 });
    await window.getByRole('button', { name: /Open Existing Project/i }).click();

    await expect(window.locator('canvas').first()).toBeVisible({ timeout: 15000 });

    const editMapSettingsButton = window.locator('button[aria-label="Edit Map Settings"]');
    await expect(editMapSettingsButton).toBeVisible({ timeout: 15000 });
    await editMapSettingsButton.click();

    const newMapName = `${projectName} RENAMED`;
    const mapNameInput = window.locator('input[placeholder="Enter map name"]');
    const mapWidthInput = window.locator('label:has-text("Map Width") + input');
    const mapHeightInput = window.locator('label:has-text("Map Height") + input');

    await expect(mapNameInput).toBeVisible({ timeout: 15000 });
    await expect(mapWidthInput).toBeVisible({ timeout: 15000 });
    await expect(mapHeightInput).toBeVisible({ timeout: 15000 });

    await mapNameInput.fill(newMapName);
    await mapWidthInput.fill('17');
    await mapHeightInput.fill('17');

    const saveSettingsButton = window.getByLabel('Save map settings');
    await expect(saveSettingsButton).toBeVisible({ timeout: 15000 });
    await saveSettingsButton.click();

    const canvas = window.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15000 });
    await canvas.click({ position: { x: 120, y: 120 }, force: true });

    const saveProjectButton = window.getByRole('button', { name: /Save project/i });
    await expect(saveProjectButton).toBeVisible({ timeout: 15000 });
    await saveProjectButton.click();
    await window.waitForTimeout(2000);

    const sanitizedMapName = newMapName.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_').replace(/_{2,}/g, '_').trim() || 'map';
    const renamedMapFileName = `${sanitizedMapName}.json`;
    const renamedMapFilePath = path.join(projectPath, renamedMapFileName);

    expect(fs.existsSync(renamedMapFilePath)).toBe(true);
    const afterContent = fs.readFileSync(renamedMapFilePath, 'utf8');
    expect(afterContent).not.toBe(beforeContent);
    expect(afterContent).toContain('"width": 17');
    expect(afterContent).toContain(`"name": "${newMapName}"`);

    const beforeCanvas = await canvas.screenshot();

    await electronApp.close();

    const reopenResult = await launchElectronApp();
    reopenedApp = reopenResult.app;
    await reopenedApp.evaluate(async ({ dialog }, selectedPath) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [selectedPath],
      });
    }, projectPath);

    const reopened = await getAppWindow(reopenedApp);
    await reopened.waitForLoadState('domcontentloaded');
    await reopened.waitForLoadState('load');

    const reopenedIsElectron = await reopened.evaluate(() => navigator.userAgent.includes('Electron'));
    expect(reopenedIsElectron).toBe(true);

    const openExistingButton = reopened.getByRole('button', { name: /Open Existing Project/i });
    if (await openExistingButton.count() > 0 && await openExistingButton.isVisible()) {
      await openExistingButton.click();
    }

    const reopenedTabButton = reopened.getByRole('button', { name: newMapName });
    await expect(reopenedTabButton).toBeVisible({ timeout: 15000 });

    const saveIndicator = reopened.locator('button[aria-label="Save project"] + span');
    await expect(saveIndicator).toHaveCount(0);

    const reopenedCanvas = reopened.locator('canvas').first();
    await expect(reopenedCanvas).toBeVisible({ timeout: 30000 });

    const afterReloadContent = fs.readFileSync(renamedMapFilePath, 'utf8');
    expect(afterReloadContent).toBe(afterContent);
  } finally {
    await safeCloseElectronApp(reopenedApp, 'reopenedApp');
    await safeCloseElectronApp(electronApp, 'electronApp');
    await stopViteServer(viteProcess);
  }
});
