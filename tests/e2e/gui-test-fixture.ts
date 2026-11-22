import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ChildProcess } from 'node:child_process';
import { expect, type ElectronApplication, type Locator, type Page } from '@playwright/test';
import { getAppWindow, launchElectronApp, stopViteServer } from './electron-utils';

export type GuiProject = {
  projectPath: string;
  projectName: string;
  mapFileName: string;
};

const MAP_SIZE = 16;

const sanitizeFile = (value: string) =>
  value.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_').replace(/_{2,}/g, '_').trim() || 'map';

const emptyLayer = (id: number, name: string, type: string) => ({
  id,
  name,
  type,
  data: new Array(MAP_SIZE * MAP_SIZE).fill(0),
  visible: true,
  transparency: 1,
});

/**
 * A small project that exposes every rail group:
 * Map, Entities, Content, Settings and Character.
 */
export function createGuiProject(label: string, files: Record<string, string> = {}): GuiProject {
  const projectName = `GUI ${label} ${Date.now()}`;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'flare-gui-'));
  const projectPath = path.join(root, sanitizeFile(projectName));
  const mapFileName = `${sanitizeFile(projectName)}.json`;

  fs.mkdirSync(projectPath, { recursive: true });
  fs.writeFileSync(
    path.join(projectPath, 'settings.txt'),
    `description=${projectName}\ngame=flare-game\nversion=1.14\nengine_version_min=1.13.01\n`,
    'utf8',
  );

  const layers = [
    emptyLayer(1, 'Ground', 'background'),
    emptyLayer(2, 'Object', 'object'),
    emptyLayer(3, 'Collision', 'collision'),
    emptyLayer(4, 'NPC', 'npc'),
    emptyLayer(5, 'Enemy', 'enemy'),
    emptyLayer(6, 'Event', 'event'),
    emptyLayer(7, 'Items', 'items'),
    emptyLayer(8, 'Books', 'books'),
    emptyLayer(9, 'Statuses', 'status'),
    emptyLayer(10, 'Quests', 'rules'),
  ];

  fs.writeFileSync(
    path.join(projectPath, mapFileName),
    JSON.stringify({
      name: projectName,
      isStartingMap: true,
      width: MAP_SIZE,
      height: MAP_SIZE,
      tileSize: 16,
      layers,
      tilesets: [],
      version: '1.0',
    }, null, 2),
    'utf8',
  );

  const defaultFiles: Record<string, string> = {
    'menus/hp.txt': 'pos=0,0,320,48\nalign=bottomleft\nbar_pos=0,0,320,48\norientation=0\n',
    'menus/actionbar.txt': 'pos=0,0,1280,70\nalign=bottom\nslot=1,64,6\nslot=2,128,6\nslot_M1=768,6\nslot_M2=832,6\nchar_menu=960,6\ninv_menu=1024,6\npowers_menu=1088,6\nlog_menu=1152,6\ntooltip_length=long_all\n',
  };
  for (const [relative, content] of Object.entries({ ...defaultFiles, ...files })) {
    const target = path.join(projectPath, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
  }

  return { projectPath, projectName, mapFileName };
}

export async function launchGuiProject(project: GuiProject) {
  const { app, viteProcess } = await launchElectronApp();
  const window = await getAppWindow(app);
  await window.waitForLoadState('domcontentloaded');
  await window.waitForLoadState('load');

  // Floating StudioWindow positions are persisted in localStorage. A window left
  // off-screen by an earlier session makes its Close button unclickable.
  await window.evaluate(() => {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith('draggable_window_')) localStorage.removeItem(key);
    }
  });

  await app.evaluate(async ({ dialog }, selectedPath) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selectedPath] });
  }, project.projectPath);

  await expect(window.getByRole('button', { name: /Open Existing Project/i })).toBeVisible({ timeout: 15000 });
  await window.getByRole('button', { name: /Open Existing Project/i }).click();
  await expect(window.locator('canvas').first()).toBeVisible({ timeout: 15000 });
  await ensureRail(window);

  return { app, window, viteProcess };
}

export async function ensureRail(window: Page): Promise<void> {
  const show = window.getByRole('button', { name: /Show sidebar/i });
  if (await show.count()) {
    await show.first().click().catch(() => undefined);
  }
  await expect(window.getByLabel('Sidebar', { exact: true })).toBeVisible({ timeout: 15000 });
}

export function sidebarCard(window: Page) {
  return window.locator('[aria-label="Sidebar list"], [aria-label="Sidebar panel"]').first();
}

export function railGroup(window: Page, label: string) {
  return window.locator(`[aria-label="${label}"]`).first();
}

export async function openRailTarget(window: Page, groupLabel: string, targetLabel: string): Promise<void> {
  const group = railGroup(window, groupLabel);
  await expect(group).toBeVisible({ timeout: 15000 });

  const target = group.getByRole('radio', { name: targetLabel, exact: true });
  await expect(target).toBeVisible({ timeout: 15000 });
  await target.click();

  await expect(sidebarCard(window)).toHaveAttribute('aria-hidden', 'false', { timeout: 15000 });
}

export async function openPane(window: Page, paneLabel: string): Promise<void> {
  const button = sidebarCard(window).getByRole('button', { name: paneLabel, exact: true }).first();
  await expect(button).toBeVisible({ timeout: 15000 });
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
}

export async function expectStudioWindow(window: Page, title: string) {
  const heading = window.getByRole('heading', { name: title, exact: true }).first();
  await expect(heading).toBeVisible({ timeout: 15000 });

  const studioWindow = window.locator('div.fixed').filter({ has: heading }).first();
  await expect(studioWindow).toBeVisible({ timeout: 15000 });
  return studioWindow;
}

export async function closeStudioWindow(studioWindow: Locator): Promise<void> {
  await studioWindow.getByRole('button', { name: 'Close' }).first().click();
  await expect(studioWindow).toHaveCount(0, { timeout: 15000 });
}

export async function closeGuiProject(
  app: ElectronApplication | null | undefined,
  viteProcess: ChildProcess | null | undefined,
): Promise<void> {
  if (app) {
    // Tests intentionally leave dirty editors behind. A normal close would show the
    // native Save / Don't save / Cancel prompt and hang the serial worker.
    await Promise.race([
      app.evaluate(({ app: electronApp }) => { electronApp.exit(0); }),
      new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
    ]).catch(() => undefined);
  }
  await stopViteServer(viteProcess ?? null);
}
