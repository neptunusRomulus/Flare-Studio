import fs from 'fs';
import os from 'os';
import path from 'path';
import { test, expect } from '@playwright/test';
import { launchElectronApp, stopViteServer, getAppWindow } from './electron-utils';

test.setTimeout(60000);

test('actor can be placed on the map canvas by dragging from the NPC sidebar', async () => {
  const projectRoot = path.join(os.tmpdir(), 'PlaywrightActorPlacementTests');
  const projectName = `Playwright Actor Placement ${Date.now()}`;
  const projectPath = path.join(projectRoot, projectName);
  const mapFileName = `${projectName}.json`;

  if (!fs.existsSync(projectPath)) {
    fs.mkdirSync(projectPath, { recursive: true });
  }

  fs.writeFileSync(
    path.join(projectPath, 'settings.txt'),
    'description=Playwright actor placement test\ngame=flare-game\nversion=1.14\nengine_version_min=1.13.01\n',
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

    const showSidebarButton = window.getByRole('button', { name: /Show sidebar/i });
    if (await showSidebarButton.count() > 0) {
      await showSidebarButton.click();
    }

    const npcLayer = window.locator('div[role="button"]', { hasText: /^NPC$/ }).first();
    await expect(npcLayer).toBeVisible({ timeout: 15000 });
    await npcLayer.click();

    const addNpcButton = window.getByRole('button', { name: 'Add NPC' });
    await expect(addNpcButton).toBeVisible({ timeout: 15000 });
    await addNpcButton.click();

    // Inline draft row: type the name, tick to create, then drag the new entry to the map.
    const nameInput = window.getByLabel('New NPC name');
    await expect(nameInput).toBeVisible({ timeout: 15000 });
    await nameInput.fill('Drag NPC Test');

    const createButton = window.getByRole('button', { name: 'Create NPC' });
    await expect(createButton).toBeVisible({ timeout: 5000 });
    await createButton.click();
    await expect(nameInput).toHaveCount(0, { timeout: 15000 });

    const npcEntry = window.locator('div.w-full.box-border.rounded-md', { hasText: 'Drag NPC Test' }).first();
    await expect(npcEntry).toBeVisible({ timeout: 15000 });

    const canvas = window.locator('canvas').first();
    // Dragging anywhere on the NPC row places an instance on the map.
    await npcEntry.dragTo(canvas, { force: true });

    await expect(npcEntry).toHaveClass(/bg-background\/50/, { timeout: 15000 });
  } finally {
    await electronApp.close();
    await stopViteServer(viteProcess);
  }
});
