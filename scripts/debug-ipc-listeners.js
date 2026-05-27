const { _electron: electron } = require('@playwright/test');
(async () => {
  const electronApp = await electron.launch({ args: ['.'] });
  try {
    const info = await electronApp.evaluate(async ({ ipcMain }) => {
      try {
        return {
          listenerCount: typeof ipcMain !== 'undefined' ? ipcMain.listenerCount('save-map-project') : null,
          listenersTypes: typeof ipcMain !== 'undefined' ? ipcMain.listeners('save-map-project').map(fn => fn.name || fn.toString().slice(0,40)) : null,
        };
      } catch (error) {
        return { error: String(error) };
      }
    });
    console.log('info', info);
  } finally {
    await electronApp.close();
  }
})();