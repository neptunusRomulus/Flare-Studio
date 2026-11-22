import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import {
  closeGuiProject,
  closeStudioWindow,
  createGuiProject,
  expectStudioWindow,
  launchGuiProject,
  openPane,
  openRailTarget,
  railGroup,
  sidebarCard,
  type GuiProject,
} from './gui-test-fixture';

/**
 * GUI Test Listesi (vault) — bölüm bazlı otomasyon.
 *
 * Her test kendi geçici projesini açar. Electron'u AGENTS gereği burada
 * çalıştırmıyoruz; dosya oluşturur, çalıştırma komutunu rapora yazarız.
 * Flare yolu / gerçek motor gerektiren maddeler bu pakette değil; aşağıdaki
 * "kapsam" notuna ve Playwright dışı birim testlerine bakılır.
 */

test.setTimeout(120_000);
test.describe.configure({ mode: 'serial' });

let session: Awaited<ReturnType<typeof launchGuiProject>>;
let project: GuiProject;

test.beforeEach(async () => {
  project = createGuiProject('gui-checklist');
  session = await launchGuiProject(project);
});

test.afterEach(async () => {
  await closeGuiProject(session?.app, session?.viteProcess);
});

test('sağ ray grupları, Tab/Shift+Tab, Items ve Localization', async () => {
  const { window } = session;
  const sidebar = window.getByLabel('Sidebar', { exact: true });

  for (const group of ['Map', 'Entities', 'Content', 'Settings', 'Character']) {
    await expect(sidebar.locator(`[aria-label="${group}"]`)).toBeVisible({ timeout: 15_000 });
  }

  await openRailTarget(window, 'Settings', 'UI Settings');
  await expect(sidebarCard(window)).toContainText('UI Settings');

  await window.keyboard.press('Tab');
  await expect(window.getByRole('radio', { name: 'World Settings', exact: true }))
    .toHaveAttribute('aria-checked', 'true');

  await window.keyboard.press('Shift+Tab');
  await expect(window.getByRole('radio', { name: 'Titles', exact: true }))
    .toHaveAttribute('aria-checked', 'true');

  await window.keyboard.press('Escape');
  await expect(sidebarCard(window)).toHaveAttribute('aria-hidden', 'true');

  await openRailTarget(window, 'Content', 'Items');
  await expect(sidebarCard(window).getByRole('button', { name: 'Add Item', exact: true })).toBeVisible();

  await openRailTarget(window, 'Settings', 'UI Settings');
  await sidebarCard(window).getByRole('button', { name: 'Localization', exact: true }).click();
  await expect(window.getByText('Localization', { exact: true }).first()).toBeVisible();
  await expect(window.getByRole('button', { name: 'Add language', exact: true })).toBeVisible();
});

test('Map ikonunda Ctrl+tık katmanı gizler ve geri açar', async () => {
  const { window } = session;
  const ground = railGroup(window, 'Map').getByRole('radio', { name: 'Ground', exact: true });

  await expect(ground).toBeVisible();
  await ground.click({ modifiers: ['Control'] });
  await expect(ground).toHaveClass(/opacity-40/);

  await ground.click({ modifiers: ['Control'] });
  await expect(ground).not.toHaveClass(/opacity-40/);
});

test('Titles, Stats, Power Tree ve Statuses', async () => {
  const { window } = session;

  await openRailTarget(window, 'Character', 'Titles');
  await expect(sidebarCard(window).getByText('Titles', { exact: true }).first()).toBeVisible();
  await sidebarCard(window).getByRole('button', { name: 'Add title', exact: true }).click();
  await expect(window.getByLabel('Title 1')).toBeVisible();

  await openRailTarget(window, 'Character', 'Stats');
  await expect(sidebarCard(window).getByText('Stats', { exact: true }).first()).toBeVisible();
  for (const pane of ['Combat', 'Damage types', 'XP', 'Classes', 'Appearance', 'Equip flags']) {
    await openPane(window, pane);
    if (pane === 'Appearance') {
      await expect(sidebarCard(window).getByText('Step sounds', { exact: true })).toBeVisible();
      await expect(sidebarCard(window).getByRole('button', { name: 'Body', exact: true })).toBeVisible();
    }
  }

  await openPane(window, 'Stats');
  await sidebarCard(window).getByText('Advanced sprite sections', { exact: true }).click();
  await expect(sidebarCard(window).getByLabel('Advanced sprite sections')).toBeVisible();

  await openRailTarget(window, 'Character', 'Power Tree');
  await expect(sidebarCard(window).getByLabel('Tree file path')).toBeVisible();
  await expect(sidebarCard(window).getByText('Power tree', { exact: true }).first()).toBeVisible();

  await openRailTarget(window, 'Content', 'Statuses');
  await expect(sidebarCard(window).getByLabel('Search powers')).toBeVisible();
  await sidebarCard(window).getByRole('button', { name: 'New', exact: true }).click();
  await expect(window.getByRole('button', { name: /Blank Skill/ })).toBeVisible();
});

test('UI Settings ve World Settings sekmeleri', async () => {
  const { window } = session;

  await openRailTarget(window, 'Settings', 'UI Settings');
  const ui = sidebarCard(window);
  for (const pane of [
    'General', 'Fonts', 'Colors', 'Tooltips', 'Resolutions', 'Combat text', 'Number format',
    'Icons', 'Backgrounds', 'Cursor', 'Widgets', 'Defaults', 'Subtitles',
  ]) {
    await openPane(window, pane);
  }
  await openPane(window, 'General');
  await expect(ui.getByText('Tile Size', { exact: true })).toBeVisible();
  await expect(ui.getByText('Game data', { exact: true })).toBeVisible();

  await openRailTarget(window, 'Settings', 'World Settings');
  const world = sidebarCard(window);
  for (const pane of ['Gameplay', 'Misc', 'Death penalty', 'Music', 'Loot', 'World']) {
    await openPane(window, pane);
  }
  for (const text of ['Cutscenes', 'Parallax', 'Fog of war', 'Procedural rules']) {
    await expect(world.getByText(text, { exact: true }).first()).toBeVisible();
  }
});

test('Engine data pencereleri (files, tree, items, animations, status, mod, test save)', async () => {
  const { window } = session;

  await openRailTarget(window, 'Settings', 'UI Settings');
  const card = sidebarCard(window);
  const windows: Array<[button: string, title: string]> = [
    ['Game files', 'Game files'],
    ['Power tree', 'Power tree'],
    ['Types, qualities, sets', 'Item types, qualities and sets'],
    ['Animations', 'Animations'],
    ['Status tracking', 'Status tracking'],
    ['Mod settings', 'Mod settings'],
    ['Test save', 'Test save'],
  ];

  for (const [button, title] of windows) {
    await card.getByRole('button', { name: button, exact: true }).click();
    const studioWindow = await expectStudioWindow(window, title);
    await closeStudioWindow(studioWindow);
  }
});

test('Books: sayfa blokları ve eski "Save as preset" yok', async () => {
  const { window } = session;

  await openRailTarget(window, 'Content', 'Books');
  await sidebarCard(window).getByRole('button', { name: 'Book', exact: true }).click();
  await sidebarCard(window).getByPlaceholder('Title').fill('GUI Test Book');
  await sidebarCard(window).getByRole('button', { name: 'Create', exact: true }).click();
  await window.keyboard.press('Escape');

  const editor = window.getByRole('button', { name: 'Text', exact: true })
    .locator('xpath=ancestor::div[contains(@class,"absolute inset-0")]').first();
  await expect(editor.getByRole('button', { name: 'Text', exact: true })).toBeVisible();
  await editor.getByRole('button', { name: 'Text', exact: true }).click();
  await expect(editor.getByLabel('text x')).toBeVisible();

  await editor.getByRole('button', { name: 'Image', exact: true }).click();
  await expect(editor.getByLabel('image x')).toBeVisible();

  await editor.getByRole('button', { name: 'Button', exact: true }).click();
  await expect(editor.getByLabel('button x')).toBeVisible();

  await editor.locator('button:has(svg.lucide-save)').last().click();
  const booksDir = path.join(project.projectPath, 'books');
  await expect.poll(() => {
    if (!fs.existsSync(booksDir)) return '';
    return fs.readdirSync(booksDir)
      .map((name) => fs.readFileSync(path.join(booksDir, name), 'utf8'))
      .join('\n');
  }, { timeout: 15_000 }).toContain('[text]');

  await expect(window.getByText('Save as preset', { exact: true })).toHaveCount(0);
});

test('kirli logo noktası Save ile temizlenir', async () => {
  const { window } = session;

  await openRailTarget(window, 'Character', 'Titles');
  await sidebarCard(window).getByRole('button', { name: 'Add title', exact: true }).click();
  await expect(window.getByRole('img', { name: 'Unsaved changes' })).toBeVisible();

  await window.getByRole('button', { name: 'Menu', exact: true }).click();
  const menuRoot = window.getByRole('button', { name: 'Save & Quit Project', exact: true }).locator('xpath=../..');
  await menuRoot.getByRole('button', { name: 'Save', exact: true }).click();

  await expect.poll(async () => window.getByRole('img', { name: 'Unsaved changes' }).count(), {
    timeout: 15_000,
  }).toBe(0);
  await expect(window.getByRole('img', { name: 'Saved' })).toHaveCount(0);
});

test('Number format ayarları kaydedilir', async () => {
  const { window } = session;

  await openRailTarget(window, 'Settings', 'UI Settings');
  await openPane(window, 'Number format');
  const card = sidebarCard(window);
  await expect(card.getByLabel('Player health and mana')).toBeVisible();
  await expect(card.getByLabel('Death penalty')).toBeVisible();

  await card.getByLabel('Combat numbers').fill('1');
  await card.getByRole('button', { name: 'Save', exact: true }).click();

  const file = path.join(project.projectPath, 'engine/number_format.txt');
  await expect.poll(() => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''), {
    timeout: 15_000,
  }).toContain('combat_text=1');
});

test('Map background_color ayarlanır ve kaydedilir', async () => {
  const { window } = session;

  const mapSettingsButton = window.locator('button[aria-label="Edit Map Settings"]').first();
  await expect(mapSettingsButton).toBeVisible();
  await mapSettingsButton.click();

  const background = window.getByLabel('Background color', { exact: true });
  await expect(background).toBeVisible();
  await background.fill('10,20,30,255');
  await window.getByRole('button', { name: 'Save map settings', exact: true }).click();

  await window.getByRole('button', { name: 'Menu', exact: true }).click();
  const menuRoot = window.getByRole('button', { name: 'Save & Quit Project', exact: true }).locator('xpath=../..');
  await menuRoot.getByRole('button', { name: 'Save', exact: true }).click();

  const mapsDir = path.join(project.projectPath, 'maps');
  await expect.poll(() => {
    if (!fs.existsSync(mapsDir)) return '';
    return fs.readdirSync(mapsDir)
      .filter((name) => name.endsWith('.txt'))
      .map((name) => fs.readFileSync(path.join(mapsDir, name), 'utf8'))
      .join('\n');
  }, { timeout: 15_000 }).toContain('background_color=10,20,30,255');

  await mapSettingsButton.click();
  await expect(window.getByLabel('Background color', { exact: true })).toHaveValue('10,20,30,255');
});

test('Random map listesi oluşturulur ve kaydedilir', async () => {
  const { window } = session;

  await openRailTarget(window, 'Settings', 'World Settings');
  const section = window.getByLabel('Random map lists', { exact: true });
  await expect(section).toBeVisible();

  await section.getByRole('button', { name: 'New list', exact: true }).click();
  await section.getByLabel('New list name').fill('caves');
  await section.getByRole('button', { name: 'Create', exact: true }).click();

  await section.getByRole('button', { name: 'Add map', exact: true }).click();
  await section.getByLabel('Map 1', { exact: true }).fill('maps/cave.txt');
  await section.getByLabel('Map 1 x', { exact: true }).fill('3');
  await section.getByLabel('Map 1 y', { exact: true }).fill('4');
  await section.getByRole('button', { name: 'Save', exact: true }).click();

  const file = path.join(project.projectPath, 'maps/random/lists/caves.txt');
  await expect.poll(() => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''), {
    timeout: 15_000,
  }).toContain('map=maps/cave.txt,3,4');
});

test('Orthogonal ve özel karo boyutu yazılır', async () => {
  const { window } = session;

  await openRailTarget(window, 'Settings', 'UI Settings');
  const card = sidebarCard(window);
  await card.getByText('Advanced tile settings', { exact: true }).click();
  await card.getByLabel('Tile orientation').click();
  await window.getByRole('option', { name: 'Orthogonal', exact: true }).click();
  await card.getByLabel('Tile width').fill('64');
  await card.getByLabel('Tile height').fill('64');
  await card.getByRole('button', { name: 'Apply custom size', exact: true }).click();
  await window.getByRole('button', { name: 'Confirm', exact: true }).click();

  const file = path.join(project.projectPath, 'engine/tileset_config.txt');
  await expect.poll(() => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''), {
    timeout: 15_000,
  }).toContain('orientation=orthogonal');
  await expect.poll(() => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''), {
    timeout: 15_000,
  }).toContain('tile_size=64,64');
});

test('Tileset animasyonu oluşturulur ve kaydedilir', async () => {
  const { window } = session;

  await openRailTarget(window, 'Settings', 'UI Settings');
  await sidebarCard(window).getByRole('button', { name: 'Tileset animations', exact: true }).click();
  const studioWindow = await expectStudioWindow(window, 'Tileset animations');

  await studioWindow.getByRole('button', { name: 'New tileset', exact: true }).click();
  await studioWindow.getByLabel('New tileset name').fill('ruins');
  await studioWindow.getByRole('button', { name: 'Create', exact: true }).click();

  await studioWindow.getByRole('button', { name: 'Animation', exact: true }).click();
  await studioWindow.getByLabel('Animation 1 tile', { exact: true }).fill('192');
  await studioWindow.getByRole('button', { name: 'Add frame', exact: true }).click();
  await studioWindow.getByLabel('Animation 1 frame 1 x', { exact: true }).fill('1536');
  await studioWindow.getByLabel('Animation 1 frame 1 y', { exact: true }).fill('192');
  await studioWindow.getByLabel('Animation 1 frame 1 duration', { exact: true }).fill('250ms');
  await studioWindow.getByRole('button', { name: 'Add frame', exact: true }).click();
  await studioWindow.getByLabel('Animation 1 frame 2 x', { exact: true }).fill('1536');
  await studioWindow.getByLabel('Animation 1 frame 2 y', { exact: true }).fill('960');
  await studioWindow.getByLabel('Animation 1 frame 2 duration', { exact: true }).fill('250ms');
  await studioWindow.getByRole('button', { name: 'Save', exact: true }).click();

  const file = path.join(project.projectPath, 'tilesetdefs/ruins.txt');
  await expect.poll(() => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''), {
    timeout: 15_000,
  }).toContain('animation=192;1536,192,250ms;1536,960,250ms;');
});

test('Menü ortak anahtarları (align, background, ses, enabled) kaydedilir', async () => {
  const { window } = session;

  await openRailTarget(window, 'Settings', 'UI Settings');
  await window.keyboard.press('Escape');
  await window.getByRole('button', { name: 'Health bar', exact: true }).click();

  await window.getByLabel('Menu alignment').click();
  await window.getByRole('option', { name: 'Center', exact: true }).click();
  await window.getByLabel('Menu background', { exact: true }).fill('images/menus/test.png');
  await window.getByLabel('Menu open sound', { exact: true }).fill('soundfx/open.ogg');
  await window.getByLabel('Menu close sound', { exact: true }).fill('soundfx/close.ogg');
  await window.getByLabel('Menu enabled').click();
  await window.getByLabel('Hide after seconds').fill('12');
  await window.getByLabel('Fill image', { exact: true }).fill('images/menus/hp.png');
  await window.getByLabel('Bar orientation').click();
  await window.getByRole('option', { name: 'Vertical', exact: true }).click();
  await window.getByLabel('Show bar when empty').click();
  await window.locator('button:has(svg.lucide-save)').last().click();

  const file = path.join(project.projectPath, 'menus/hp.txt');
  await expect.poll(() => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''), {
    timeout: 15_000,
  }).toContain('align=center');
  await expect.poll(() => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''), {
    timeout: 15_000,
  }).toContain('background=images/menus/test.png');
  await expect.poll(() => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''), {
    timeout: 15_000,
  }).toContain('enabled=false');
  await expect.poll(() => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''), {
    timeout: 15_000,
  }).toContain('hide_timeout=12s');
  await expect.poll(() => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''), {
    timeout: 15_000,
  }).toContain('bar_gfx=images/menus/hp.png');
  await expect.poll(() => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''), {
    timeout: 15_000,
  }).toContain('orientation=true');
  await expect.poll(() => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''), {
    timeout: 15_000,
  }).toContain('visible_when_empty=false');
});

test('Action bar slotu ve tooltip ayarı kaydedilir', async () => {
  const { window } = session;

  await openRailTarget(window, 'Settings', 'UI Settings');
  await window.keyboard.press('Escape');
  await window.getByRole('button', { name: 'Action bar', exact: true }).click();

  await window.getByLabel('Slot 1 X').fill('80');
  await window.getByLabel('Power tooltip length').click();
  await window.getByRole('option', { name: 'Name only', exact: true }).click();
  await window.locator('button:has(svg.lucide-save)').last().click();

  const file = path.join(project.projectPath, 'menus/actionbar.txt');
  await expect.poll(() => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''), {
    timeout: 15_000,
  }).toContain('slot=1,80,6');
  await expect.poll(() => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''), {
    timeout: 15_000,
  }).toContain('tooltip_length=short');
});

test('Envanter panel ayarları kaydedilir', async () => {
  const { window } = session;

  await openRailTarget(window, 'Settings', 'UI Settings');
  await window.keyboard.press('Escape');
  await window.getByRole('button', { name: 'Inventory', exact: true }).click();

  await window.getByLabel('Item columns').fill('7');
  await window.getByLabel('Show sort button').click();
  await window.getByLabel('Sort button X').fill('42');
  await window.getByLabel('Help area width').fill('300');
  await window.locator('button:has(svg.lucide-save)').last().click();

  const file = path.join(project.projectPath, 'menus/inventory.txt');
  await expect.poll(() => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''), {
    timeout: 15_000,
  }).toContain('carried_cols=7');
  await expect.poll(() => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''), {
    timeout: 15_000,
  }).toContain('sort_enabled=true');
  await expect.poll(() => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''), {
    timeout: 15_000,
  }).toContain('sort_pos=42,0');
  await expect.poll(() => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''), {
    timeout: 15_000,
  }).toContain('help=0,0,300,80');
});

test('Başlık ekranı logosu ve düğme konumu kaydedilir', async () => {
  const { window } = session;

  await openRailTarget(window, 'Settings', 'UI Settings');
  await window.keyboard.press('Escape');
  await window.getByRole('button', { name: 'Title screen', exact: true }).click();

  await window.getByLabel('Logo image').fill('images/menus/title.png');
  await window.getByLabel('Play button X').fill('10');
  await window.locator('button:has(svg.lucide-save)').last().click();

  const file = path.join(project.projectPath, 'menus/gametitle.txt');
  await expect.poll(() => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''), {
    timeout: 15_000,
  }).toContain('logo=images/menus/title.png,0,0,center');
  await expect.poll(() => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''), {
    timeout: 15_000,
  }).toContain('play_pos=10,-84,bottom');
});
