import fs from 'fs';
import os from 'os';
import path from 'path';
import { test, expect } from '@playwright/test';
import { launchElectronApp, stopViteServer, getAppWindow } from './electron-utils';

test.setTimeout(60000);

test('item creation and item editing work from the items sidebar', async () => {
  const projectRoot = path.join(os.tmpdir(), 'PlaywrightItemEnemyTests');
  const projectName = `Playwright Item Test ${Date.now()}`;
  const projectPath = path.join(projectRoot, projectName);
  const mapFileName = `${projectName}.json`;

  if (!fs.existsSync(projectPath)) {
    fs.mkdirSync(projectPath, { recursive: true });
  }

  fs.writeFileSync(
    path.join(projectPath, 'settings.txt'),
    'description=Playwright item flow test\ngame=flare-game\nversion=1.14\nengine_version_min=1.13.01\n',
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
        name: 'Items',
        type: 'items',
        data: Array(16 * 16).fill(0),
        visible: true,
      },
      {
        id: 3,
        name: 'NPC',
        type: 'npc',
        data: Array(16 * 16).fill(0),
        visible: true,
      },
      {
        id: 4,
        name: 'Enemy',
        type: 'enemy',
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

    const itemsLayer = window.locator('div[role="button"]', { hasText: /^Items$/ }).first();
    await expect(itemsLayer).toBeVisible({ timeout: 15000 });
    await itemsLayer.click();

    const addItemButton = window.getByRole('button', { name: 'Add Item' });
    await expect(addItemButton).toBeVisible({ timeout: 15000 });
    await addItemButton.click();

    await expect(window.getByRole('heading', { name: /Add Item/i })).toBeVisible({ timeout: 15000 });
    const itemNameInput = window.locator('input[placeholder="Health Potion"]').first();
    await expect(itemNameInput).toBeVisible({ timeout: 15000 });
    await itemNameInput.fill('Test Item');

    const saveItemButton = window.getByRole('button', { name: 'Save item' });
    await expect(saveItemButton).toBeVisible({ timeout: 5000 });
    await saveItemButton.click();
    await expect(window.getByRole('heading', { name: /Add Item/i })).toHaveCount(0, { timeout: 15000 });

    const equipmentCategory = window.getByText('Equipment').first();
    await expect(equipmentCategory).toBeVisible({ timeout: 15000 });
    await equipmentCategory.click();

    const itemCard = window.getByText('Test Item').first();
    await expect(itemCard).toBeVisible({ timeout: 15000 });
    await itemCard.click();

    await expect(window.getByRole('heading', { name: /Edit Item:/i })).toBeVisible({ timeout: 15000 });
    const editNameInput = window.locator('div:has(label:text("Name")) input').first();
    await expect(editNameInput).toBeVisible({ timeout: 15000 });
    await editNameInput.fill('Test Item Edited');

    const editSaveButton = window.locator('button.bg-orange-500').first();
    await expect(editSaveButton).toBeVisible({ timeout: 5000 });
    await editSaveButton.click();

    await expect.poll(async () => {
      return await window.evaluate(() => document.body.innerText.includes('Test Item Edited'));
    }, { timeout: 15000 }).toBe(true);
  } finally {
    await electronApp.close();
    await stopViteServer(viteProcess);
  }
});

test('enemy creation and enemy editing work from the enemy sidebar', async () => {
  const projectRoot = path.join(os.tmpdir(), 'PlaywrightItemEnemyTests');
  const projectName = `Playwright Enemy Test ${Date.now()}`;
  const projectPath = path.join(projectRoot, projectName);
  const mapFileName = `${projectName}.json`;

  if (!fs.existsSync(projectPath)) {
    fs.mkdirSync(projectPath, { recursive: true });
  }

  fs.writeFileSync(
    path.join(projectPath, 'settings.txt'),
    'description=Playwright enemy flow test\ngame=flare-game\nversion=1.14\nengine_version_min=1.13.01\n',
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
        name: 'Enemy',
        type: 'enemy',
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

    const enemyLayer = window.locator('div[role="button"]', { hasText: /^Enemy$/ }).first();
    await expect(enemyLayer).toBeVisible({ timeout: 15000 });
    await enemyLayer.click();

    const addEnemyButton = window.getByRole('button', { name: 'Add Enemy' });
    await expect(addEnemyButton).toBeVisible({ timeout: 15000 });
    await addEnemyButton.click();

    const addEnemyDialog = window.locator('div:has(h3:has-text("Add Enemy"))').first();
    const nameInput = addEnemyDialog.locator('input[placeholder="Goblin Scout"]').first();
    await expect(nameInput).toBeVisible({ timeout: 15000 });
    await nameInput.fill('Test Enemy');

    const saveEnemyButton = addEnemyDialog.locator('button:has(svg)').nth(1);
    await expect(saveEnemyButton).toBeVisible({ timeout: 5000 });
    await saveEnemyButton.click();

    await expect(addEnemyDialog).toHaveCount(0, { timeout: 15000 });

    const enemyCard = window.getByText('Test Enemy').first();
    await expect(enemyCard).toBeVisible({ timeout: 15000 });
    await enemyCard.click();

    const editEnemyDialog = window.locator('div:has-text("Full Name")').first();
    const enemyNameInput = editEnemyDialog.locator('input[placeholder="e.g. Goblin Warrior"]').first();
    await expect(enemyNameInput).toBeVisible({ timeout: 15000 });
    await enemyNameInput.fill('Test Enemy Edited');

    const editSaveButton = window.locator('button[title="Save"]').first();
    await expect(editSaveButton).toBeVisible({ timeout: 5000 });
    await editSaveButton.scrollIntoViewIfNeeded();
    await editSaveButton.evaluate((button) => (button as HTMLButtonElement).click());

    await expect.poll(async () => {
      return await window.evaluate(() => document.body.innerText.includes('Test Enemy Edited'));
    }, { timeout: 15000 }).toBe(true);
  } finally {
    await electronApp.close();
    await stopViteServer(viteProcess);
  }
});
