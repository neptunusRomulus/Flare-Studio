import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { getAppWindow, launchElectronApp } from '../electron-utils';
import {
  closeGuiProject,
  createGuiProject,
  ensureRail,
  openRailTarget,
} from '../gui-test-fixture';

/**
 * Three reference renders for the monthly visual pass.
 *
 * Deliberately not a pixel gate: the owner develops on one Linux distribution and CI runs on another,
 * so a byte-exact baseline would go red for font hinting and train everyone to ignore red. The pass is a
 * human looking at three PNGs, not a diff.
 *
 *   npm run shots            # writes test-results/screens/*.png
 */
const OUT_DIR = path.resolve(__dirname, '../../../test-results/screens');

test('capture the three reference screens', async () => {
  test.skip(process.env.SHOTS !== '1', 'set SHOTS=1 (npm run shots) to refresh the reference screens');
  test.setTimeout(180_000);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const project = createGuiProject('Screens');
  const { app, viteProcess } = await launchElectronApp();

  try {
    const window = await getAppWindow(app);
    await window.waitForLoadState('domcontentloaded');

    await expect(window.getByRole('button', { name: /Create New Project/i })).toBeVisible({ timeout: 45_000 });
    await window.screenshot({ path: path.join(OUT_DIR, '01-welcome.png'), animations: 'disabled' });

    await app.evaluate(async ({ dialog }, selectedPath) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selectedPath] });
    }, project.projectPath);
    await window.getByRole('button', { name: /Open Existing Project/i }).click();
    await expect(window.locator('canvas').first()).toBeVisible({ timeout: 45_000 });
    await ensureRail(window);
    await window.screenshot({ path: path.join(OUT_DIR, '02-map-editor.png'), animations: 'disabled' });

    await openRailTarget(window, 'Content', 'Items');
    await window.screenshot({ path: path.join(OUT_DIR, '03-items-pane.png'), animations: 'disabled' });

    const written = fs.readdirSync(OUT_DIR).filter((name) => name.endsWith('.png'));
    expect(written.sort()).toEqual(['01-welcome.png', '02-map-editor.png', '03-items-pane.png']);
  } finally {
    await closeGuiProject(app, viteProcess);
  }
});
