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
    await window.click('canvas');

    await window.evaluate(() => {
      window.__saveProjectCalled = false;
      window.electronAPI.saveMapProject = async () => {
        console.log('saveMapProject stub called');
        window.__saveProjectCalled = true;
        return true;
      };
    });

    await window.evaluate(() => {
      const event = new KeyboardEvent('keydown', {
        key: 's',
        code: 'KeyS',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(event);
      return { defaultPrevented: event.defaultPrevented };
    }).then((res) => {
      console.log('dispatched keydown', res);
    });

    await window.waitForTimeout(1000);
    const after = await window.evaluate(() => ({ called: window.__saveProjectCalled }));
    console.log('after dispatch', after);
  } finally {
    await electronApp.close();
  }
})();