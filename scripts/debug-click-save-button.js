const { _electron: electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
(async () => {
  const electronApp = await electron.launch({ args: ['.'] });
  try {
    const appWindow = async () => {
      const existing = electronApp.windows().find((w) => {
        const url = w.url();
        return url && !url.startsWith('devtools://') && !url.startsWith('about:blank');
      });
      if (existing) return existing;
      while (true) {
        const next = await electronApp.waitForEvent('window');
        const url = next.url();
        if (url && !url.startsWith('devtools://') && !url.startsWith('about:blank')) return next;
      }
    };
    const window = await appWindow();
    await window.waitForLoadState('load');

    const projectRoot = path.join('C:', 'Users', 'Public', 'Documents', 'PlaywrightSaveTest');
    const projectName = 'Playwright Save Test';
    const projectPath = path.join(projectRoot, projectName);
    if (!fs.existsSync(projectPath)) fs.mkdirSync(projectPath, { recursive: true });
    fs.writeFileSync(path.join(projectPath, 'settings.txt'), 'description=Playwright save test\ngame=flare-game\nversion=1.14\nengine_version_min=1.13.01\n', 'utf8');
    const mapData = { name: projectName, isStartingMap: true, width: 16, height: 16, tileSize: 16, layers: [{ id: 1, name: 'Ground', type: 'background', data: Array(16*16).fill(0), visible: true }], tilesets: [], version: '1.0' };
    fs.writeFileSync(path.join(projectPath, `${projectName}.json`), JSON.stringify(mapData, null, 2), 'utf8');

    await electronApp.evaluate(async ({ dialog }) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: ['C:\\Users\\Public\\Documents\\PlaywrightSaveTest\\Playwright Save Test'] });
    });

    const openBtn = await window.locator('button', { hasText: 'Open Existing Project' }).first();
    await openBtn.click();
    await window.waitForSelector('canvas', { timeout: 15000 });

    await window.evaluate(() => {
      if (window.electronAPI) {
        window.__saveProjectCalled = false;
        window.electronAPI.saveMapProject = async () => {
          window.__saveProjectCalled = true;
          return true;
        };
      }
    });

    const saveButton = await window.locator('button:has(svg path[d^="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"])').first();
    console.log('save button count', await saveButton.count());
    await saveButton.click();

    const called = await window.waitForFunction(() => window.__saveProjectCalled === true, { timeout: 15000 }).catch(err => {
      console.error('save callback not called', err);
      return false;
    });
    console.log('save callback reached?', called);
  } finally {
    await electronApp.close();
  }
})();