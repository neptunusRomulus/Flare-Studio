const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;

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
    mainWindow.loadURL('http://localhost:5182');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create application menu
  createMenu();
}

const { ipcMain } = require('electron');
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
    mainWindow.close();
  }
});

// Handle file system operations
const fs = require('fs');

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('create-map-project', async (event, config) => {
  try {
    const projectPath = path.join(config.location, config.name);
    
    // Create project directory
    if (!fs.existsSync(projectPath)) {
      fs.mkdirSync(projectPath, { recursive: true });
    }
    
    // Create basic project structure
    const mapData = {
      name: config.name,
      width: config.width,
      height: config.height,
      tileSize: config.tileSize,
      layers: [],
      tilesets: [],
      version: "1.0"
    };
    
    // Save map configuration
    const mapConfigPath = path.join(projectPath, `${config.name}.json`);
    fs.writeFileSync(mapConfigPath, JSON.stringify(mapData, null, 2));
    
    // Create assets folder
    const assetsPath = path.join(projectPath, 'assets');
    if (!fs.existsSync(assetsPath)) {
      fs.mkdirSync(assetsPath);
    }
    
    return true;
  } catch (error) {
    console.error('Error creating map project:', error);
    return false;
  }
});

ipcMain.handle('open-map-project', async (event, projectPath) => {
  try {
    // Look for map configuration file
    const files = fs.readdirSync(projectPath);
    const mapFile = files.find(file => file.endsWith('.json'));
    
    if (mapFile) {
      const mapConfigPath = path.join(projectPath, mapFile);
      const mapData = JSON.parse(fs.readFileSync(mapConfigPath, 'utf8'));
      return mapData;
    }
    
    return null;
  } catch (error) {
    console.error('Error opening map project:', error);
    return null;
  }
});

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
