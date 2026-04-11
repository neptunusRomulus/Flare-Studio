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

    const dialogHeading = window.getByRole('heading', { name: /Add NPC/i });
    await expect(dialogHeading).toBeVisible({ timeout: 15000 });

    const nameInput = window.getByPlaceholder('Village Elder');
    await expect(nameInput).toBeVisible({ timeout: 15000 });
    await nameInput.fill('Drag NPC Test');

    const dialogRoot = window.locator('div', { has: dialogHeading }).first();
    const saveButton = dialogRoot.locator('button:has(svg.lucide-save)').first();
    await expect(saveButton).toBeVisible({ timeout: 5000 });
    await saveButton.click();
    await expect(dialogRoot).toHaveCount(0, { timeout: 15000 });

    const npcEntry = window.locator('div.w-full.box-border.rounded-md', { hasText: 'Drag NPC Test' }).first();
    await expect(npcEntry).toBeVisible({ timeout: 15000 });

    const dragHandle = npcEntry.locator('div[draggable="true"]').first();
    const canvas = window.locator('canvas').first();
    await dragHandle.dragTo(canvas, { force: true });

    await expect(npcEntry).toHaveClass(/bg-background\/50/, { timeout: 15000 });
  } finally {
    await electronApp.close();
    await stopViteServer(viteProcess);
  }
});
