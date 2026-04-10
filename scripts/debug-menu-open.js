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

    const menuButton = await window.locator('button:has(svg.lucide-menu)').first();
    console.log('menuButton count', await window.locator('button:has(svg.lucide-menu)').count());
    console.log('menuButton visible', await menuButton.isVisible());
    console.log('menuButton enabled', await menuButton.isEnabled());
    console.log('menuButton html', await menuButton.evaluate((btn) => btn.outerHTML));

    await window.evaluate(() => {
      const btn = document.querySelector('button:has(svg.lucide-menu)');
      if (btn) {
        btn.click();
        console.log('DOM menu button clicked');
      } else {
        console.log('No DOM menu button found');
      }
    });
    await window.waitForTimeout(1000);
    const exportButtons = await window.evaluate(() => Array.from(document.querySelectorAll('button')).map((button) => ({ text: button.textContent.trim(), ariaLabel: button.getAttribute('aria-label'), classes: button.className })).filter((b) => b.text.includes('Export') || b.ariaLabel?.includes('Export') || b.classes.includes('menu')));
    console.log('exportButtons after click', JSON.stringify(exportButtons, null, 2));
    const menuDialogExists = await window.evaluate(() => !!document.querySelector('div[role="dialog"], div[class*="border border-border"]')); 
    console.log('menuDialogExists?', menuDialogExists);
    await window.screenshot({ path: 'scripts/debug-menu-open-after-click.png' });
  } finally {
    await electronApp.close();
  }
})();