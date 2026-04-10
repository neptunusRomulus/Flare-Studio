const { _electron: electron } = require('@playwright/test');
(async () => {
  const electronApp = await electron.launch({ args: ['.'] });
  try {
    const info = await electronApp.evaluate(async ({ ipcMain, ipcMainLocal, dialog }) => {
      return {
        hasIpcMain: !!ipcMain,
        hasIpcMainLocal: !!ipcMainLocal,
        hasDialog: !!dialog,
        ipcMainType: typeof ipcMain,
        ipcMainLocalType: typeof ipcMainLocal,
      };
    });
    console.log('info', info);
  } finally {
    await electronApp.close();
  }
})();