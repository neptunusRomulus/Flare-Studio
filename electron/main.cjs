
const { app, BrowserWindow, Menu, dialog, ipcMain: ipcMainLocal } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = !app.isPackaged;

const resolveRuntimePath = (packagedSegments, devSegments) => {
  const base = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');
  const segments = app.isPackaged ? packagedSegments : devSegments;
  return path.join(base, ...segments);
};

const getPlatformIcon = () => {
  if (process.platform === 'win32') {
    return resolveRuntimePath(['icons', 'flare.ico'], ['build', 'icons', 'flare.ico']);
  }
  if (process.platform === 'darwin') {
    return resolveRuntimePath(['icons', 'flare.icns'], ['build', 'icons', 'flare.icns']);
  }
  return resolveRuntimePath(['icons', 'flare.png'], ['build', 'icons', 'flare.png']);
};

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
    icon: getPlatformIcon(),
    title: 'Isometric Tile Map Editor'
  });

  // Load the app
  if (isDev) {
    // Vite dev server runs on 5173 (configured in vite.config.js)
    mainWindow.loadURL('http://localhost:5173');
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
// Session file for storing tabs and editor state per project
const SESSION_FILENAME = '.flare-session.json';

// Read session data from project folder
ipcMainLocal.handle('read-session', async (event, projectPath) => {
  try {
    if (!projectPath) return null;
    const sessionFile = path.join(projectPath, SESSION_FILENAME);
    if (!fs.existsSync(sessionFile)) return null;
    const content = fs.readFileSync(sessionFile, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.error('read-session failed:', e);
    return null;
  }
});

// Write session data to project folder
ipcMainLocal.handle('write-session', async (event, projectPath, sessionData) => {
  try {
    if (!projectPath || !sessionData) return false;
    const sessionFile = path.join(projectPath, SESSION_FILENAME);
    fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('write-session failed:', e);
    return false;
  }
});

// Write NPC file to project's npcs folder
ipcMainLocal.handle('write-npc-file', async (event, projectPath, filename, content) => {
  try {
    if (!projectPath || !filename || !content) return false;
    
    // Ensure npcs folder exists
    const npcsFolder = path.join(projectPath, 'npcs');
    if (!fs.existsSync(npcsFolder)) {
      fs.mkdirSync(npcsFolder, { recursive: true });
    }
    
    // Get just the filename part (strip npcs/ prefix if present)
    const npcFilename = filename.replace(/^npcs[\/\\]/, '');
    const npcFilePath = path.join(npcsFolder, npcFilename);
    
    // Write the file
    fs.writeFileSync(npcFilePath, content, 'utf8');
    console.log('NPC file saved:', npcFilePath);
    return true;
  } catch (e) {
    console.error('write-npc-file failed:', e);
    return false;
  }
});

// List map files in project
// Looks for:
// 1. .json map files in project root (editor format) - validated to have map structure
// 2. .txt map files in maps/ folder (Flare export format)
ipcMainLocal.handle('list-maps', async (event, projectPath) => {
  try {
    if (!projectPath) return [];
    
    const maps = [];
    const projectFolderName = path.basename(projectPath).toLowerCase();
    
    // Check for .json map files in project root (exclude session file)
    const rootFiles = fs.readdirSync(projectPath);
    for (const f of rootFiles) {
      const lower = f.toLowerCase();
      if (lower.endsWith('.json') && lower !== '.flare-session.json') {
        // Read the file to check if it's a valid map (has layers array with content)
        try {
          const filePath = path.join(projectPath, f);
          const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          const baseName = f.replace(/\.json$/i, '');
          
          // A valid map MUST have a layers array with at least one layer
          const hasLayers = Array.isArray(content.layers) && content.layers.length > 0;
          
          // Skip files that match the project folder name and don't have layers
          // This is the old project config file format
          const isOldProjectConfig = baseName.toLowerCase() === projectFolderName && !hasLayers;
          
          if (hasLayers && !isOldProjectConfig) {
            maps.push(f);
            console.log('Found valid map file:', f, 'name:', content.name, 'layers:', content.layers?.length || 0);
          } else {
            console.log('Skipping non-map JSON file:', f, '(isOldProjectConfig:', isOldProjectConfig, 'hasLayers:', hasLayers, ')');
          }
        } catch (e) {
          console.warn('Could not read/parse JSON file:', f, e.message);
        }
      }
    }
    
    // Also check maps/ folder for .txt exports (these are Flare format)
    const mapsDir = path.join(projectPath, 'maps');
    if (fs.existsSync(mapsDir)) {
      const mapsDirFiles = fs.readdirSync(mapsDir);
      for (const f of mapsDirFiles) {
        const lower = f.toLowerCase();
        // Only include .txt files that are actual maps, exclude spawn.txt
        if (lower.endsWith('.txt') && lower !== 'spawn.txt') {
          // Check if we already have the .json version
          const baseName = f.replace(/\.txt$/i, '');
          const hasJsonVersion = maps.some(m => m.replace(/\.json$/i, '').toLowerCase() === baseName.toLowerCase());
          if (!hasJsonVersion) {
            maps.push(f);
          }
        }
      }
    }
    
    console.log('list-maps final result:', maps);
    return maps;
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

ipcMainLocal.handle('open-map-project', async (event, projectPath, mapName) => {
  try {
    console.log('=== ELECTRON LOAD DEBUG ===');
    console.log('Loading project from:', projectPath);
    console.log('Requested map name:', mapName);
    
    // Look for map configuration file. If a specific mapName is provided
    // ONLY load that specific file - do NOT fall back to a random JSON file.
    const files = fs.readdirSync(projectPath);
    let mapFile = null;
    if (mapName && typeof mapName === 'string') {
      const candidate = `${mapName}.json`;
      if (files.includes(candidate)) {
        mapFile = candidate;
      } else {
        console.log('Requested map file not found:', candidate);
        // Return null instead of falling back to wrong file
        return null;
      }
    } else {
      // No specific map requested - find the first valid map file
      mapFile = files.find(file => file.endsWith('.json') && file !== SESSION_FILENAME) || null;
    }

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
    console.log('Map name:', mapData?.name);
    
    if (!projectPath || !mapData) {
      console.error('Invalid save parameters:', { projectPath, hasMapData: !!mapData });
      return false;
    }

    // Use the map name to create the file (each map gets its own .json file)
    const mapName = mapData.name || 'Untitled Map';
    // Sanitize the map name for use as filename
    const sanitizedName = mapName
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_{2,}/g, '_')
      .trim() || 'map';
    const mapFile = `${sanitizedName}.json`;
    
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

    // If exporter provided tileset images (base64 data URLs), save them to images/tilesets
    try {
      if (options.tilesetImages && typeof options.tilesetImages === 'object') {
        const imagesPath = path.join(projectPath, 'images');
        const tilesetsPath = path.join(imagesPath, 'tilesets');
        if (!fs.existsSync(imagesPath)) fs.mkdirSync(imagesPath, { recursive: true });
        if (!fs.existsSync(tilesetsPath)) fs.mkdirSync(tilesetsPath, { recursive: true });

        for (const [filename, imageData] of Object.entries(options.tilesetImages)) {
          if (imageData && typeof imageData === 'string') {
            console.log('Export: saving tileset image', filename, 'length', imageData.length);
            const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
            const imagePath = path.join(tilesetsPath, filename);
            fs.writeFileSync(imagePath, base64Data, 'base64');
            console.log('Export: saved tileset image to', imagePath);
          }
        }
      }
    } catch (imgErr) {
      console.warn('Failed to save exported tileset images:', imgErr);
    }

    // If exporter provided NPC files, save them to npcs/ folder
    try {
      if (options.npcFiles && Array.isArray(options.npcFiles) && options.npcFiles.length > 0) {
        const npcsDir = path.join(projectPath, 'npcs');
        if (!fs.existsSync(npcsDir)) {
          fs.mkdirSync(npcsDir, { recursive: true });
          console.log('Created npcs directory:', npcsDir);
        }

        for (const npcFile of options.npcFiles) {
          if (npcFile && npcFile.filename && npcFile.content) {
            const npcFilePath = path.join(npcsDir, npcFile.filename);
            fs.writeFileSync(npcFilePath, npcFile.content, 'utf8');
            console.log('Export: saved NPC file to', npcFilePath);
          }
        }
      }
    } catch (npcErr) {
      console.warn('Failed to save NPC files:', npcErr);
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

// Read an arbitrary image file and return as data URL (for renderer use)
ipcMainLocal.handle('read-file-dataurl', async (_event, filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const ext = (filePath.split('.').pop() || 'png').toLowerCase();
    const normalizedExt = ext === 'jpg' ? 'jpeg' : ext;
    const buf = fs.readFileSync(filePath);
    const b64 = buf.toString('base64');
    return `data:image/${normalizedExt};base64,${b64}`;
  } catch (e) {
    console.warn('read-file-dataurl failed for', filePath, e);
    return null;
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

// Create NPC file in project's npcs/ folder
ipcMainLocal.handle('create-npc-file', async (event, projectPath, npcData) => {
  try {
    if (!projectPath) {
      throw new Error('Project path is required');
    }
    if (!fs.existsSync(projectPath)) {
      throw new Error('Project path does not exist');
    }
    if (!npcData || !npcData.name) {
      throw new Error('NPC name is required');
    }

    // Create npcs directory if it doesn't exist
    const npcsDir = path.join(projectPath, 'npcs');
    if (!fs.existsSync(npcsDir)) {
      fs.mkdirSync(npcsDir, { recursive: true });
      console.log('Created npcs directory:', npcsDir);
    }

    // Sanitize NPC name for filename
    const sanitize = (input) => {
      return String(input || '')
        .toLowerCase()
        .replace(/[<>:"/\\|?*]/g, '_')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/_{2,}/g, '_')
        || 'unnamed_npc';
    };

    const sanitizedName = sanitize(npcData.name);
    const npcFilePath = path.join(npcsDir, `${sanitizedName}.txt`);

    // Build NPC file content in Flare format
    const lines = [];
    
    // Name
    lines.push(`name=${npcData.name}`);
    lines.push('');
    
    // Portrait (if provided)
    if (npcData.portraitPath) {
      lines.push(`portrait=${npcData.portraitPath}`);
      lines.push('');
    }
    
    // Role-based attributes
    const role = npcData.role || 'static';
    
    if (role === 'vendor') {
      lines.push(`# shop info`);
      lines.push(`vendor=true`);
      lines.push(`# TODO: Add stock items`);
      lines.push(`# constant_stock=item_id:count,item_id:count`);
      lines.push('');
    }
    
    // Animation/Tileset (if provided)
    if (npcData.tilesetPath) {
      lines.push(`# animation info`);
      lines.push(`animations=${npcData.tilesetPath}`);
      lines.push('');
    }
    
    if (role === 'talker' || role === 'vendor' || role === 'quest') {
      lines.push(`talker=true`);
      lines.push('');
    }
    
    // Quest giver note (editor-only, as comment)
    if (role === 'quest') {
      lines.push(`# This NPC is marked as a Quest Giver in the editor.`);
      lines.push(`# Quest assignments are defined in quests/*.txt files with giver=npcs/${sanitizedName}.txt`);
      lines.push('');
    }
    
    // Static NPC note
    if (role === 'static') {
      lines.push(`# This NPC is decorative and has no interaction.`);
      lines.push('');
    }
    
    // Placeholder for dialog (if talker)
    if (role === 'talker' || role === 'vendor' || role === 'quest') {
      lines.push(`# Dialog sections`);
      lines.push(`# [dialog]`);
      lines.push(`# topic=Talk`);
      lines.push(`# him=Hello, traveler!`);
      lines.push('');
    }

    const npcContent = lines.join('\n');
    fs.writeFileSync(npcFilePath, npcContent, 'utf8');
    
    console.log('NPC file created:', npcFilePath);
    return { success: true, filePath: npcFilePath, filename: `${sanitizedName}.txt` };
  } catch (error) {
    console.error('Error creating NPC file:', error);
    return { success: false, error: error.message };
  }
});

// Ensure items and items/categories folders exist
ipcMainLocal.handle('ensure-items-folders', async (event, projectPath) => {
  try {
    if (!projectPath || !fs.existsSync(projectPath)) {
      throw new Error('Project path is required and must exist');
    }

    const itemsDir = path.join(projectPath, 'items');
    const categoriesDir = path.join(itemsDir, 'categories');

    if (!fs.existsSync(itemsDir)) {
      fs.mkdirSync(itemsDir, { recursive: true });
      console.log('Created items directory:', itemsDir);
    }

    if (!fs.existsSync(categoriesDir)) {
      fs.mkdirSync(categoriesDir, { recursive: true });
      console.log('Created items/categories directory:', categoriesDir);
    }

    // Create qualities.txt file if it doesn't exist
    const qualitiesFile = path.join(itemsDir, 'qualities.txt');
    if (!fs.existsSync(qualitiesFile)) {
      const qualitiesContent = `[quality]
id=low
name=Low
color=127,127,127
overlay_icon=1024

[quality]
id=normal
name=Normal
color=255,255,255
overlay_icon=1025

[quality]
id=high
name=High
color=64,255,64
overlay_icon=1026

[quality]
id=epic
name=Epic
color=64,128,255
overlay_icon=1027

[quality]
id=rare
name=Rare
color=160,64,255
overlay_icon=1028

[quality]
id=unique
name=Unique
color=255,192,64
overlay_icon=1029

[quality]
id=one_time_use
name=One-time Use
color=64,255,255
overlay_icon=1030

[quality]
id=currency
name=Currency
color=255,232,156
overlay_icon=1031
`;
      fs.writeFileSync(qualitiesFile, qualitiesContent, 'utf8');
      console.log('Created qualities.txt file:', qualitiesFile);
    }

    return { success: true };
  } catch (error) {
    console.error('Error ensuring items folders:', error);
    return { success: false, error: error.message };
  }
});

// Get item categories (subdirectories of items/categories)
ipcMainLocal.handle('get-item-categories', async (event, projectPath) => {
  try {
    if (!projectPath || !fs.existsSync(projectPath)) {
      return { success: true, categories: ['Default'] };
    }

    const categoriesDir = path.join(projectPath, 'items', 'categories');
    const categories = ['Default']; // Default is always first

    if (fs.existsSync(categoriesDir)) {
      const entries = fs.readdirSync(categoriesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          categories.push(entry.name);
        }
      }
    }

    return { success: true, categories };
  } catch (error) {
    console.error('Error getting item categories:', error);
    return { success: false, error: error.message, categories: ['Default'] };
  }
});

// Create a new item category folder
ipcMainLocal.handle('create-item-category', async (event, projectPath, categoryName) => {
  try {
    if (!projectPath || !fs.existsSync(projectPath)) {
      throw new Error('Project path is required and must exist');
    }
    if (!categoryName || !categoryName.trim()) {
      throw new Error('Category name is required');
    }

    const sanitize = (input) => {
      return String(input || '')
        .replace(/[<>:"/\\|?*]/g, '_')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/_{2,}/g, '_')
        || 'unnamed_category';
    };

    const sanitizedName = sanitize(categoryName);
    const categoriesDir = path.join(projectPath, 'items', 'categories');
    const categoryDir = path.join(categoriesDir, sanitizedName);

    // Ensure items/categories exists
    if (!fs.existsSync(categoriesDir)) {
      fs.mkdirSync(categoriesDir, { recursive: true });
    }

    if (!fs.existsSync(categoryDir)) {
      fs.mkdirSync(categoryDir, { recursive: true });
      console.log('Created item category:', categoryDir);
    }

    return { success: true, categoryName: sanitizedName, categoryPath: categoryDir };
  } catch (error) {
    console.error('Error creating item category:', error);
    return { success: false, error: error.message };
  }
});

// Get next item ID by scanning existing items
ipcMainLocal.handle('get-next-item-id', async (event, projectPath) => {
  try {
    if (!projectPath || !fs.existsSync(projectPath)) {
      return { success: true, nextId: 1 };
    }

    const itemsDir = path.join(projectPath, 'items');
    let maxId = 0;

    const scanDir = (dir) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.name.endsWith('.txt')) {
          // Read file and extract id
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const match = content.match(/^id=(\d+)/m);
            if (match) {
              const id = parseInt(match[1], 10);
              if (id > maxId) maxId = id;
            }
          } catch (e) {
            // Ignore read errors
          }
        }
      }
    };

    scanDir(itemsDir);
    return { success: true, nextId: maxId + 1 };
  } catch (error) {
    console.error('Error getting next item ID:', error);
    return { success: true, nextId: 1 };
  }
});

// Create item file
ipcMainLocal.handle('create-item-file', async (event, projectPath, itemData) => {
  try {
    if (!projectPath || !fs.existsSync(projectPath)) {
      throw new Error('Project path is required and must exist');
    }
    if (!itemData || !itemData.name) {
      throw new Error('Item name is required');
    }

    const sanitize = (input) => {
      return String(input || '')
        .toLowerCase()
        .replace(/[<>:"/\\|?*]/g, '_')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/_{2,}/g, '_')
        || 'unnamed_item';
    };

    const sanitizedName = sanitize(itemData.name);
    const category = itemData.category || 'Default';
    
    let targetDir;
    if (category === 'Default') {
      targetDir = path.join(projectPath, 'items');
    } else {
      targetDir = path.join(projectPath, 'items', 'categories', category);
    }

    // Ensure target directory exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Build a unique filename to avoid overwriting items with the same name (e.g., different roles)
    const baseFilename = `${sanitizedName}_${itemData.id}`;
    const itemFilePath = path.join(targetDir, `${baseFilename}.txt`);

    // Build item file content
    const lines = [];
    const role = (itemData.role || '').toLowerCase() || 'unspecified';
    const resourceSubtype = (itemData.resourceSubtype || '').toLowerCase();
    lines.push(`# role=${role}`);
    if (role === 'resource' && resourceSubtype) {
      lines.push(`# resource_subtype=${resourceSubtype}`);
    }
    lines.push('[item]');
    lines.push(`id=${itemData.id}`);
    lines.push(`name=${itemData.name}`);
    lines.push('');

    const itemContent = lines.join('\n');
    fs.writeFileSync(itemFilePath, itemContent, 'utf8');

    console.log('Item file created:', itemFilePath);
    return { success: true, filePath: itemFilePath, filename: `${sanitizedName}.txt` };
  } catch (error) {
    console.error('Error creating item file:', error);
    return { success: false, error: error.message };
  }
});

// List all items in the project
ipcMainLocal.handle('list-items', async (event, projectPath) => {
  try {
    if (!projectPath || !fs.existsSync(projectPath)) {
      return { success: true, items: [] };
    }

    const itemsDir = path.join(projectPath, 'items');
    const items = [];

    const parseItemFile = (filePath, category) => {
      try {
        // Only treat files with an [item] section as items (skip qualities.txt, etc.)
        const content = fs.readFileSync(filePath, 'utf8');
        if (!/\[item\]/i.test(content)) {
          return null;
        }

        const idMatch = content.match(/^id=(\d+)/m);
        const nameMatch = content.match(/^name=(.+)$/m);
        const roleMatch = content.match(/^\s*(?:#\s*)?(?:role|item_role)=([a-zA-Z_]+)/m);
        const resourceSubtypeMatch = content.match(/^\s*(?:#\s*)?resource_subtype=([a-zA-Z_]+)/m);
        
        return {
          id: idMatch ? parseInt(idMatch[1], 10) : 0,
          name: nameMatch ? nameMatch[1].trim() : path.basename(filePath, '.txt'),
          category: category,
          filePath: filePath,
          fileName: path.basename(filePath),
          role: roleMatch ? roleMatch[1].toLowerCase() : 'unspecified',
          resourceSubtype: resourceSubtypeMatch ? resourceSubtypeMatch[1].toLowerCase() : ''
        };
      } catch (e) {
        return null;
      }
    };

    const scanDir = (dir, category) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          // Skip the 'categories' folder at root level, scan its subdirs instead
          if (entry.name === 'categories' && dir === itemsDir) {
            const catEntries = fs.readdirSync(fullPath, { withFileTypes: true });
            for (const catEntry of catEntries) {
              if (catEntry.isDirectory()) {
                scanDir(path.join(fullPath, catEntry.name), catEntry.name);
              }
            }
          }
        } else if (entry.name.endsWith('.txt')) {
          const item = parseItemFile(fullPath, category);
          if (item) {
            items.push(item);
          }
        }
      }
    };

    scanDir(itemsDir, 'Default');
    
    // Sort by ID
    items.sort((a, b) => a.id - b.id);

    return { success: true, items };
  } catch (error) {
    console.error('Error listing items:', error);
    return { success: false, error: error.message, items: [] };
  }
});

// Read item file and parse all properties
ipcMainLocal.handle('read-item-file', async (event, filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return { success: false, error: 'Item file not found' };
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const data = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('[')) continue;
      
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.substring(0, eqIndex).trim();
        const value = trimmed.substring(eqIndex + 1).trim();
        data[key] = value;
      }
    }

    // Convert numeric fields
    if (data.id) data.id = parseInt(data.id, 10) || 0;
    if (data.level) data.level = parseInt(data.level, 10) || 1;
    if (data.max_quantity) data.max_quantity = parseInt(data.max_quantity, 10) || 1;
    if (data.requires_level) data.requires_level = parseInt(data.requires_level, 10) || 0;
    if (data.loot_drops_max) data.loot_drops_max = parseInt(data.loot_drops_max, 10) || 1;

    return { success: true, data };
  } catch (error) {
    console.error('Error reading item file:', error);
    return { success: false, error: error.message };
  }
});

// Write item file with all properties
ipcMainLocal.handle('write-item-file', async (event, filePath, itemData) => {
  try {
    if (!filePath) {
      return { success: false, error: 'File path is required' };
    }

    // Preserve role metadata if present, even if edit UI does not expose it yet
    let role = typeof itemData.role === 'string' ? itemData.role : '';
    let resourceSubtype = typeof itemData.resourceSubtype === 'string' ? itemData.resourceSubtype : '';
    try {
      if ((!role || !resourceSubtype) && fs.existsSync(filePath)) {
        const existing = fs.readFileSync(filePath, 'utf8');
        const roleMatch = existing.match(/^\s*(?:#\s*)?(?:role|item_role)=([a-zA-Z_]+)/m);
        const resourceMatch = existing.match(/^\s*(?:#\s*)?resource_subtype=([a-zA-Z_]+)/m);
        if (!role && roleMatch) role = roleMatch[1];
        if (!resourceSubtype && resourceMatch) resourceSubtype = resourceMatch[1];
      }
    } catch {
      // ignore preservation errors
    }

    const normalizedRole = (role || '').toLowerCase() || 'unspecified';
    const normalizedResourceSubtype = (resourceSubtype || '').toLowerCase();

    const lines = [];
    lines.push(`# role=${normalizedRole}`);
    if (normalizedRole === 'resource' && normalizedResourceSubtype) {
      lines.push(`# resource_subtype=${normalizedResourceSubtype}`);
    }
    lines.push('[item]');
    
    // Basic Identifier Properties
    if (itemData.id !== undefined) lines.push(`id=${itemData.id}`);
    if (itemData.name) lines.push(`name=${itemData.name}`);
    if (itemData.flavor) lines.push(`flavor=${itemData.flavor}`);
    if (itemData.level && itemData.level > 1) lines.push(`level=${itemData.level}`);
    if (itemData.icon) lines.push(`icon=${itemData.icon}`);
    if (itemData.quality) lines.push(`quality=${itemData.quality}`);
    
    // Trade and Inventory Properties
    if (itemData.price) lines.push(`price=${itemData.price}`);
    if (itemData.price_sell) lines.push(`price_sell=${itemData.price_sell}`);
    if (itemData.max_quantity && itemData.max_quantity > 1) lines.push(`max_quantity=${itemData.max_quantity}`);
    if (itemData.quest_item) lines.push(`quest_item=true`);
    if (itemData.no_stash && itemData.no_stash !== 'ignore') lines.push(`no_stash=${itemData.no_stash}`);
    
    // Equipment and Requirement Properties
    if (itemData.item_type) lines.push(`item_type=${itemData.item_type}`);
    if (itemData.equip_flags) lines.push(`equip_flags=${itemData.equip_flags}`);
    if (itemData.requires_level && itemData.requires_level > 0) lines.push(`requires_level=${itemData.requires_level}`);
    if (itemData.requires_stat) lines.push(`requires_stat=${itemData.requires_stat}`);
    if (itemData.requires_class) lines.push(`requires_class=${itemData.requires_class}`);
    if (itemData.disable_slots) lines.push(`disable_slots=${itemData.disable_slots}`);
    if (itemData.gfx) lines.push(`gfx=${itemData.gfx}`);
    
    // Status and Effect Properties (Bonuses)
    if (itemData.bonus) lines.push(`bonus=${itemData.bonus}`);
    if (itemData.bonus_power_level) lines.push(`bonus_power_level=${itemData.bonus_power_level}`);
    
    // Usage and Power Properties
    if (itemData.dmg) lines.push(`dmg=${itemData.dmg}`);
    if (itemData.abs) lines.push(`abs=${itemData.abs}`);
    if (itemData.power) lines.push(`power=${itemData.power}`);
    if (itemData.power_desc) lines.push(`power_desc=${itemData.power_desc}`);
    if (itemData.replace_power) lines.push(`replace_power=${itemData.replace_power}`);
    if (itemData.book) lines.push(`book=${itemData.book}`);
    if (itemData.book_is_readable) lines.push(`book_is_readable=true`);
    if (itemData.script) lines.push(`script=${itemData.script}`);
    
    // Visual and Audio Properties
    if (itemData.soundfx) lines.push(`soundfx=${itemData.soundfx}`);
    if (itemData.stepfx) lines.push(`stepfx=${itemData.stepfx}`);
    if (itemData.loot_animation) lines.push(`loot_animation=${itemData.loot_animation}`);
    
    // Randomization and Loot Properties
    if (itemData.randomizer_def) lines.push(`randomizer_def=${itemData.randomizer_def}`);
    if (itemData.loot_drops_max && itemData.loot_drops_max > 1) lines.push(`loot_drops_max=${itemData.loot_drops_max}`);
    if (itemData.pickup_status) lines.push(`pickup_status=${itemData.pickup_status}`);

    lines.push('');
    
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    return { success: true };
  } catch (error) {
    console.error('Error writing item file:', error);
    return { success: false, error: error.message };
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
