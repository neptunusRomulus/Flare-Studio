import fs from 'fs';
import os from 'os';
import path from 'path';
import { test, expect } from '@playwright/test';
import { launchElectronApp, stopViteServer, getAppWindow } from './electron-utils';

test.setTimeout(60000);

test('item group creation saves a loot table .txt file', async () => {
  const projectRoot = path.join(os.tmpdir(), 'PlaywrightLootGroupTests');
  const projectName = `Playwright Loot Group Test ${Date.now()}`;
  const projectPath = path.join(projectRoot, projectName);
  const mapFileName = `${projectName}.json`;

  if (!fs.existsSync(projectPath)) {
    fs.mkdirSync(projectPath, { recursive: true });
  }

  fs.writeFileSync(
    path.join(projectPath, 'settings.txt'),
    'description=Playwright loot group flow test\ngame=flare-game\nversion=1.14\nengine_version_min=1.13.01\n',
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
    const itemNameInput = window.locator('input[placeholder="ex. Iron Helmet"]').first();
    await expect(itemNameInput).toBeVisible({ timeout: 15000 });
    await itemNameInput.fill('Health Potion');

    const saveItemButton = window.getByRole('button', { name: 'Save item' });
    await expect(saveItemButton).toBeVisible({ timeout: 5000 });
    await saveItemButton.click();
    await expect(window.getByRole('heading', { name: /Add Item/i })).toHaveCount(0, { timeout: 15000 });

    await addItemButton.click();
    await expect(window.getByRole('heading', { name: /Add Item/i })).toBeVisible({ timeout: 15000 });
    const lootGroupButton = window.getByRole('button', { name: 'Item Groups' }).first();
    await expect(lootGroupButton).toBeVisible({ timeout: 15000 });
    await lootGroupButton.click();

    const groupNameInput = window.locator('input[placeholder="ex. Iron Helmet"]').first();
    await expect(groupNameInput).toBeVisible({ timeout: 15000 });
    await groupNameInput.fill('Loot Chest');

    await expect(saveItemButton).toBeVisible({ timeout: 5000 });
    await saveItemButton.click();
    await expect(window.getByRole('heading', { name: /Add Item/i })).toHaveCount(0, { timeout: 15000 });

    const lootGroupHeader = window.locator('div', { hasText: /Item Groups/ }).first();
    await expect(lootGroupHeader).toBeVisible({ timeout: 15000 });
    await lootGroupHeader.click({ force: true });

    const lootGroupCard = window.locator('button', { hasText: 'Loot Chest' }).first();
    await expect(lootGroupCard).toBeVisible({ timeout: 15000 });
    await lootGroupCard.scrollIntoViewIfNeeded();
    await lootGroupCard.evaluate((node: HTMLElement) => node.click());

    await expect(window.getByRole('button', { name: /Save Item Group/i })).toBeVisible({ timeout: 15000 });
    const searchInput = window.locator('input[placeholder="Search by ID, name, category"]').first();
    await expect(searchInput).toBeVisible({ timeout: 15000 });
    await searchInput.fill('Health');

    const lootRow = window.locator('tr', { hasText: 'Health Potion' }).first();
    await expect(lootRow).toBeVisible({ timeout: 15000 });
    const rowCheckbox = lootRow.locator('input[type="checkbox"]').first();
    await rowCheckbox.click({ force: true });

    const quantityInput = lootRow.locator('input[placeholder="1"]').first();
    await expect(quantityInput).toBeVisible({ timeout: 5000 });
    await quantityInput.fill('2');

    const saveLootGroupButton = window.getByRole('button', { name: /Save Item Group/i }).first();
    await saveLootGroupButton.click();
    await expect(window.getByRole('button', { name: /Save Item Group/i })).toHaveCount(0, { timeout: 15000 });

    const lootFilePath = path.join(projectPath, 'mods', 'default', 'loot', 'loot_chest.txt');
    await expect.poll(() => fs.existsSync(lootFilePath), { timeout: 15000 }).toBe(true);
    const lootFileContent = fs.readFileSync(lootFilePath, 'utf8');
    expect(lootFileContent).toContain('id=loot_chest');
    expect(lootFileContent).toContain('name=Loot Chest');
    expect(lootFileContent).toContain('[loot]');
    expect(lootFileContent).toContain('id=1');
    expect(lootFileContent).toContain('quantity=2');
  } finally {
    await electronApp.close();
    await stopViteServer(viteProcess);
  }
});
