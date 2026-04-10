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

    const infoBefore = await window.evaluate(() => ({
      hasSaveMapProject: typeof window.electronAPI?.saveMapProject,
      descriptor: Object.getOwnPropertyDescriptor(window.electronAPI || {}, 'saveMapProject')
    }));
    console.log('before stub', infoBefore);
    await window.evaluate(() => {
      window.__saveProjectCalled = false;
      window.electronAPI.saveMapProject = async () => {
        console.log('saveMapProject stub called');
        window.__saveProjectCalled = true;
        return true;
      };
    });
    const infoAfter = await window.evaluate(() => ({
      hasSaveMapProject: typeof window.electronAPI?.saveMapProject,
      descriptor: Object.getOwnPropertyDescriptor(window.electronAPI || {}, 'saveMapProject'),
      stubString: window.electronAPI.saveMapProject.toString().slice(0, 200)
    }));
    console.log('after stub', infoAfter);
    await window.evaluate(() => window.electronAPI.saveMapProject());
    await window.waitForTimeout(500);
    const afterCall = await window.evaluate(() => ({ called: window.__saveProjectCalled }));
    console.log(afterCall);
  } finally {
    await electronApp.close();
  }
})();