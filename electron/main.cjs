
const { app, BrowserWindow, Menu, dialog, ipcMain: ipcMainLocal } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;
// Check if a file exists (for export overwrite confirmation)
ipcMainLocal.handle('file-exists', async (_event, filePath) => {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
});

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

ipcMainLocal.on('window-minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMainLocal.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMainLocal.on('window-close', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

// Handle file system operations
const fs = require('fs');

// List map files in project/maps directory
ipcMainLocal.handle('list-maps', async (event, projectPath) => {
  try {
    if (!projectPath) return [];
    const mapsDir = path.join(projectPath, 'maps');
    if (!fs.existsSync(mapsDir)) return [];
    const files = fs.readdirSync(mapsDir).filter(f => f.toLowerCase().endsWith('.txt'));
    return files;
  } catch (e) {
    console.error('list-maps failed:', e);
    return [];
  }
});

// Read a map file from project/maps
ipcMainLocal.handle('read-map-file', async (event, projectPath, filename) => {
  try {
    if (!projectPath || !filename) return null;
    const mapsDir = path.join(projectPath, 'maps');
    const full = path.join(mapsDir, filename);
    if (!fs.existsSync(full)) return null;
    const content = fs.readFileSync(full, 'utf8');
    return content;
  } catch (e) {
    console.error('read-map-file failed:', e);
    return null;
  }
});

ipcMainLocal.handle('resolve-path-relative', async (_event, fromPath, toPath) => {
  try {
    if (!fromPath || !toPath) return toPath;
    if (!path.isAbsolute(toPath)) {
      return toPath.replace(/\\/g, '/');
    }
    const fromExists = fs.existsSync(fromPath);
    const baseDir = fromExists && fs.statSync(fromPath).isDirectory()
      ? fromPath
      : path.dirname(fromPath);
    const relative = path.relative(baseDir, toPath);
    return relative ? relative.replace(/\\/g, '/') : toPath;
  } catch (error) {
    console.error('resolve-path-relative failed:', error);
    return toPath;
  }
});

ipcMainLocal.handle('update-spawn-file', async (_event, projectPath, content) => {
  try {
    if (!projectPath) return false;
    const mapsDir = path.join(projectPath, 'maps');
    if (!fs.existsSync(mapsDir)) {
      fs.mkdirSync(mapsDir, { recursive: true });
    }
    const spawnPath = path.join(mapsDir, 'spawn.txt');
    const data = typeof content === 'string' ? content : '';
    fs.writeFileSync(spawnPath, data, 'utf8');
    return true;
  } catch (error) {
    console.error('update-spawn-file failed:', error);
    return false;
  }
});

ipcMainLocal.handle('read-spawn-file', async (_event, projectPath) => {
  try {
    if (!projectPath) return null;
    const spawnPath = path.join(projectPath, 'maps', 'spawn.txt');
    if (!fs.existsSync(spawnPath)) return null;
    return fs.readFileSync(spawnPath, 'utf8');
  } catch (error) {
    console.error('read-spawn-file failed:', error);
    return null;
  }
});


ipcMainLocal.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMainLocal.handle('select-tileset-file', async () => {
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

ipcMainLocal.handle('create-map-project', async (event, config) => {
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

    // Create images/tilesets folder structure
    const imagesPath = path.join(projectPath, 'images');
    const tilesetsPath = path.join(imagesPath, 'tilesets');
    if (!fs.existsSync(imagesPath)) {
      fs.mkdirSync(imagesPath, { recursive: true });
    }
    if (!fs.existsSync(tilesetsPath)) {
      fs.mkdirSync(tilesetsPath, { recursive: true });
    }

    // Create maps folder
    const mapsPath = path.join(projectPath, 'maps');
    if (!fs.existsSync(mapsPath)) {
      fs.mkdirSync(mapsPath);
    }

    // Create a default settings.txt in the project root so the project is recognized by Flare
    try {
      const settingsContent = `description=${config.name || '--> Project Name comes here.'}\n` +
        `game=flare-game\n` +
        `version=1.14\n` +
        `engine_version_min=1.13.01\n`;
      const settingsPath = path.join(projectPath, 'settings.txt');
      fs.writeFileSync(settingsPath, settingsContent, 'utf8');
      console.log('Created default settings.txt at', settingsPath);
    } catch (settingsErr) {
      console.warn('Failed to write default settings.txt during project creation:', settingsErr);
    }

    // Do not create spawn.txt yet. It will be generated when a starting map is selected.

    return true;
  } catch (error) {
    console.error('Error creating map project:', error);
    return false;
  }
});

ipcMainLocal.handle('open-map-project', async (event, projectPath) => {
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
      
      // Ensure tilesetImages are present; if missing, attempt to load from images/tilesets (or legacy paths)
      try {
        const imagesPath = path.join(projectPath, 'images');
        const tilesetsPath = path.join(imagesPath, 'tilesets');
        const legacyAssetsPath = path.join(projectPath, 'assets');
        const searchDirs = [tilesetsPath, legacyAssetsPath, projectPath];
        const ensureTilesetImages = {};
        if (mapData.tilesetImages && typeof mapData.tilesetImages === 'object') {
          Object.assign(ensureTilesetImages, mapData.tilesetImages);
        }

        const toDataUrl = (filePath) => {
          const fileBuf = fs.readFileSync(filePath);
          const ext = (path.extname(filePath).slice(1) || 'png').toLowerCase();
          const normalizedExt = ext === 'jpg' ? 'jpeg' : ext;
          return `data:image/${normalizedExt};base64,${fileBuf.toString('base64')}`;
        };

        if (Array.isArray(mapData.tilesets)) {
          for (const ts of mapData.tilesets) {
            const fileName = ts?.fileName || ts?.name;
            if (!fileName) continue;
            const hasEmbedded = ensureTilesetImages[fileName] && typeof ensureTilesetImages[fileName] === 'string';
            if (hasEmbedded) continue;

            for (const dir of searchDirs) {
              if (!dir) continue;
              const candidatePath = path.join(dir, fileName);
              if (fs.existsSync(candidatePath)) {
                ensureTilesetImages[fileName] = toDataUrl(candidatePath);
                const relativeSource = path.relative(projectPath, candidatePath) || candidatePath;
                console.log(`Embedded tileset from ${relativeSource}: ${fileName}`);
                break;
              }
            }
          }
        }

        const haveAnyEmbedded = Object.keys(ensureTilesetImages).length > 0;
        if ((!Array.isArray(mapData.tilesets) || mapData.tilesets.length === 0) && !haveAnyEmbedded) {
          const candidates = [];
          for (const dir of searchDirs) {
            try {
              if (dir && fs.existsSync(dir)) {
                for (const f of fs.readdirSync(dir)) {
                  if (/\\.(png|jpg|jpeg)$/i.test(f)) {
                    candidates.push({ name: f, fullPath: path.join(dir, f) });
                  }
                }
              }
            } catch {}
          }
          if (candidates.length > 0) {
            const first = candidates[0];
            ensureTilesetImages[first.name] = toDataUrl(first.fullPath);
            mapData.tilesets = [{ name: first.name, fileName: first.name }];
            const relativeSource = path.relative(projectPath, first.fullPath) || first.fullPath;
            console.log(`Synthesized tileset from discovered image: ${relativeSource}`);
          }
        }

        if (Object.keys(ensureTilesetImages).length > 0) {
          mapData.tilesetImages = ensureTilesetImages;
        }
      } catch (embErr) {
        console.warn('Warning while embedding tilesets from project files:', embErr);
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
ipcMainLocal.handle('save-map-project', async (event, projectPath, mapData) => {
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
    
    // Save tileset images to images/tilesets if they exist
    if (mapData.tilesetImages) {
      console.log('Processing tileset images:', Object.keys(mapData.tilesetImages));
      const imagesPath = path.join(projectPath, 'images');
      const tilesetsPath = path.join(imagesPath, 'tilesets');
      if (!fs.existsSync(imagesPath)) {
        fs.mkdirSync(imagesPath, { recursive: true });
        console.log('Created images directory');
      }
      if (!fs.existsSync(tilesetsPath)) {
        fs.mkdirSync(tilesetsPath, { recursive: true });
        console.log('Created tilesets directory');
      }

      for (const [filename, imageData] of Object.entries(mapData.tilesetImages)) {
        if (imageData && typeof imageData === 'string') {
          console.log('Saving image:', filename, 'Data length:', imageData.length);
          const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
          const imagePath = path.join(tilesetsPath, filename);
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
        const imagesPath = path.join(projectPath, 'images');
        if (!fs.existsSync(imagesPath)) {
          fs.mkdirSync(imagesPath, { recursive: true });
        }
        const minimapPath = path.join(imagesPath, 'minimap.png');
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
ipcMainLocal.handle('save-export-files', async (event, projectPath, mapName, mapTxt, tilesetDef, options = {}) => {
  try {
    if (!projectPath) {
      throw new Error('Project path is required');
    }
    if (!fs.existsSync(projectPath)) {
      throw new Error('Project path does not exist');
    }

    const mapsDir = path.join(projectPath, 'maps');
    if (!fs.existsSync(mapsDir)) {
      fs.mkdirSync(mapsDir, { recursive: true });
    }

    // Create tilesetdefs directory
    const tilesetDefsDir = path.join(projectPath, 'tilesetdefs');
    if (!fs.existsSync(tilesetDefsDir)) {
      fs.mkdirSync(tilesetDefsDir, { recursive: true });
    }

    const sanitize = (input) => {
      return String(input || '')
        .replace(/[<>:"/\|?*]/g, '_')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/_{2,}/g, '_')
        || 'Map_Name';
    };


    const sanitizedMapName = sanitize(mapName);
    const mapFilePath = path.join(mapsDir, `${sanitizedMapName}.txt`);
    const tilesetFilePath = path.join(tilesetDefsDir, `tileset_${sanitizedMapName}.txt`);

    fs.writeFileSync(mapFilePath, mapTxt, 'utf8');
    fs.writeFileSync(tilesetFilePath, tilesetDef, 'utf8');

    // Also create a settings.txt in the project root so the exported mod is recognized by Flare
    try {
      const settingsContent = `description=${(mapName && String(mapName).trim()) || sanitizedMapName || '--> Project Name comes here.'}\n` +
        `game=flare-game\n` +
        `version=1.14\n` +
        `engine_version_min=1.13.01\n`;
      const settingsPath = path.join(projectPath, 'settings.txt');
      fs.writeFileSync(settingsPath, settingsContent, 'utf8');
      console.log('Created settings.txt at', settingsPath);
    } catch (settingsErr) {
      console.warn('Failed to write settings.txt:', settingsErr);
    }

    if (options.spawn && options.spawn.enabled && options.spawn.content) {
      const spawnFilename = options.spawn.filename || 'spawn.txt';
      const spawnPath = path.join(mapsDir, spawnFilename);
      fs.writeFileSync(spawnPath, options.spawn.content, 'utf8');
      console.log('Spawn file saved:', spawnPath);
    }

  console.log('Export files saved successfully:');
  console.log('- Map:', mapFilePath);
  console.log('- Tileset:', tilesetFilePath);
    return true;
  } catch (error) {
    console.error('Error saving export files:', error);
    return false;
  }
});



// Discover tileset images in a project folder and return as data URLs
ipcMainLocal.handle('discover-tileset-images', async (event, projectPath) => {
  try {
    if (!projectPath) return { tilesetImages: {}, tilesets: [] };
    const tilesetImages = {};
    const tilesets = [];
    const imagesPath = path.join(projectPath, 'images');
    const tilesetsPath = path.join(imagesPath, 'tilesets');
    const legacyAssetsPath = path.join(projectPath, 'assets');
    const searchDirs = [tilesetsPath, legacyAssetsPath, projectPath];

    const addIfImage = (fullPath, name) => {
      try {
        if (/\.(png|jpg|jpeg)$/i.test(name) && fs.existsSync(fullPath)) {
          const buf = fs.readFileSync(fullPath);
          const b64 = buf.toString('base64');
          const ext = (name.split('.').pop() || 'png').toLowerCase();
          const normalizedExt = ext === 'jpg' ? 'jpeg' : ext;
          tilesetImages[name] = `data:image/${normalizedExt};base64,${b64}`;
          tilesets.push({ name, fileName: name });
        }
      } catch {}
    };

    for (const dir of searchDirs) {
      try {
        if (!dir || !fs.existsSync(dir)) continue;
        for (const f of fs.readdirSync(dir)) {
          addIfImage(path.join(dir, f), f);
        }
      } catch {}
    }

    return { tilesetImages, tilesets };
  } catch (e) {
    console.warn('discover-tileset-images failed:', e);
    return { tilesetImages: {}, tilesets: [] };
  }
});

// Return project minimap thumbnail (data URL) if available
ipcMainLocal.handle('get-project-thumbnail', async (event, projectPath) => {
  try {
    if (!projectPath) return null;
    const imagesMinimapPath = path.join(projectPath, 'images', 'minimap.png');
    const legacyMinimapPath = path.join(projectPath, 'assets', 'minimap.png');
    let minimapPath = imagesMinimapPath;
    if (!fs.existsSync(minimapPath) && fs.existsSync(legacyMinimapPath)) {
      minimapPath = legacyMinimapPath;
    }
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
ipcMainLocal.handle('check-project-exists', async (event, projectPath) => {
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
