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
    window.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    window.on('pageerror', (error) => console.log('PAGE ERROR:', error.message));
    await window.waitForLoadState('load');

    // Create project fixture
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

    const openButton = window.getByRole('button', { name: /Open Existing Project/i }).first();
    await openButton.click({ force: true });
    await window.waitForSelector('canvas', { timeout: 15000 });

    console.log('--- DOM BUTTON SUMMARY ---');
    const buttonCount = await window.evaluate(() => document.querySelectorAll('button').length);
    console.log('button count', buttonCount);
    const buttons = await window.evaluate(() => Array.from(document.querySelectorAll('button')).map((button, index) => ({
      index,
      text: button.textContent.trim(),
      ariaLabel: button.getAttribute('aria-label'),
      title: button.getAttribute('title'),
      classes: button.className,
      svgClass: button.querySelector('svg')?.className || null,
      outerHTML: button.outerHTML.slice(0, 300),
    })));
    console.log(JSON.stringify(buttons.filter((b) => b.text || b.ariaLabel || b.svgClass || b.title), null, 2));

    const interestingButtons = await window.evaluate(() =>
      Array.from(document.querySelectorAll('button')).map((button, index) => {
        const svg = button.querySelector('svg');
        return {
          index,
          text: button.textContent.trim(),
          ariaLabel: button.getAttribute('aria-label'),
          title: button.getAttribute('title'),
          classes: button.className,
          svgOuter: svg ? svg.outerHTML.slice(0, 300) : null,
          svgClass: svg ? svg.getAttribute('class') : null,
        };
      }).filter(b => b.classes.includes('w-7 h-7 p-0 shadow-sm') || b.classes.includes('w-7 h-7 p-1 rounded-full tool-button') || /menu|save|settings/i.test(b.svgOuter || '') || /menu|save|settings/i.test(b.title || '') || /menu|save|settings/i.test(b.ariaLabel || ''))
    );
    console.log('interestingButtons', JSON.stringify(interestingButtons, null, 2));

    const exportButtons = await window.evaluate(() => Array.from(document.querySelectorAll('button')).filter((button) => /Export/i.test(button.textContent)).map((button) => button.outerHTML));
    console.log('exportButtons', exportButtons.length, exportButtons);

    await window.screenshot({ path: 'scripts/debug-export-menu-selector.png' });
    console.log('screenshot saved');
  } finally {
    await electronApp.close();
  }
})();
