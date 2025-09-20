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
      webSecurity: true, // Enable web security
      allowRunningInsecureContent: false, // Disable insecure content
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../assets/icon.png'), // Add icon if available
    title: 'Isometric Tile Map Editor'
  });

  // Load the app
  if (isDev) {
  mainWindow.loadURL('http://localhost:5179');
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

ipcMain.handle('select-tileset-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Tileset Images', extensions: ['png'] },
      { name: 'All Files', extensions: ['*'] }
    ]
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

    // Create maps folder
    const mapsPath = path.join(projectPath, 'maps');
    if (!fs.existsSync(mapsPath)) {
      fs.mkdirSync(mapsPath);
    }

    // Write spawn.txt
    const sanitizedMapFileBase = String(config.name).replace(/[<>:"/\\|?*]/g, '_').trim().replace(/\s+/g, '_').replace(/_{2,}/g, '_') || 'Untitled_Map';
    const spawnIntermapTarget = config.isStartingMap ? `maps/${sanitizedMapFileBase}.txt` : 'maps/test11.txt';
    const spawnContent = [
      '# this file is automatically loaded when a New Game starts.',
      "# it's a dummy map to send the player to the actual starting point.",
      '',
      '[header]',
      'width=1',
      'height=1',
      'hero_pos=0,0',
      '',
      '[event]',
      'type=event',
      'location=0,0,1,1',
      'activate=on_load',
      `intermap=${spawnIntermapTarget}`,
      ''
    ].join('\n');
    const spawnFilePath = path.join(mapsPath, 'spawn.txt');
    fs.writeFileSync(spawnFilePath, spawnContent, 'utf8');

    return true;
  } catch (error) {
    console.error('Error creating map project:', error);
    return false;
  }
});

ipcMain.handle('open-map-project', async (event, projectPath) => {
  try {
    console.log('=== ELECTRON LOAD DEBUG ===');
    console.log('Loading project from:', projectPath);
    
    // Look for map configuration file
    const files = fs.readdirSync(projectPath);
    const mapFile = files.find(file => file.endsWith('.json'));
    
    if (mapFile) {
      const mapConfigPath = path.join(projectPath, mapFile);
      console.log('Loading map file:', mapConfigPath);
      
      const mapData = JSON.parse(fs.readFileSync(mapConfigPath, 'utf8'));
      console.log('Loaded map data:', {
        name: mapData.name,
        tilesetImages: mapData.tilesetImages ? Object.keys(mapData.tilesetImages).length : 0,
        tilesets: mapData.tilesets ? mapData.tilesets.length : 0,
        layers: mapData.layers ? mapData.layers.length : 0
      });
      
      // Ensure tilesetImages are present; if missing, attempt to load from assets folder or project root
      try {
        const assetsPath = path.join(projectPath, 'assets');
        const ensureTilesetImages = {};
        if (mapData.tilesetImages && typeof mapData.tilesetImages === 'object') {
          Object.assign(ensureTilesetImages, mapData.tilesetImages);
        }

        if (Array.isArray(mapData.tilesets)) {
          for (const ts of mapData.tilesets) {
            const fileName = ts?.fileName || ts?.name;
            if (!fileName) continue;
            const hasEmbedded = ensureTilesetImages[fileName] && typeof ensureTilesetImages[fileName] === 'string';
            const candidateAssetsPath = path.join(assetsPath, fileName);
            const candidateRootPath = path.join(projectPath, fileName);
            if (!hasEmbedded) {
              if (fs.existsSync(candidateAssetsPath)) {
                const fileBuf = fs.readFileSync(candidateAssetsPath);
                const b64 = fileBuf.toString('base64');
                ensureTilesetImages[fileName] = `data:image/png;base64,${b64}`;
                console.log(`Embedded tileset from assets: ${fileName} (${b64.length} chars)`);
              } else if (fs.existsSync(candidateRootPath)) {
                const fileBuf = fs.readFileSync(candidateRootPath);
                const b64 = fileBuf.toString('base64');
                ensureTilesetImages[fileName] = `data:image/png;base64,${b64}`;
                console.log(`Embedded tileset from project root: ${fileName} (${b64.length} chars)`);
              }
            }
          }
        }

        // If no tilesets defined but we can find images, synthesize tilesets array
        const haveAnyEmbedded = Object.keys(ensureTilesetImages).length > 0;
        if ((!Array.isArray(mapData.tilesets) || mapData.tilesets.length === 0) && !haveAnyEmbedded) {
          // Look for png files in assets or project root
          const candidates = [];
          try {
            if (fs.existsSync(assetsPath)) {
              const assetFiles = fs.readdirSync(assetsPath).filter(f => /\.(png|jpg|jpeg)$/i.test(f));
              for (const f of assetFiles) {
                candidates.push({ name: f, fullPath: path.join(assetsPath, f) });
              }
            }
          } catch {}
          try {
            const rootFiles = fs.readdirSync(projectPath).filter(f => /\.(png|jpg|jpeg)$/i.test(f));
            for (const f of rootFiles) {
              candidates.push({ name: f, fullPath: path.join(projectPath, f) });
            }
          } catch {}
          if (candidates.length > 0) {
            const first = candidates[0];
            const fileBuf = fs.readFileSync(first.fullPath);
            const b64 = fileBuf.toString('base64');
            ensureTilesetImages[first.name] = `data:image/png;base64,${b64}`;
            mapData.tilesets = [{ name: first.name, fileName: first.name }];
            console.log(`Synthesized tileset from discovered image: ${first.name}`);
          }
        }

        if (Object.keys(ensureTilesetImages).length > 0) {
          mapData.tilesetImages = ensureTilesetImages;
        }
      } catch (embErr) {
        console.warn('Warning while embedding tilesets from assets:', embErr);
      }

      if (mapData.tilesetImages) {
        console.log('Tileset image files found:', Object.keys(mapData.tilesetImages));
        // Show first few characters of each image data
        for (const [filename, imageData] of Object.entries(mapData.tilesetImages)) {
          if (typeof imageData === 'string') {
            console.log(`${filename}: ${imageData.length} chars, starts with: ${imageData.substring(0, 50)}...`);
          }
        }
      }
      
      return mapData;
    }
    
    console.log('No map file found in project');
    return null;
  } catch (error) {
    console.error('Error opening map project:', error);
    return null;
  }
});

// Save map project data
ipcMain.handle('save-map-project', async (event, projectPath, mapData) => {
  try {
    console.log('=== ELECTRON SAVE DEBUG ===');
    console.log('Project path:', projectPath);
    console.log('Map data received:', !!mapData);
    
    if (!projectPath || !mapData) {
      console.error('Invalid save parameters:', { projectPath, hasMapData: !!mapData });
      return false;
    }

    // Find existing map file
    const files = fs.readdirSync(projectPath);
    let mapFile = files.find(file => file.endsWith('.json'));
    
    // If no map file exists, create one based on project folder name
    if (!mapFile) {
      const projectName = path.basename(projectPath);
      mapFile = `${projectName}.json`;
      console.log('Creating new map file:', mapFile);
    }
    
    const mapConfigPath = path.join(projectPath, mapFile);
    console.log('Saving to:', mapConfigPath);
    
    // Ensure the map data has the required structure
    const completeMapData = {
      name: mapData.name || path.basename(projectPath),
      width: mapData.width || 20,
      height: mapData.height || 15,
      tileSize: mapData.tileSize || 64,
      layers: mapData.layers || [],
      tilesets: mapData.tilesets || [],
      objects: mapData.objects || [],
      version: "1.0",
      lastSaved: new Date().toISOString(),
      ...mapData
    };
    
    console.log('Complete map data structure:', {
      name: completeMapData.name,
      tilesetImages: Object.keys(completeMapData.tilesetImages || {}).length,
      layers: completeMapData.layers.length
    });
    
    // Write the map data
    fs.writeFileSync(mapConfigPath, JSON.stringify(completeMapData, null, 2));
    console.log('Map configuration saved successfully');
    
    // Save tileset images to assets folder if they exist
    if (mapData.tilesetImages) {
      console.log('Processing tileset images:', Object.keys(mapData.tilesetImages));
      const assetsPath = path.join(projectPath, 'assets');
      if (!fs.existsSync(assetsPath)) {
        fs.mkdirSync(assetsPath, { recursive: true });
        console.log('Created assets directory');
      }
      
      for (const [filename, imageData] of Object.entries(mapData.tilesetImages)) {
        if (imageData && typeof imageData === 'string') {
          console.log('Saving image:', filename, 'Data length:', imageData.length);
          // Handle base64 image data
          const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
          const imagePath = path.join(assetsPath, filename);
          fs.writeFileSync(imagePath, base64Data, 'base64');
          console.log('Image saved to:', imagePath);
        }
      }
    } else {
      console.log('No tileset images to save');
    }

    // Save minimap image if provided in mapData.minimap
    try {
      if (mapData.minimap && typeof mapData.minimap === 'string' && mapData.minimap.startsWith('data:image')) {
        const minimapBase64 = mapData.minimap.replace(/^data:image\/[a-z]+;base64,/, '');
        const minimapPath = path.join(projectPath, 'assets', 'minimap.png');
        fs.writeFileSync(minimapPath, minimapBase64, 'base64');
        console.log('Saved minimap to:', minimapPath);
      }
    } catch (mmErr) {
      console.warn('Failed to save minimap:', mmErr);
    }
    
    console.log('Map project saved successfully:', mapConfigPath);
    return true;
  } catch (error) {
    console.error('Error saving map project:', error);
    return false;
  }
});

// Save export files (map.txt and tileset.txt) to project folder
ipcMain.handle('save-export-files', async (event, projectPath, projectName, mapTxt, tilesetDef, options = {}) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Ensure the project directory exists
    if (!fs.existsSync(projectPath)) {
      throw new Error('Project path does not exist');
    }
    
    // Create Export directory if it doesn't exist
    const exportDir = path.join(projectPath, 'Export');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    // Helper function to find next available filename
    const getAvailableFilename = (basePath, baseName, extension) => {
      let filename = `${baseName}${extension}`;
      let filepath = path.join(basePath, filename);
      
      if (!fs.existsSync(filepath)) {
        return { filename, filepath };
      }
      
      // If file exists, find the next available number
      let counter = 1;
      while (true) {
        filename = `${baseName}_${counter}${extension}`;
        filepath = path.join(basePath, filename);
        
        if (!fs.existsSync(filepath)) {
          return { filename, filepath };
        }
        counter++;
      }
    };
    
    // Sanitize project name for filename (remove invalid characters)
    const sanitizedProjectName = projectName
      .replace(/[<>:"/\|?*]/g, '_')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/_{2,}/g, '_')
      || 'exported_map';
    
    // Get available filenames for both files using project name
    const mapFile = getAvailableFilename(exportDir, sanitizedProjectName, '.txt');
    const tilesetFile = getAvailableFilename(exportDir, `${sanitizedProjectName} tileset`, '.txt');
    
    // Save map file to Export directory
    fs.writeFileSync(mapFile.filepath, mapTxt, 'utf8');
    
    // Save tileset file to Export directory
    fs.writeFileSync(tilesetFile.filepath, tilesetDef, 'utf8');
    
    // Optionally create spawn file within maps folder
    if (options.spawn && options.spawn.enabled && options.spawn.content) {
      const mapsDir = path.join(projectPath, 'maps');
      if (!fs.existsSync(mapsDir)) {
        fs.mkdirSync(mapsDir, { recursive: true });
      }
      const spawnFilename = options.spawn.filename || 'spawn.txt';
      const spawnPath = path.join(mapsDir, spawnFilename);
      fs.writeFileSync(spawnPath, options.spawn.content, 'utf8');
      console.log('Spawn file saved:', spawnPath);
    }
    
    console.log('Export files saved successfully:');
    console.log('- Map:', mapFile.filepath);
    console.log('- Tileset:', tilesetFile.filepath);
    
    return true;
  } catch (error) {
    console.error('Error saving export files:', error);
    return false;
  }
});

// Discover tileset images in a project folder and return as data URLs
ipcMain.handle('discover-tileset-images', async (event, projectPath) => {
  try {
    if (!projectPath) return { tilesetImages: {}, tilesets: [] };
    const tilesetImages = {};
    const tilesets = [];
    const assetsPath = path.join(projectPath, 'assets');

    const addIfImage = (fullPath, name) => {
      try {
        if (/\.(png|jpg|jpeg)$/i.test(name) && fs.existsSync(fullPath)) {
          const buf = fs.readFileSync(fullPath);
          const b64 = buf.toString('base64');
          const ext = (name.split('.').pop() || 'png').toLowerCase();
          tilesetImages[name] = `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${b64}`;
          tilesets.push({ name, fileName: name });
        }
      } catch {}
    };

    try {
      if (fs.existsSync(assetsPath)) {
        for (const f of fs.readdirSync(assetsPath)) {
          addIfImage(path.join(assetsPath, f), f);
        }
      }
    } catch {}

    try {
      for (const f of fs.readdirSync(projectPath)) {
        addIfImage(path.join(projectPath, f), f);
      }
    } catch {}

    return { tilesetImages, tilesets };
  } catch (e) {
    console.warn('discover-tileset-images failed:', e);
    return { tilesetImages: {}, tilesets: [] };
  }
});

// Return project minimap thumbnail (data URL) if available
ipcMain.handle('get-project-thumbnail', async (event, projectPath) => {
  try {
    if (!projectPath) return null;
    const minimapPath = path.join(projectPath, 'assets', 'minimap.png');
    if (!fs.existsSync(minimapPath)) return null;
    const buf = fs.readFileSync(minimapPath);
    const b64 = buf.toString('base64');
    return `data:image/png;base64,${b64}`;
  } catch (e) {
    console.warn('get-project-thumbnail failed:', e);
    return null;
  }
});

// Check if a project path still exists on disk
ipcMain.handle('check-project-exists', async (event, projectPath) => {
  try {
    if (!projectPath) return false;
    return fs.existsSync(projectPath) && fs.statSync(projectPath).isDirectory();
  } catch (e) {
    console.warn('check-project-exists failed for', projectPath, e);
    return false;
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
