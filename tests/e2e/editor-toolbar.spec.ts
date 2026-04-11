import fs from 'fs';
import path from 'path';
import { test, expect } from '@playwright/test';
import { launchElectronApp, stopViteServer } from './electron-utils';

test('map editor canvas loads and toolbar shortcuts work', async () => {
  const projectRoot = path.join('C:', 'Users', 'Public', 'Documents', 'PlaywrightToolbarTest');
  const projectName = `Playwright Toolbar Test ${Date.now()}`;
  const projectPath = path.join(projectRoot, projectName);
  const mapFileName = `${projectName}.json`;

  if (!fs.existsSync(projectPath)) {
    fs.mkdirSync(projectPath, { recursive: true });
  }

  fs.writeFileSync(
    path.join(projectPath, 'settings.txt'),
    'description=Playwright toolbar test\ngame=flare-game\nversion=1.14\nengine_version_min=1.13.01\n',
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

    await expect(window.getByRole('button', { name: /Open Existing Project/i })).toBeVisible({ timeout: 15000 });
    await window.getByRole('button', { name: /Open Existing Project/i }).click();

    await expect(window.locator('canvas').first()).toBeVisible({ timeout: 15000 });

    const toolWrapper = window.getByLabel('Tool selection');
    await expect(toolWrapper).toBeVisible({ timeout: 15000 });

    const brushButton = toolWrapper.locator('button.tool-button').first();
    await brushButton.hover();

    const bucketButton = toolWrapper.locator('button.sub-tool-button').nth(1);
    await expect(bucketButton).toBeVisible({ timeout: 5000 });
    await bucketButton.click();
    await expect(brushButton.locator('svg.lucide-paint-bucket')).toBeVisible();

    await brushButton.hover();
    const eraserButton = toolWrapper.locator('button.sub-tool-button').nth(2);
    await expect(eraserButton).toBeVisible({ timeout: 5000 });
    await eraserButton.click();
    await expect(brushButton.locator('svg.lucide-eraser')).toBeVisible();
  } finally {
    await electronApp.close();
    await stopViteServer(viteProcess);
  }
});
