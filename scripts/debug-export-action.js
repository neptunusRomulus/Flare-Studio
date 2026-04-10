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

    const projectRoot = path.join('C:', 'Users', 'Public', 'Documents', 'PlaywrightExportTest');
    const projectName = 'Playwright Export Test';
    const projectPath = path.join(projectRoot, projectName);
    if (!fs.existsSync(projectPath)) fs.mkdirSync(projectPath, { recursive: true });
    fs.writeFileSync(path.join(projectPath, 'settings.txt'), 'description=Playwright export test\ngame=flare-game\nversion=1.14\nengine_version_min=1.13.01\n', 'utf8');
    const mapData = { name: projectName, width: 16, height: 16, tileSize: 16, layers: [{ id: 1, name: 'Ground', type: 'background', data: Array(16 * 16).fill(0), visible: true }], tilesets: [], version: '1.0' };
    fs.writeFileSync(path.join(projectPath, `${projectName}.json`), JSON.stringify(mapData, null, 2), 'utf8');

    await electronApp.evaluate(async ({ dialog }) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: ['C:\\Users\\Public\\Documents\\PlaywrightExportTest\\Playwright Export Test'] });
    });
    await window.getByRole('button', { name: /Open Existing Project/i }).click({ force: true });
    await window.waitForSelector('canvas', { timeout: 15000 });

    await window.evaluate(() => {
      if (window.electronAPI) {
        window.electronAPI.saveExportFiles = async () => {
          console.log('stub saveExportFiles called');
          return true;
        };
      }
    });

    await window.evaluate(() => {
      const btn = document.querySelector('button:has(svg.lucide-menu)');
      if (btn) btn.click();
    });
    await window.waitForTimeout(500);
    await window.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => /Export Project/i.test(b.textContent || ''));
      if (btn) btn.click();
    });
    await window.waitForTimeout(3000);
    const modalText = await window.evaluate(() => document.body.innerText);
    console.log('after export click body contains Export Successful?', /Export Successful/i.test(modalText));
    console.log('after export click body contains Project exported to project folder.', /Project exported to project folder\./i.test(modalText));
    await window.screenshot({ path: 'scripts/debug-export-action.png' });
  } finally {
    await electronApp.close();
  }
})();