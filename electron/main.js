const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    frame: false, // Remove the default window frame
    titleBarStyle: 'hidden', // Hide the title bar
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../assets/icon.png'), // Add icon if available
    title: 'Isometric Tile Map Editor'
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('close', (event) => {
    // Prevent immediate close and ask renderer to check for unsaved changes
    event.preventDefault();
    mainWindow.webContents.send('before-close');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create application menu
  createMenu();
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Map',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu-new-map');
          }
        },
        {
          label: 'Open Map',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow.webContents.send('menu-open-map');
          }
        },
        {
          label: 'Save Map',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow.webContents.send('menu-save-map');
          }
        },
        { type: 'separator' },
        {
          label: 'Export TMX',
          click: () => {
            mainWindow.webContents.send('menu-export-tmx');
          }
        },
        {
          label: 'Export Flare TXT',
          click: () => {
            mainWindow.webContents.send('menu-export-flare');
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => {
            mainWindow.webContents.send('menu-undo');
          }
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Y',
          click: () => {
            mainWindow.webContents.send('menu-redo');
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forcereload' },
        { role: 'toggledevtools' },
        { type: 'separator' },
        { role: 'resetzoom' },
        { role: 'zoomin' },
        { role: 'zoomout' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            mainWindow.webContents.send('menu-about');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC handlers for window controls
ipcMain.on('window-minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) {
    // Trigger the close event which will check for unsaved changes
    mainWindow.close();
  }
});

// Handle close confirmation
ipcMain.handle('confirm-close', async (event, hasUnsavedChanges) => {
  if (!hasUnsavedChanges) {
    // No unsaved changes, allow close
    if (mainWindow) {
      mainWindow.destroy(); // Force close without triggering close event again
    }
    return true;
  }

  // Show confirmation dialog
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: 'Unsaved Changes',
    message: 'You have unsaved changes.',
    detail: 'Your changes will be lost if you close without saving. Are you sure you want to continue?',
    buttons: ['Save and Close', 'Close Without Saving', 'Cancel'],
    defaultId: 0, // Default to "Save and Close"
    cancelId: 2   // Cancel button
  });

  switch (result.response) {
    case 0: // Save and Close
      // Send message to renderer to save, then close
      mainWindow.webContents.send('save-and-close');
      return false; // Don't close yet, wait for save completion
    case 1: // Close Without Saving
      if (mainWindow) {
        mainWindow.destroy(); // Force close
      }
      return true;
    case 2: // Cancel
    default:
      return false; // Don't close
  }
});

// Handle final close after save
ipcMain.on('close-after-save', () => {
  if (mainWindow) {
    mainWindow.destroy();
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle app protocol for development
if (isDev) {
  if (process.platform === 'win32') {
    process.on('message', (data) => {
      if (data === 'graceful-exit') {
        app.quit();
      }
    });
  } else {
    process.on('SIGTERM', () => {
      app.quit();
    });
  }
}
