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
    await window.waitForLoadState('load');

    await electronApp.evaluate(async ({ dialog }) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: ['C:\\Users\\Public\\Documents\\PlaywrightToolbarTest\\Playwright Toolbar Test'] });
    });

    const openButton = window.getByRole('button', { name: /Open Existing Project/i });
    await openButton.click();

    await window.waitForSelector('canvas', { timeout: 15000 });
    const wrapper = window.locator('[aria-label="Tool selection"]');
    await wrapper.locator('button.tool-button').first().hover();
    await window.waitForTimeout(500);
    console.log('wrapper count', await wrapper.count());
    console.log('wrapper html after hover', await wrapper.evaluate((el) => el.innerHTML));
    console.log('subtool count', await window.locator('button.sub-tool-button').count());
  } finally {
    await electronApp.close();
  }
})();
