const { _electron: electron } = require('@playwright/test');
const path = require('path');
(async () => {
  const electronApp = await electron.launch({ args: ['.'] });
  try {
    await electronApp.evaluate(async ({ dialog }) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: ['C:\\Users\\Public\\Documents\\PlaywrightTest'] });
    });

    const appWindow = async () => {
      const existing = electronApp.windows().find((w) => {
        const url = w.url();
        return url && !url.startsWith('devtools://') && !url.startsWith('about:blank') && !url.startsWith('chrome-error://');
      });
      if (existing) return existing;

      console.log('waiting for app window...');
      while (true) {
        const next = await electronApp.waitForEvent('window');
        const url = next.url();
        console.log('new window url:', url);
        if (url && !url.startsWith('devtools://') && !url.startsWith('about:blank') && !url.startsWith('chrome-error://')) {
          return next;
        }
      }
    };

    const window = await appWindow();
    console.log('selected app window url', window.url());
    await window.waitForLoadState('load');

    const button = await window.getByRole('button', { name: /Create New Project/i }).first();
    console.log('Create New Project visible', !!button);
    await button.click();
    await window.waitForSelector('input[placeholder="Enter map name"]');
    await window.locator('input[placeholder="Enter map name"]').fill('Playwright Test Project');

    const desc = await window.evaluate(() => {
      const descriptor = Object.getOwnPropertyDescriptor(window, 'electronAPI');
      const keys = Object.keys(window.electronAPI || {});
      const selectDirectory = window.electronAPI?.selectDirectory?.toString();
      return { descriptor, keys, selectDirectory: selectDirectory?.slice(0, 200) };
    });
    console.log('electronAPI descriptor:', desc.descriptor);
    console.log('electronAPI keys:', desc.keys);
    console.log('electronAPI.selectDirectory source:', desc.selectDirectory);

    await window.evaluate(() => {
      try {
        window.electronAPI = {
          ...window.electronAPI,
          selectDirectory: async () => 'C:\\Users\\Public\\Documents\\PlaywrightTest'
        };
        return { success: true, electronAPI: Object.keys(window.electronAPI || {}) };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }).then(console.log);

    const folderButton = window.locator('input[placeholder="Select folder for your project"] + button').first();
    console.log('folder button count', await folderButton.count());
    await folderButton.click({ force: true });
    await window.waitForTimeout(500);
    console.log('location field value', await window.locator('input[placeholder="Select folder for your project"]').inputValue());

    await window.evaluate(async () => {
      const selected = await window.electronAPI?.selectDirectory?.();
      return selected;
    }).then(console.log);
  } catch (err) {
    console.error('Error in debug script', err);
  } finally {
    await electronApp.close();
  }
})();
