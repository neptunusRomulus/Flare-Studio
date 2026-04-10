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

    const engineButtons = await window.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).map((button, idx) => ({
        idx,
        text: button.textContent?.trim(),
        title: button.getAttribute('title'),
        ariaLabel: button.getAttribute('aria-label'),
        className: button.className,
        outerHTML: button.outerHTML.slice(0, 500),
      })).filter(item => item.title?.includes('Engine Settings') || item.ariaLabel?.includes('Engine Settings') || item.text?.includes('Engine Settings'));
    });
    console.log(JSON.stringify(engineButtons, null, 2));

    const saveCandidates = await window.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).map((button, idx) => ({
        idx,
        text: button.textContent?.trim(),
        title: button.getAttribute('title'),
        ariaLabel: button.getAttribute('aria-label'),
        className: button.className,
        outerHTML: button.outerHTML.slice(0, 500),
      })).filter(item => item.title?.includes('All changes saved') || item.ariaLabel?.includes('All changes saved') || item.text?.includes('All changes saved'));
    });
    console.log(JSON.stringify(saveCandidates, null, 2));

    const allButtons = await window.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).map((button, idx) => ({
        idx,
        text: button.textContent?.trim(),
        title: button.getAttribute('title'),
        ariaLabel: button.getAttribute('aria-label'),
      })).slice(0, 50);
    });
    console.log('first 50 buttons', JSON.stringify(allButtons, null, 2));
  } finally {
    await electronApp.close();
  }
})();