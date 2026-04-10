import fs from 'fs';
import path from 'path';
import { test, expect, _electron as electron } from '@playwright/test';

test('sidebar save button saves the current project', async () => {
  const projectRoot = path.join('C:', 'Users', 'Public', 'Documents', 'PlaywrightSaveTest');
  const projectName = 'Playwright Save Test';
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

  const electronApp = await electron.launch({ args: ['.'] });

  try {
    await electronApp.evaluate(async ({ dialog }) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: ['C:\\Users\\Public\\Documents\\PlaywrightSaveTest\\Playwright Save Test'],
      });
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

    await expect(window.getByRole('button', { name: /Open Existing Project/i })).toBeVisible({ timeout: 15000 });
    await window.getByRole('button', { name: /Open Existing Project/i }).click();

    await expect(window.locator('canvas').first()).toBeVisible({ timeout: 15000 });

    const saveButton = window.locator('button:has(svg.lucide-save)').first();
    await expect(saveButton).toBeVisible({ timeout: 15000 });

    const canvas = window.locator('canvas').first();
    await canvas.click({ position: { x: 100, y: 100 }, force: true });
    await window.waitForTimeout(500);
    await window.evaluate(() => {
      window.focus();
      document.querySelector('canvas')?.focus();
    });
    await window.waitForTimeout(1000);

    await window.keyboard.press('Control+S');

    await window.waitForTimeout(2000);
    const afterContent = fs.readFileSync(mapFilePath, 'utf8');
    expect(afterContent).not.toBe(beforeContent);
  } finally {
    await electronApp.close();
  }
});
