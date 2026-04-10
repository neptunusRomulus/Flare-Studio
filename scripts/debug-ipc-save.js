const { _electron: electron } = require('@playwright/test');
(async () => {
  const electronApp = await electron.launch({ args: ['.'] });
  try {
    const info = await electronApp.evaluate(async () => {
      try {
        return {
          hasIpcMainLocal: typeof ipcMainLocal !== 'undefined',
          listenerCount: typeof ipcMainLocal !== 'undefined' ? ipcMainLocal.listenerCount('save-map-project') : null,
          ipcMainExists: typeof ipcMain !== 'undefined',
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