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

    await window.waitForSelector('button', { timeout: 15000 });

    const projectRoot = path.join('C:', 'Users', 'Public', 'Documents', 'PlaywrightExportTest');
    const projectName = 'Playwright Export Test';
    const projectPath = path.join(projectRoot, projectName);
    if (!fs.existsSync(projectPath)) fs.mkdirSync(projectPath, { recursive: true });
    fs.writeFileSync(path.join(projectPath, 'settings.txt'), 'description=Playwright export test\ngame=flare-game\nversion=1.14\nengine_version_min=1.13.01\n', 'utf8');
    const mapData = { name: projectName, isStartingMap: true, width: 16, height: 16, tileSize: 16, layers: [{ id: 1, name: 'Ground', type: 'background', data: Array(16*16).fill(0), visible: true }], tilesets: [], version: '1.0' };
    fs.writeFileSync(path.join(projectPath, `${projectName}.json`), JSON.stringify(mapData, null, 2), 'utf8');

    await electronApp.evaluate(async ({ dialog }) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: ['C:\\Users\\Public\\Documents\\PlaywrightExportTest\\Playwright Export Test'] });
    });

    await window.click('button:has-text("Open Existing Project")');
    await window.waitForSelector('canvas', { timeout: 15000 });

    const buttonInfo = await window.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).map((button, idx) => ({
        idx,
        outerHTML: button.outerHTML.slice(0, 300),
        text: button.textContent?.trim(),
        svgCount: button.querySelectorAll('svg').length,
        role: button.getAttribute('role'),
        ariaLabel: button.getAttribute('aria-label'),
      }));
    });
    console.log(JSON.stringify(buttonInfo, null, 2));
    await window.screenshot({ path: 'scripts/debug-save-button-dom.png' });
  } finally {
    await electronApp.close();
  }
})();