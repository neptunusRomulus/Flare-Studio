import fs from 'fs';
import os from 'os';
import path from 'path';
import { test, expect } from '@playwright/test';
import { launchElectronApp, stopViteServer, getAppWindow } from './electron-utils';

test.setTimeout(60000);

test('event can be placed on the map canvas by dragging from the event sidebar', async () => {
  const projectRoot = path.join(os.tmpdir(), 'PlaywrightEventPlacementTests');
  const projectName = `Playwright Event Placement ${Date.now()}`;
  const projectPath = path.join(projectRoot, projectName);
  const mapFileName = `${projectName}.json`;

  if (!fs.existsSync(projectPath)) {
    fs.mkdirSync(projectPath, { recursive: true });
  }

  fs.writeFileSync(
    path.join(projectPath, 'settings.txt'),
    'description=Playwright event placement test\ngame=flare-game\nversion=1.14\nengine_version_min=1.13.01\n',
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
        name: 'Event',
        type: 'event',
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

    const eventLayer = window.locator('div[role="button"]', { hasText: /^Event$/ }).first();
    await expect(eventLayer).toBeVisible({ timeout: 15000 });
    await eventLayer.click();

    const addEventButton = window.getByRole('button', { name: 'Add Event' });
    await expect(addEventButton).toBeVisible({ timeout: 15000 });
    await addEventButton.click();

    const addEventDialog = window.locator('div:has(h3:has-text("Add Event"))').first();
    await expect(addEventDialog).toBeVisible({ timeout: 15000 });

    const nameInput = addEventDialog.locator('input[placeholder="Event Name (e.g. Teleport to Town, Boss Trigger)"]');
    await expect(nameInput).toBeVisible({ timeout: 15000 });
    await nameInput.fill('Drag Event Test');

    const saveEventButton = addEventDialog.locator('button:has(svg)').last();
    await expect(saveEventButton).toBeVisible({ timeout: 5000 });
    await saveEventButton.click();

    await expect(addEventDialog).toHaveCount(0, { timeout: 15000 });

    const eventEntry = window.locator('div.w-full.box-border.rounded-md', { hasText: 'Drag Event Test' }).first();
    await expect(eventEntry).toBeVisible({ timeout: 15000 });

    const dragHandle = eventEntry.locator('div[draggable="true"]').first();
    const canvas = window.locator('canvas').first();

    await dragHandle.dragTo(canvas, { force: true });

    await expect(eventEntry).toHaveClass(/bg-background\/50/, { timeout: 15000 });
  } finally {
    await electronApp.close();
    await stopViteServer(viteProcess);
  }
});
