const { _electron: electron } = require('@playwright/test');
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
    await window.waitForSelector('button:has-text("Create New Project")', { timeout: 15000 });

    await electronApp.evaluate(async ({ dialog }) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: ['C:\\Users\\Public\\Documents\\PlaywrightExportTest'],
      });
    });

    await window.getByRole('button', { name: /Create New Project/i }).click();
    await window.getByPlaceholder('Enter map name').fill('Playwright Export Test');
    await window.locator('input[placeholder="Select folder for your project"] + button').click({ force: true });
    await window.getByRole('button', { name: /Confirm/i }).click();
    await window.screenshot({ path: 'scripts/debug-export-menu-before-canvas.png' });

    await window.waitForSelector('canvas', { timeout: 15000 });
    await window.screenshot({ path: 'scripts/debug-export-menu-after-canvas.png' });
    console.log('Editor loaded, body text snippet:', await window.evaluate(() => document.body.innerText.slice(0, 500)));
    console.log('Menu button count:', await window.locator('button:has(svg.lucide-menu)').count());
    console.log('Save button count:', await window.locator('button:has(svg.lucide-save)').count());
    console.log('Settings button count:', await window.locator('button:has(svg.lucide-settings)').count());
    console.log('Export Project button count:', await window.locator('button', { hasText: 'Export Project' }).count());
    console.log('Export Project text count:', await window.locator('text=Export Project').count());
    console.log('Any text containing Export Project count:', await window.locator('text=/Export Project/i').count());
  } finally {
    await electronApp.close();
  }
})();
