const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  shell,
  ipcMain: ipcMainLocal,
} = require("electron");
const path = require("path");
const fs = require("fs");
const { validateSerializedFlareData, loadFlareDataSchema } = require("./flareDataValidator.cjs");
const flareLaunch = require("./flareLaunch.cjs");
const flareAdapter = require("../src/adapters/flare/flareAdapter.cjs");
const { isInsideRoot } = require("../src/editor/pathGuard.cjs");
const allowedProjectRoots = new Set();

function rememberProjectRoot(projectPath) {
  if (typeof projectPath !== "string" || !projectPath) return;
  allowedProjectRoots.add(path.resolve(projectPath));
}

function isAllowedProjectPath(targetPath) {
  if (typeof targetPath !== "string" || !targetPath) return false;
  for (const root of allowedProjectRoots) {
    if (isInsideRoot(root, targetPath)) return true;
  }
  return false;
}
const isDev = !app.isPackaged;
const validationRoot = path.join(__dirname, "..");
const PLAY_SESSION_DIR = ".flare-studio";
const PLAY_SESSION_FILE = "play-session.json";

function currentPathUser() {
  return flareLaunch.resolvePathUser(process.platform, process.env, process.cwd());
}

function writeProjectSettings(projectPath, projectName) {
  const settingsPath = path.join(projectPath, "settings.txt");
  const existing = fs.existsSync(settingsPath) ? fs.readFileSync(settingsPath, "utf8") : null;
  const plan = flareLaunch.planSettingsWrite(existing, projectName || path.basename(projectPath));
  if (!plan.write) return false;
  fs.writeFileSync(settingsPath, plan.content, "utf8");
  console.log("Wrote settings.txt at", settingsPath);
  return true;
}

function ensureProjectEngineFiles(projectPath) {
  const engineDir = path.join(projectPath, "engine");
  fs.mkdirSync(engineDir, { recursive: true });

  const gameplayPath = path.join(engineDir, "gameplay.txt");
  const gameplayBefore = fs.existsSync(gameplayPath) ? fs.readFileSync(gameplayPath, "utf8") : "";
  const gameplayAfter = flareLaunch.upsertKey(gameplayBefore, "enable_playgame", "1", { appendIfEmpty: true });
  if (gameplayAfter !== gameplayBefore) {
    fs.writeFileSync(gameplayPath, gameplayAfter, "utf8");
  }

  const miscPath = path.join(engineDir, "misc.txt");
  const miscBefore = fs.existsSync(miscPath) ? fs.readFileSync(miscPath, "utf8") : "";
  const suggested = flareLaunch.readKey(miscBefore, "save_prefix") || flareLaunch.slugSavePrefix(path.basename(projectPath));
  const ensured = flareLaunch.ensureSavePrefix(miscBefore, suggested);
  if (ensured.content !== miscBefore) {
    fs.writeFileSync(miscPath, ensured.content, "utf8");
  }

  const tilesetConfigPath = path.join(engineDir, "tileset_config.txt");
  if (!fs.existsSync(tilesetConfigPath)) {
    fs.writeFileSync(tilesetConfigPath, flareAdapter.exportTilesetConfig(), "utf8");
  }
  return { savePrefix: ensured.prefix, miscPath };
}

function writeAdapterFile(projectPath, relativePath, content) {
  const dest = path.join(projectPath, relativePath);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content, "utf8");
}

function collectProjectText(projectPath) {
  const files = {};
  const skipNames = new Set(["node_modules", ".git"]);
  const walk = (dir, rel) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skipNames.has(entry.name)) continue;
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (childRel === ".editor/migration-backup" || childRel.startsWith(".editor/migration-backup/")) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs, childRel);
      } else if (/\.(txt|json)$/i.test(entry.name)) {
        files[childRel] = fs.readFileSync(abs, "utf8");
      }
    }
  };
  walk(projectPath, "");
  return files;
}

function migrateProjectIfNeeded(projectPath) {
  const indexPath = path.join(projectPath, "project.json");
  if (fs.existsSync(indexPath)) return { migrated: false };
  const files = collectProjectText(projectPath);
  if (Object.keys(files).length === 0) {
    writeAdapterFile(
      projectPath,
      "project.json",
      `${JSON.stringify(flareAdapter.emptyProject(path.basename(projectPath)), null, 2)}\n`
    );
    return { migrated: false, created: true };
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupRoot = path.join(projectPath, ".editor", "migration-backup", stamp);
  for (const [rel, content] of Object.entries(files)) {
    const dest = path.join(backupRoot, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content, "utf8");
  }
  const result = flareAdapter.migrateFiles(files, path.basename(projectPath));
  if (result.errors && result.errors.length > 0) {
    console.warn("[migrate] kept the backup and did not write canonical files:", result.errors);
    return { migrated: false, errors: result.errors, backup: backupRoot };
  }
  for (const file of result.files) writeAdapterFile(projectPath, file.path, file.content);
  console.log("[migrate] wrote canonical project from", backupRoot);
  return { migrated: true, backup: backupRoot };
}

function rememberCanonicalMap(projectPath, mapName, mapTxt) {
  const imported = flareAdapter.importMapText(mapTxt);
  const id = flareAdapter.slugFileName(mapName);
  imported.id = id;
  const indexPath = path.join(projectPath, "project.json");
  let index = flareAdapter.emptyProject(path.basename(projectPath));
  if (fs.existsSync(indexPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(indexPath, "utf8"));
      index = { ...index, ...parsed, meta: { ...index.meta, ...(parsed.meta || {}) } };
    } catch (err) {
      console.warn("Ignoring unreadable project.json:", err);
    }
  }
  const maps = new Set(Array.isArray(index.maps) ? index.maps.map(String) : []);
  maps.add(id);
  index.schemaVersion = flareAdapter.SCHEMA_VERSION;
  index.maps = Array.from(maps);
  writeAdapterFile(projectPath, "project.json", `${JSON.stringify(index, null, 2)}\n`);
  writeAdapterFile(projectPath, `content/maps/${id}.json`, `${JSON.stringify(imported, null, 2)}\n`);
  const sessionPath = path.join(projectPath, ".editor", "session.json");
  if (!fs.existsSync(sessionPath)) {
    writeAdapterFile(projectPath, ".editor/session.json", `${JSON.stringify(flareAdapter.editorSession(), null, 2)}\n`);
  }
}

function playSessionPath(projectPath) {
  return path.join(projectPath, PLAY_SESSION_DIR, PLAY_SESSION_FILE);
}

function restoreSpawnBackup(projectPath) {
  try {
    const spawnPath = path.join(projectPath, "maps", "spawn.txt");
    const backupPath = path.join(projectPath, "maps", "spawn.txt.bak");
    if (!fs.existsSync(backupPath)) return false;
    fs.copyFileSync(backupPath, spawnPath);
    fs.unlinkSync(backupPath);
    console.log("[FlareEngine] Restored original spawn.txt");
    return true;
  } catch (err) {
    console.error("[FlareEngine] restore-spawn-backup error:", err);
    return false;
  }
}

function cleanupPlaySession(projectPath) {
  if (!projectPath) return false;
  const sessionFile = playSessionPath(projectPath);
  let session = null;
  if (fs.existsSync(sessionFile)) {
    try {
      session = JSON.parse(fs.readFileSync(sessionFile, "utf8"));
    } catch (err) {
      console.warn("[FlareEngine] Ignoring unreadable play session:", err);
    }
  }

  if (session && typeof session.previousMisc === "string") {
    const miscPath = path.join(projectPath, "engine", "misc.txt");
    try {
      fs.mkdirSync(path.dirname(miscPath), { recursive: true });
      fs.writeFileSync(miscPath, session.previousMisc, "utf8");
    } catch (err) {
      console.error("[FlareEngine] Failed to restore engine/misc.txt:", err);
    }
  }

  if (session && session.testSaveDir) {
    try {
      const savesRoot = path.join(currentPathUser(), "saves");
      const relative = path.relative(path.resolve(savesRoot), path.resolve(session.testSaveDir));
      const safe = relative && !relative.startsWith("..") && !path.isAbsolute(relative);
      if (safe) {
        fs.rmSync(session.testSaveDir, { recursive: true, force: true });
        console.log("[FlareEngine] Removed test save", session.testSaveDir);
      } else {
        console.warn("[FlareEngine] Refusing to delete test save outside path_user/saves:", session.testSaveDir);
      }
    } catch (err) {
      console.error("[FlareEngine] Failed to delete test save:", err);
    }
  }

  if (fs.existsSync(sessionFile)) {
    try {
      fs.unlinkSync(sessionFile);
    } catch {
      /* ignore */
    }
  }
  restoreSpawnBackup(projectPath);
  return Boolean(session);
}

const getPlatformIcon = () => {
  // PNG works for taskbar/window icon on both Windows and Linux
  return path.join(__dirname, "..", "public", "flare-studio-ico.png");
};

let mainWindow;

function createWindow() {
  const { screen } = require("electron");
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1400, screenW),
    height: Math.min(900, screenH),
    minWidth: Math.min(1200, screenW),
    minHeight: Math.min(800, screenH),
    frame: false,
    titleBarStyle: "hidden",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: getPlatformIcon(),
    title: "Isometric Tile Map Editor",
  });

  // Load the app
  if (isDev) {
    // Vite dev server runs on 5173
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // The title-bar close button asks the renderer before the window goes away.
  mainWindow.on("close", (event) => {
    if (allowQuit) return;
    event.preventDefault();
    if (closePromptOpen) return;
    closePromptOpen = true;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("before-close");
    }
  });

  // Create application menu
  createMenu();
}

ipcMainLocal.on("window-minimize", () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMainLocal.on("window-maximize", () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMainLocal.on("window-close", () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

// Handle file system operations
// Session file for storing tabs and editor state per project
const SESSION_FILENAME = ".flare-session.json";

// Read session data from project folder
ipcMainLocal.handle("read-session", async (event, projectPath) => {
  try {
    if (!projectPath) return null;
    const sessionFile = path.join(projectPath, SESSION_FILENAME);
    if (!fs.existsSync(sessionFile)) return null;
    const content = fs.readFileSync(sessionFile, "utf8");
    return JSON.parse(content);
  } catch (e) {
    console.error("read-session failed:", e);
    return null;
  }
});

// Write session data to project folder
ipcMainLocal.handle(
  "write-session",
  async (event, projectPath, sessionData) => {
    try {
      if (!projectPath || !sessionData) return false;
      const sessionFile = path.join(projectPath, SESSION_FILENAME);
      fs.writeFileSync(
        sessionFile,
        JSON.stringify(sessionData, null, 2),
        "utf8"
      );
      return true;
    } catch (e) {
      console.error("write-session failed:", e);
      return false;
    }
  }
);

// Crash backup file management (project scoped)
const CRASH_BACKUP_DIRNAME = "backup";
const CRASH_BACKUP_FILENAME = "crash-backup.json";

ipcMainLocal.handle("save-crash-backup", async (_event, projectPath, backupData) => {
  try {
    if (!projectPath || !backupData) return false;

    const backupDir = path.join(projectPath, CRASH_BACKUP_DIRNAME);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupFile = path.join(backupDir, CRASH_BACKUP_FILENAME);
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), "utf8");
    return true;
  } catch (error) {
    console.error("save-crash-backup failed:", error);
    return false;
  }
});

ipcMainLocal.handle("read-crash-backup", async (_event, projectPath) => {
  try {
    if (!projectPath) return null;

    const backupFile = path.join(projectPath, CRASH_BACKUP_DIRNAME, CRASH_BACKUP_FILENAME);
    if (!fs.existsSync(backupFile)) return null;

    const content = fs.readFileSync(backupFile, "utf8");
    return JSON.parse(content);
  } catch (error) {
    console.error("read-crash-backup failed:", error);
    return null;
  }
});

ipcMainLocal.handle("clear-crash-backup", async (_event, projectPath) => {
  try {
    if (!projectPath) return false;

    const backupFile = path.join(projectPath, CRASH_BACKUP_DIRNAME, CRASH_BACKUP_FILENAME);
    if (fs.existsSync(backupFile)) {
      fs.unlinkSync(backupFile);
    }

    return true;
  } catch (error) {
    console.error("clear-crash-backup failed:", error);
    return false;
  }
});

// Enemy preset management
ipcMainLocal.handle("list-enemies", async (event, projectPath) => {
  try {
    if (!projectPath) return [];
    const enemiesDir = path.join(projectPath, "enemies");
    if (!fs.existsSync(enemiesDir)) return [];

    const files = fs.readdirSync(enemiesDir);
    return files
      .filter((f) => f.toLowerCase().endsWith(".txt"))
      .map((f) => `enemies/${f}`);
  } catch (e) {
    console.error("list-enemies failed:", e);
    return [];
  }
});

ipcMainLocal.handle(
  "save-enemy-preset",
  async (event, projectPath, filename, content) => {
    try {
      if (!projectPath || !filename || !content) return false;

      // Ensure enemies folder exists
      const enemiesDir = path.join(projectPath, "enemies");
      if (!fs.existsSync(enemiesDir)) {
        fs.mkdirSync(enemiesDir, { recursive: true });
      }

      const base = path.basename(String(filename)).replace(/\.txt$/i, "");
      const safeName = `${flareAdapter.slugFileName(base)}.txt`;
      const normalized = flareAdapter.normalizeEnemyText(content);

      const filePath = path.join(enemiesDir, safeName);
      fs.writeFileSync(filePath, normalized.text, "utf8");
      console.log("Enemy preset saved:", filePath);
      return true;
    } catch (e) {
      console.error("save-enemy-preset failed:", e);
      return false;
    }
  }
);

// NPC file management
ipcMainLocal.handle(
  "write-npc-file",
  async (event, projectPath, filename, content) => {
    try {
      if (!projectPath || !filename || !content) return false;

      // Ensure npcs folder exists
      const npcsFolder = path.join(projectPath, "npcs");
      if (!fs.existsSync(npcsFolder)) {
        fs.mkdirSync(npcsFolder, { recursive: true });
      }

      const npcBase = path.basename(String(filename)).replace(/\.txt$/i, "");
      const npcFilename = `${flareAdapter.slugFileName(npcBase)}.txt`;
      const npcFilePath = path.join(npcsFolder, npcFilename);

      // Write the file
      fs.writeFileSync(npcFilePath, content, "utf8");
      console.log("NPC file saved:", npcFilePath);
      return true;
    } catch (e) {
      console.error("write-npc-file failed:", e);
      return false;
    }
  }
);

// List map files in project
// Looks for:
// 1. .json map files in project root (editor format) - validated to have map structure
// 2. .txt map files in maps/ folder (Flare export format)
ipcMainLocal.handle("list-maps", async (event, projectPath) => {
  try {
    rememberProjectRoot(projectPath);
    if (!projectPath) return [];

    const maps = [];
    const projectFolderName = path.basename(projectPath).toLowerCase();

    // Check for .json map files in project root (exclude session file)
    const rootFiles = fs.readdirSync(projectPath);
    for (const f of rootFiles) {
      const lower = f.toLowerCase();
      if (lower.endsWith(".json") && lower !== ".flare-session.json" && lower !== "project.json") {
        // Read the file to check if it's a valid map (has layers array with content)
        try {
          const filePath = path.join(projectPath, f);
          const content = JSON.parse(fs.readFileSync(filePath, "utf8"));
          const baseName = f.replace(/\.json$/i, "");

          // A valid map MUST have a layers array with at least one layer
          const hasLayers =
            Array.isArray(content.layers) && content.layers.length > 0;

          // Skip files that match the project folder name and don't have layers
          // This is the old project config file format
          const isOldProjectConfig =
            baseName.toLowerCase() === projectFolderName && !hasLayers;

          // Skip phantom "Untitled_Map.json" files that were created by a stale-state
          // bug during project creation. Such files have the default name 'Untitled Map'
          // and contain only empty (all-zero) tile data — no real content painted by the user.
          // If any layer has at least one non-zero tile the file is kept (user may have used it).
          const isPhantomUntitledMap = (() => {
            if (content.name !== 'Untitled Map') return false;
            if (!Array.isArray(content.layers) || content.layers.length === 0) return true;
            const hasAnyPaintedTile = content.layers.some(
              (layer) => Array.isArray(layer.data) && layer.data.some((v) => v !== 0)
            );
            return !hasAnyPaintedTile;
          })();

          if (hasLayers && !isOldProjectConfig && !isPhantomUntitledMap) {
            maps.push(f);
            console.log(
              "Found valid map file:",
              f,
              "name:",
              content.name,
              "layers:",
              content.layers?.length || 0
            );
          } else {
            if (isPhantomUntitledMap) {
              console.log(
                "Skipping phantom Untitled_Map.json (empty default map from old bug):", f
              );
            } else {
              console.log(
                "Skipping non-map JSON file:",
                f,
                "(isOldProjectConfig:",
                isOldProjectConfig,
                "hasLayers:",
                hasLayers,
                ")"
              );
            }
          }
        } catch (e) {
          console.warn("Could not read/parse JSON file:", f, e.message);
        }
      }
    }

    // Also check maps/ folder for .txt exports (these are Flare format)
    const mapsDir = path.join(projectPath, "maps");
    if (fs.existsSync(mapsDir)) {
      const mapsDirFiles = fs.readdirSync(mapsDir);
      for (const f of mapsDirFiles) {
        const lower = f.toLowerCase();
        // Only include .txt files that are actual maps, exclude spawn.txt
        if (lower.endsWith(".txt") && lower !== "spawn.txt") {
          // Check if we already have the .json version
          const baseName = f.replace(/\.txt$/i, "");
          const hasJsonVersion = maps.some(
            (m) =>
              m.replace(/\.json$/i, "").toLowerCase() === baseName.toLowerCase()
          );
          if (!hasJsonVersion) {
            maps.push(f);
          }
        }
      }
    }

    console.log("list-maps final result:", maps);
    return maps;
  } catch (e) {
    console.error("list-maps failed:", e);
    return [];
  }
});

// Read a map file from project/maps
ipcMainLocal.handle("read-map-file", async (event, projectPath, filename) => {
  try {
    if (!projectPath || !filename) return null;
    const mapsDir = path.join(projectPath, "maps");
    const full = path.join(mapsDir, filename);
    if (!fs.existsSync(full)) return null;
    const content = fs.readFileSync(full, "utf8");
    return content;
  } catch (e) {
    console.error("read-map-file failed:", e);
    return null;
  }
});

ipcMainLocal.handle(
  "resolve-path-relative",
  async (_event, fromPath, toPath) => {
    try {
      if (!fromPath || !toPath) return toPath;
      if (!path.isAbsolute(toPath)) {
        return toPath.replace(/\\/g, "/");
      }
      const fromExists = fs.existsSync(fromPath);
      const baseDir =
        fromExists && fs.statSync(fromPath).isDirectory()
          ? fromPath
          : path.dirname(fromPath);
      const relative = path.relative(baseDir, toPath);
      return relative ? relative.replace(/\\/g, "/") : toPath;
    } catch (error) {
      console.error("resolve-path-relative failed:", error);
      return toPath;
    }
  }
);

ipcMainLocal.handle(
  "update-spawn-file",
  async (_event, projectPath, content) => {
    try {
      if (!projectPath) return false;
      const mapsDir = path.join(projectPath, "maps");
      if (!fs.existsSync(mapsDir)) {
        fs.mkdirSync(mapsDir, { recursive: true });
      }
      const spawnPath = path.join(mapsDir, "spawn.txt");
      const data = typeof content === "string" ? content : "";
      fs.writeFileSync(spawnPath, data, "utf8");
      return true;
    } catch (error) {
      console.error("update-spawn-file failed:", error);
      return false;
    }
  }
);

ipcMainLocal.handle("read-spawn-file", async (_event, projectPath) => {
  try {
    rememberProjectRoot(projectPath);
    if (!projectPath) return null;
    const spawnPath = path.join(projectPath, "maps", "spawn.txt");
    if (!fs.existsSync(spawnPath)) return null;
    return fs.readFileSync(spawnPath, "utf8");
  } catch (error) {
    console.error("read-spawn-file failed:", error);
    return null;
  }
});

ipcMainLocal.handle("select-directory", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    rememberProjectRoot(result.filePaths[0]);
    return result.filePaths[0];
  }
  return null;
});

ipcMainLocal.handle("select-tileset-file", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [
      { name: "Tileset Images", extensions: ["png"] },
      { name: "All Files", extensions: ["*"] },
    ],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }

  return null;
});

ipcMainLocal.handle("create-map-project", async (event, config) => {
  try {
    const projectPath = path.join(config.location, config.name);
    rememberProjectRoot(config.location);
    rememberProjectRoot(projectPath);

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
      version: "1.0",
    };

    // Save map configuration
    const mapConfigPath = path.join(projectPath, `${config.name}.json`);
    fs.writeFileSync(mapConfigPath, JSON.stringify(mapData, null, 2));
    writeAdapterFile(
      projectPath,
      "project.json",
      `${JSON.stringify(flareAdapter.emptyProject(config.name), null, 2)}\n`
    );

    // Create images/tilesets folder structure
    const imagesPath = path.join(projectPath, "images");
    const tilesetsPath = path.join(imagesPath, "tilesets");
    if (!fs.existsSync(imagesPath)) {
      fs.mkdirSync(imagesPath, { recursive: true });
    }
    if (!fs.existsSync(tilesetsPath)) {
      fs.mkdirSync(tilesetsPath, { recursive: true });
    }

    // Create maps folder
    const mapsPath = path.join(projectPath, "maps");
    if (!fs.existsSync(mapsPath)) {
      fs.mkdirSync(mapsPath);
    }

    // settings.txt is the mod manifest. Write it from the project name, and
    // do not replace a file the user already edited.
    try {
      writeProjectSettings(projectPath, config.name);
      ensureProjectEngineFiles(projectPath);
    } catch (settingsErr) {
      console.warn(
        "Failed to write default settings.txt during project creation:",
        settingsErr
      );
    }

    // Do not create spawn.txt yet. It will be generated when a starting map is selected.

    return true;
  } catch (error) {
    console.error("Error creating map project:", error);
    return false;
  }
});

ipcMainLocal.handle("open-map-project", async (event, projectPath, mapName) => {
  try {
    rememberProjectRoot(projectPath);
    console.log("=== ELECTRON LOAD DEBUG ===");
    console.log("Loading project from:", projectPath);
    console.log("Requested map name:", mapName);
    try {
      migrateProjectIfNeeded(projectPath);
    } catch (migrateErr) {
      console.warn("Canonical migration failed:", migrateErr);
    }

    // Look for map configuration file. If a specific mapName is provided
    // ONLY load that specific file - do NOT fall back to a random JSON file.
    const files = fs.readdirSync(projectPath);
    let mapFile = null;
    if (mapName && typeof mapName === "string") {
      // Sanitize the map name the same way save does, so "Untitled Map" → "Untitled_Map.json"
      const sanitizedName = sanitizeMapNameForFilename(mapName);
      const candidate = `${sanitizedName}.json`;
      if (files.includes(candidate)) {
        mapFile = candidate;
      } else {
        // Also try the raw (unsanitized) name for backward compat with files saved by older builds
        const rawCandidate = `${mapName}.json`;
        if (files.includes(rawCandidate)) {
          mapFile = rawCandidate;
        } else {
          console.log("Requested map file not found:", candidate);
          // Return null instead of falling back to wrong file
          return null;
        }
      }
    } else {
      // No specific map requested - find the first valid map file
      mapFile =
        files.find(
          (file) =>
            file.endsWith(".json") &&
            file !== SESSION_FILENAME &&
            file !== "project.json"
        ) || null;
    }

    if (mapFile) {
      const mapConfigPath = path.join(projectPath, mapFile);
      console.log("Loading map file:", mapConfigPath);
      const mapData = JSON.parse(fs.readFileSync(mapConfigPath, "utf8"));
      console.log("Loaded map data:", {
        name: mapData.name,
        tilesetImages: mapData.tilesetImages
          ? Object.keys(mapData.tilesetImages).length
          : 0,
        tilesets: mapData.tilesets ? mapData.tilesets.length : 0,
        layers: mapData.layers ? mapData.layers.length : 0,
      });

      // Ensure tilesetImages are present; if missing, attempt to load from images/tilesets (or legacy paths)
      try {
        const imagesPath = path.join(projectPath, "images");
        const tilesetsPath = path.join(imagesPath, "tilesets");
        const legacyAssetsPath = path.join(projectPath, "assets");
        const searchDirs = [tilesetsPath, legacyAssetsPath, projectPath];
        const ensureTilesetImages = {};
        if (
          mapData.tilesetImages &&
          typeof mapData.tilesetImages === "object"
        ) {
          Object.assign(ensureTilesetImages, mapData.tilesetImages);
        }

        const toDataUrl = (filePath) => {
          const fileBuf = fs.readFileSync(filePath);
          const ext = (path.extname(filePath).slice(1) || "png").toLowerCase();
          const normalizedExt = ext === "jpg" ? "jpeg" : ext;
          return `data:image/${normalizedExt};base64,${fileBuf.toString(
            "base64"
          )}`;
        };

        // Helper: try to load a tileset filename from any search directory
        const tryLoadTilesetFile = (fileName) => {
          if (!fileName || ensureTilesetImages[fileName]) return;
          for (const dir of searchDirs) {
            if (!dir) continue;
            const candidatePath = path.join(dir, fileName);
            if (fs.existsSync(candidatePath)) {
              ensureTilesetImages[fileName] = toDataUrl(candidatePath);
              return;
            }
          }
          console.warn(`Tileset not found: "${fileName}"`);
        };

        // Load tilesets referenced in tilesets[]
        if (Array.isArray(mapData.tilesets)) {
          for (const ts of mapData.tilesets) {
            const fileName = ts?.fileName || ts?.name;
            if (!fileName) continue;
            const hasEmbedded =
              ensureTilesetImages[fileName] &&
              typeof ensureTilesetImages[fileName] === "string";
            if (hasEmbedded) continue;

            for (const dir of searchDirs) {
              if (!dir) continue;
              const candidatePath = path.join(dir, fileName);
              if (fs.existsSync(candidatePath)) {
                ensureTilesetImages[fileName] = toDataUrl(candidatePath);
                const relativeSource =
                  path.relative(projectPath, candidatePath) || candidatePath;
                console.log(
                  `Embedded tileset from ${relativeSource}: ${fileName}`
                );
                break;
              }
            }
          }
        }

        // Also load per-tab tilesets stored in layerTabs (tab-specific tilesets are
        // NOT included in tilesets[] but are saved as separate files with the key
        // format "layerType_tabN_filename.png" in images/tilesets/).
        if (mapData.layerTabs && typeof mapData.layerTabs === "object") {
          for (const [layerType, tabs] of Object.entries(mapData.layerTabs)) {
            if (!Array.isArray(tabs)) continue;
            for (const tab of tabs) {
              const fileName = tab?.tileset?.fileName;
              if (fileName) tryLoadTilesetFile(fileName);
            }
          }
        }

        const haveAnyEmbedded = Object.keys(ensureTilesetImages).length > 0;
        if (
          (!Array.isArray(mapData.tilesets) || mapData.tilesets.length === 0) &&
          !haveAnyEmbedded
        ) {
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
            const relativeSource =
              path.relative(projectPath, first.fullPath) || first.fullPath;
            console.log(
              `Synthesized tileset from discovered image: ${relativeSource}`
            );
          }
        }

        if (Object.keys(ensureTilesetImages).length > 0) {
          mapData.tilesetImages = ensureTilesetImages;
        }
      } catch (embErr) {
        console.warn(
          "Warning while embedding tilesets from project files:",
          embErr
        );
      }

      if (mapData.tilesetImages) {
        console.log(
          "Tileset image files found:",
          Object.keys(mapData.tilesetImages)
        );
        // Show first few characters of each image data
        for (const [filename, imageData] of Object.entries(
          mapData.tilesetImages
        )) {
          if (typeof imageData === "string") {
            console.log(
              `${filename}: ${
                imageData.length
              } chars, starts with: ${imageData.substring(0, 50)}...`
            );
          }
        }
      }

      return mapData;
    }

    console.log("No map file found in project");
    return null;
  } catch (error) {
    console.error("Error opening map project:", error);
    return null;
  }
});

// ============================================================================
// Phase 2: Tileset Profile Persistence
// ============================================================================

/**
 * Save tileset profiles to {projectPath}/.tileset-profiles.json
 * Profiles store persistent asset record definitions to avoid re-detection on reload
 */
ipcMainLocal.handle("save-tileset-profiles", async (event, projectPath, profiles) => {
  try {
    if (!projectPath) {
      console.error("Project path required for saving tileset profiles");
      return { success: false, error: "Project path is required" };
    }

    const profilePath = path.join(projectPath, ".tileset-profiles.json");
    const profileData = {
      version: "1.1", // profiles introduced in schema v1.1
      profiles: profiles || {},
      lastModified: new Date().toISOString()
    };

    fs.writeFileSync(profilePath, JSON.stringify(profileData, null, 2));
    console.log(`[PROFILE SAVE] Saved tileset profiles to: ${profilePath}`);
    return { success: true, path: profilePath };
  } catch (error) {
    console.error("[PROFILE SAVE] Error saving tileset profiles:", error);
    return { success: false, error: error?.message || "Unknown error" };
  }
});

/**
 * Load tileset profiles from {projectPath}/.tileset-profiles.json
 * Returns profile registry if available, null if file doesn't exist or error occurs
 */
ipcMainLocal.handle("load-tileset-profiles", async (event, projectPath) => {
  try {
    if (!projectPath) {
      console.warn("Project path required for loading tileset profiles");
      return null;
    }

    const profilePath = path.join(projectPath, ".tileset-profiles.json");
    
    // If profile file doesn't exist, return null (will fall back to legacy tileset/detectedTiles)
    if (!fs.existsSync(profilePath)) {
      console.log(`[PROFILE LOAD] Profile file not found: ${profilePath}`);
      return null;
    }

    const profileData = JSON.parse(fs.readFileSync(profilePath, "utf8"));
    console.log(`[PROFILE LOAD] Loaded tileset profiles from: ${profilePath}`);
    console.log(`[PROFILE LOAD] Profile version: ${profileData.version}, count: ${Object.keys(profileData.profiles || {}).length}`);
    
    return profileData.profiles || {};
  } catch (error) {
    console.warn("[PROFILE LOAD] Error loading tileset profiles:", error);
    // Return null on error so caller can fall back to legacy detection
    return null;
  }
});

// Save map project data
ipcMainLocal.handle("save-map-project", async (event, projectPath, mapData) => {
  try {
    rememberProjectRoot(projectPath);
    console.log("=== ELECTRON SAVE DEBUG ===");
    console.log("Project path:", projectPath);
    console.log("Map data received:", !!mapData);
    console.log("Map name:", mapData?.name);

    if (!projectPath || !mapData) {
      console.error("Invalid save parameters:", {
        projectPath,
        hasMapData: !!mapData,
      });
      return false;
    }

    // Use the map name to create the file (each map gets its own .json file)
    const mapName = mapData.name || "Untitled Map";
    const sanitizedName = sanitizeMapNameForFilename(mapName);
    const mapFile = `${sanitizedName}.json`;

    const mapConfigPath = path.join(projectPath, mapFile);
    console.log("Saving to:", mapConfigPath);

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
      ...mapData,
    };

    console.log("Complete map data structure:", {
      name: completeMapData.name,
      tilesetImages: Object.keys(completeMapData.tilesetImages || {}).length,
      layers: completeMapData.layers.length,
    });

    // Save tileset images as separate files BEFORE writing JSON.
    // Each tileset image is stored in images/tilesets/ so the per-map JSON
    // does not need to carry the large base64 blobs.
    const imagesPath = path.join(projectPath, "images");
    const tilesetsPath = path.join(imagesPath, "tilesets");
    if (mapData.tilesetImages && Object.keys(mapData.tilesetImages).length > 0) {
      console.log(
        "Processing tileset images:",
        Object.keys(mapData.tilesetImages)
      );
      if (!fs.existsSync(imagesPath)) {
        fs.mkdirSync(imagesPath, { recursive: true });
        console.log("Created images directory");
      }
      if (!fs.existsSync(tilesetsPath)) {
        fs.mkdirSync(tilesetsPath, { recursive: true });
        console.log("Created tilesets directory");
      }

      for (const [filename, imageData] of Object.entries(
        mapData.tilesetImages
      )) {
        if (imageData && typeof imageData === "string") {
          const base64Data = imageData.replace(
            /^data:image\/[a-z]+;base64,/,
            ""
          );
          const imagePath = path.join(tilesetsPath, filename);
          // Only write if file doesn't exist or content has changed (avoid unnecessary writes)
          let needsWrite = true;
          try {
            if (fs.existsSync(imagePath)) {
              const existingSize = fs.statSync(imagePath).size;
              const newSize = Buffer.byteLength(base64Data, "base64");
              needsWrite = existingSize !== newSize;
            }
          } catch (_e) { /* always write on error */ }
          if (needsWrite) {
            fs.writeFileSync(imagePath, base64Data, "base64");
            console.log("Saved tileset image:", path.relative(projectPath, imagePath));
          } else {
            console.log("Tileset image unchanged, skipping write:", filename);
          }
        }
      }
    } else {
      console.log("No tileset images to save");
    }

    // Strip base64 image data from the JSON — images are stored as separate
    // files in images/tilesets/ so embedding them in the map JSON is redundant
    // and makes the .json file extremely large.
    const jsonData = { ...completeMapData };
    jsonData.tilesetImages = {};

    // Write the map data (lean JSON, no embedded base64 images)
    fs.writeFileSync(mapConfigPath, JSON.stringify(jsonData, null, 2));
    console.log("Map configuration saved successfully (tileset images stored separately)");

    // Save minimap image if provided in mapData.minimap
    try {
      if (
        mapData.minimap &&
        typeof mapData.minimap === "string" &&
        mapData.minimap.startsWith("data:image")
      ) {
        const minimapBase64 = mapData.minimap.replace(
          /^data:image\/[a-z]+;base64,/,
          ""
        );
        const imagesPath = path.join(projectPath, "images");
        if (!fs.existsSync(imagesPath)) {
          fs.mkdirSync(imagesPath, { recursive: true });
        }
        const minimapPath = path.join(imagesPath, "minimap.png");
        fs.writeFileSync(minimapPath, minimapBase64, "base64");
        console.log("Saved minimap to:", minimapPath);
      }
    } catch (mmErr) {
      console.warn("Failed to save minimap:", mmErr);
    }

    console.log("Map project saved successfully:", mapConfigPath);
    return true;
  } catch (error) {
    console.error("Error saving map project:", error);
    return false;
  }
});

ipcMainLocal.handle("delete-map", async (_event, projectPath, mapName) => {
  try {
    if (!projectPath || !mapName) {
      return { success: false, message: "Project path and map name are required" };
    }
    const sanitizedName = sanitizeMapNameForFilename(mapName);
    deleteMatchingFile(projectPath, `${sanitizedName}.json`);
    const mapsDir = path.join(projectPath, "maps");
    deleteMatchingFile(mapsDir, `${sanitizedName}.txt`);
    return { success: true };
  } catch (error) {
    console.error("delete-map failed:", error);
    return {
      success: false,
      message: error?.message ?? "Failed to delete map file",
    };
  }
});

// Save export files (map.txt and tileset.txt) to project folder
ipcMainLocal.handle(
  "save-export-files",
  async (event, projectPath, mapName, mapTxt, tilesetDef, options = {}) => {
    try {
      if (!projectPath) {
        throw new Error("Project path is required");
      }
      if (!fs.existsSync(projectPath)) {
        throw new Error("Project path does not exist");
      }

      const mapsDir = path.join(projectPath, "maps");
      if (!fs.existsSync(mapsDir)) {
        fs.mkdirSync(mapsDir, { recursive: true });
      }

      // Create tilesetdefs directory
      const tilesetDefsDir = path.join(projectPath, "tilesetdefs");
      if (!fs.existsSync(tilesetDefsDir)) {
        fs.mkdirSync(tilesetDefsDir, { recursive: true });
      }

      const sanitizedMapName = flareLaunch.sanitizeMapFileName(mapName);
      const mapFilePath = path.join(mapsDir, `${sanitizedMapName}.txt`);
      const tilesetFilePath = path.join(
        tilesetDefsDir,
        `tileset_${sanitizedMapName}.txt`
      );

      const validationSchema = loadFlareDataSchema(validationRoot);
      const validationResults = [];
      const mapTargetPath = path.join("maps", `${sanitizedMapName}.txt`).split(path.sep).join("/");
      const adapterMapErrors = flareAdapter
        .validateText("maps", mapTxt, mapTargetPath)
        .filter((issue) => issue.level === "error")
        .map((issue) => issue.message);
      if (adapterMapErrors.length > 0) {
        return {
          success: false,
          message: `Export refused: ${adapterMapErrors.join(" | ")}`,
          validation: {
            success: false,
            fileResults: [{ filePath: mapTargetPath, category: "maps", errors: adapterMapErrors, warnings: [] }],
          },
        };
      }
      validationResults.push(
        validateSerializedFlareData(projectPath, mapTargetPath, mapTxt, validationSchema)
      );

      if (options.spawn && options.spawn.enabled && typeof options.spawn.content === 'string') {
        const spawnFile = path.join("maps", options.spawn.filename || "spawn.txt").split(path.sep).join("/");
        validationResults.push(
          validateSerializedFlareData(projectPath, spawnFile, options.spawn.content, validationSchema)
        );
      }

      if (Array.isArray(options.npcFiles)) {
        for (const npcFile of options.npcFiles) {
          if (npcFile && npcFile.filename && typeof npcFile.content === 'string') {
            const npcTarget = path.join("npcs", npcFile.filename).split(path.sep).join("/");
            validationResults.push(
              validateSerializedFlareData(projectPath, npcTarget, npcFile.content, validationSchema)
            );
          }
        }
      }

      const validationIssues = validationResults.flatMap((result) => {
        const filePrefix = result.filePath ? `${result.filePath}: ` : '';
        return [...result.errors.map((error) => `${filePrefix}${error}`), ...result.warnings.map((warning) => `${filePrefix}${warning}`)];
      });

      if (validationIssues.length > 0) {
        return {
          success: false,
          message: `Flare Shield validation failed: ${validationIssues.join(' | ')}`,
          validation: {
            success: false,
            fileResults: validationResults.map((result) => ({
              filePath: result.filePath,
              category: result.category,
              errors: result.errors,
              warnings: result.warnings,
            })),
          },
        };
      }

      fs.writeFileSync(mapFilePath, mapTxt, "utf8");
      fs.writeFileSync(tilesetFilePath, tilesetDef, "utf8");
      try {
        rememberCanonicalMap(projectPath, mapName, mapTxt);
      } catch (canonicalErr) {
        console.warn("Failed to refresh canonical project.json:", canonicalErr);
      }

      // Keep the mod manifest stable across exports. The map name is not the
      // mod description; an existing settings.txt is only filled in, not replaced.
      try {
        writeProjectSettings(projectPath, path.basename(projectPath));
        ensureProjectEngineFiles(projectPath);
      } catch (settingsErr) {
        console.warn("Failed to write settings.txt:", settingsErr);
      }

      if (options.spawn && options.spawn.enabled && options.spawn.content) {
        const spawnFilename = options.spawn.filename || "spawn.txt";
        const spawnPath = path.join(mapsDir, spawnFilename);
        fs.writeFileSync(spawnPath, options.spawn.content, "utf8");
        console.log("Spawn file saved:", spawnPath);
      }

      // If exporter provided tileset images (base64 data URLs), save them to images/tilesets
      try {
        if (
          options.tilesetImages &&
          typeof options.tilesetImages === "object"
        ) {
          const imagesPath = path.join(projectPath, "images");
          const tilesetsPath = path.join(imagesPath, "tilesets");
          if (!fs.existsSync(imagesPath))
            fs.mkdirSync(imagesPath, { recursive: true });
          if (!fs.existsSync(tilesetsPath))
            fs.mkdirSync(tilesetsPath, { recursive: true });

          for (const [filename, imageData] of Object.entries(
            options.tilesetImages
          )) {
            if (imageData && typeof imageData === "string") {
              console.log(
                "Export: saving tileset image",
                filename,
                "length",
                imageData.length
              );
              const base64Data = imageData.replace(
                /^data:image\/[a-z]+;base64,/,
                ""
              );
              const imagePath = path.join(tilesetsPath, filename);
              fs.writeFileSync(imagePath, base64Data, "base64");
              console.log("Export: saved tileset image to", imagePath);
            }
          }
        }
      } catch (imgErr) {
        console.warn("Failed to save exported tileset images:", imgErr);
      }

      // If exporter provided NPC files, save them to npcs/ folder
      try {
        if (
          options.npcFiles &&
          Array.isArray(options.npcFiles) &&
          options.npcFiles.length > 0
        ) {
          const npcsDir = path.join(projectPath, "npcs");
          if (!fs.existsSync(npcsDir)) {
            fs.mkdirSync(npcsDir, { recursive: true });
            console.log("Created npcs directory:", npcsDir);
          }

          for (const npcFile of options.npcFiles) {
            if (npcFile && npcFile.filename && npcFile.content) {
              const npcFilePath = path.join(npcsDir, npcFile.filename);
              fs.writeFileSync(npcFilePath, npcFile.content, "utf8");
              console.log("Export: saved NPC file to", npcFilePath);
            }
          }
        }
      } catch (npcErr) {
        console.warn("Failed to save NPC files:", npcErr);
      }

      // If exporter provided portrait files, copy them to images/portraits/
      try {
        if (
          options.portraitFiles &&
          Array.isArray(options.portraitFiles) &&
          options.portraitFiles.length > 0
        ) {
          const imagesDir = path.join(projectPath, "images");
          const portraitsDir = path.join(imagesDir, "portraits");
          if (!fs.existsSync(imagesDir)) {
            fs.mkdirSync(imagesDir, { recursive: true });
            console.log("Created images directory:", imagesDir);
          }
          if (!fs.existsSync(portraitsDir)) {
            fs.mkdirSync(portraitsDir, { recursive: true });
            console.log("Created portraits directory:", portraitsDir);
          }

          for (const portrait of options.portraitFiles) {
            if (portrait && portrait.sourcePath && portrait.destFilename) {
              const destPath = path.join(portraitsDir, portrait.destFilename);
              if (fs.existsSync(portrait.sourcePath)) {
                fs.copyFileSync(portrait.sourcePath, destPath);
                console.log("Export: copied portrait", portrait.sourcePath, "->", destPath);
              } else {
                console.warn("Export: portrait source not found:", portrait.sourcePath);
              }
            }
          }
        }
      } catch (portraitErr) {
        console.warn("Failed to copy portrait files:", portraitErr);
      }

      // If exporter provided NPC tileset images, copy them to images/npcs/
      try {
        if (
          options.npcTilesetImages &&
          Array.isArray(options.npcTilesetImages) &&
          options.npcTilesetImages.length > 0
        ) {
          const imagesDir = path.join(projectPath, "images");
          const npcsImgDir = path.join(imagesDir, "npcs");
          if (!fs.existsSync(imagesDir)) {
            fs.mkdirSync(imagesDir, { recursive: true });
            console.log("Created images directory:", imagesDir);
          }
          if (!fs.existsSync(npcsImgDir)) {
            fs.mkdirSync(npcsImgDir, { recursive: true });
            console.log("Created images/npcs directory:", npcsImgDir);
          }

          for (const img of options.npcTilesetImages) {
            if (img && img.sourcePath && img.destFilename) {
              const destPath = path.join(npcsImgDir, img.destFilename);
              if (fs.existsSync(img.sourcePath)) {
                fs.copyFileSync(img.sourcePath, destPath);
                console.log("Export: copied NPC tileset image", img.sourcePath, "->", destPath);
              } else {
                console.warn("Export: NPC tileset image source not found:", img.sourcePath);
              }
            }
          }
        }
      } catch (npcImgErr) {
        console.warn("Failed to copy NPC tileset images:", npcImgErr);
      }

      // If exporter provided NPC animation definition files, save them to animations/npcs/
      try {
        if (
          options.npcAnimationFiles &&
          Array.isArray(options.npcAnimationFiles) &&
          options.npcAnimationFiles.length > 0
        ) {
          const animationsDir = path.join(projectPath, "animations");
          const npcsAnimDir = path.join(animationsDir, "npcs");
          if (!fs.existsSync(animationsDir)) {
            fs.mkdirSync(animationsDir, { recursive: true });
            console.log("Created animations directory:", animationsDir);
          }
          if (!fs.existsSync(npcsAnimDir)) {
            fs.mkdirSync(npcsAnimDir, { recursive: true });
            console.log("Created animations/npcs directory:", npcsAnimDir);
          }

          for (const animFile of options.npcAnimationFiles) {
            if (animFile && animFile.filename && animFile.content) {
              const animFilePath = path.join(npcsAnimDir, animFile.filename);
              fs.writeFileSync(animFilePath, animFile.content, "utf8");
              console.log("Export: saved NPC animation file to", animFilePath);
            }
          }
        }
      } catch (animErr) {
        console.warn("Failed to save NPC animation files:", animErr);
      }

      console.log("Export files saved successfully:");
      console.log("- Map:", mapFilePath);
      console.log("- Tileset:", tilesetFilePath);
      return { success: true };
    } catch (error) {
      console.error("Error saving export files:", error);
      return {
        success: false,
        message: error?.message || "Error saving export files"
      };
    }
  }
);

// Discover tileset images in a project folder and return as data URLs
ipcMainLocal.handle("discover-tileset-images", async (event, projectPath) => {
  try {
    if (!projectPath) return { tilesetImages: {}, tilesets: [] };
    const tilesetImages = {};
    const tilesets = [];
    const imagesPath = path.join(projectPath, "images");
    const tilesetsPath = path.join(imagesPath, "tilesets");
    const legacyAssetsPath = path.join(projectPath, "assets");
    const searchDirs = [tilesetsPath, legacyAssetsPath, projectPath];

    const addIfImage = (fullPath, name) => {
      try {
        if (/\.(png|jpg|jpeg)$/i.test(name) && fs.existsSync(fullPath)) {
          const buf = fs.readFileSync(fullPath);
          const b64 = buf.toString("base64");
          const ext = (name.split(".").pop() || "png").toLowerCase();
          const normalizedExt = ext === "jpg" ? "jpeg" : ext;
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
    console.warn("discover-tileset-images failed:", e);
    return { tilesetImages: {}, tilesets: [] };
  }
});

// Read an arbitrary image file and return as data URL (for renderer use)
ipcMainLocal.handle("read-file-dataurl", async (_event, filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const ext = (filePath.split(".").pop() || "png").toLowerCase();
    const normalizedExt = ext === "jpg" ? "jpeg" : ext;
    const buf = fs.readFileSync(filePath);
    const b64 = buf.toString("base64");
    return `data:image/${normalizedExt};base64,${b64}`;
  } catch (e) {
    console.warn("read-file-dataurl failed for", filePath, e);
    return null;
  }
});

// Return project minimap thumbnail (data URL) if available
ipcMainLocal.handle("get-project-thumbnail", async (event, projectPath) => {
  try {
    if (!projectPath) return null;
    const imagesMinimapPath = path.join(projectPath, "images", "minimap.png");
    const legacyMinimapPath = path.join(projectPath, "assets", "minimap.png");
    let minimapPath = imagesMinimapPath;
    if (!fs.existsSync(minimapPath) && fs.existsSync(legacyMinimapPath)) {
      minimapPath = legacyMinimapPath;
    }
    if (!fs.existsSync(minimapPath)) return null;
    const buf = fs.readFileSync(minimapPath);
    const b64 = buf.toString("base64");
    return `data:image/png;base64,${b64}`;
  } catch (e) {
    console.warn("get-project-thumbnail failed:", e);
    return null;
  }
});

// Check if a project path still exists on disk
ipcMainLocal.handle("check-project-exists", async (event, projectPath) => {
  try {
    if (!projectPath) return false;
    return fs.existsSync(projectPath) && fs.statSync(projectPath).isDirectory();
  } catch (e) {
    console.warn("check-project-exists failed for", projectPath, e);
    return false;
  }
});

// Show a folder in the system file explorer
ipcMainLocal.handle("show-item-in-folder", async (_event, folderPath) => {
  try {
    if (!folderPath) return false;
    if (!fs.existsSync(folderPath)) return false;
    shell.openPath(folderPath);
    return true;
  } catch (e) {
    console.warn("show-item-in-folder failed:", e);
    return false;
  }
});

// Restart the application
ipcMainLocal.on("restart-app", () => {
  app.relaunch();
  app.exit(0);
});

// Copy entire project folder to a new location
ipcMainLocal.handle("copy-project", async (_event, sourcePath, destPath) => {
  try {
    if (!sourcePath || !destPath) return { success: false, error: "Invalid paths" };
    if (!fs.existsSync(sourcePath)) return { success: false, error: "Source project not found" };

    const copyDirRecursive = (src, dest) => {
      fs.mkdirSync(dest, { recursive: true });
      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destEntryPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
          copyDirRecursive(srcPath, destEntryPath);
        } else {
          fs.copyFileSync(srcPath, destEntryPath);
        }
      }
    };

    copyDirRecursive(sourcePath, destPath);
    return { success: true };
  } catch (e) {
    console.warn("copy-project failed:", e);
    return { success: false, error: String(e.message || e) };
  }
});

// Get file stats for conflict detection (modified time and size)
ipcMainLocal.handle("get-file-stats", async (_event, filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      console.warn("get-file-stats: File not found:", filePath);
      return null;
    }

    const stats = fs.statSync(filePath);
    return {
      modifiedTime: stats.mtimeMs || stats.mtime.getTime(),
      size: stats.size,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile()
    };
  } catch (e) {
    console.warn("get-file-stats failed for", filePath, e);
    return null;
  }
});

function createMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "New Map",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            mainWindow.webContents.send("menu-new-map");
          },
        },
        {
          label: "Open Map",
          accelerator: "CmdOrCtrl+O",
          click: () => {
            mainWindow.webContents.send("menu-open-map");
          },
        },
        {
          label: "Save Map",
          accelerator: "CmdOrCtrl+S",
          click: () => {
            mainWindow.webContents.send("menu-save-map");
          },
        },
        { type: "separator" },
        {
          label: "Export TMX",
          click: () => {
            mainWindow.webContents.send("menu-export-tmx");
          },
        },
        {
          label: "Export Flare TXT",
          click: () => {
            mainWindow.webContents.send("menu-export-flare");
          },
        },
        { type: "separator" },
        {
          label: "Exit",
          accelerator: process.platform === "darwin" ? "Cmd+Q" : "Ctrl+Q",
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        {
          label: "Undo",
          accelerator: "CmdOrCtrl+Z",
          click: () => {
            mainWindow.webContents.send("menu-undo");
          },
        },
        {
          label: "Redo",
          accelerator: "CmdOrCtrl+Y",
          click: () => {
            mainWindow.webContents.send("menu-redo");
          },
        },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forcereload" },
        { role: "toggledevtools" },
        { type: "separator" },
        { role: "resetzoom" },
        { role: "zoomin" },
        { role: "zoomout" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About",
          click: () => {
            mainWindow.webContents.send("menu-about");
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

let allowQuit = false;
let closePromptOpen = false;
let shutdownWait = null;
let shutdownTimer = null;

function requestRendererShutdown() {
  return new Promise((resolve) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      resolve();
      return;
    }
    if (shutdownTimer) clearTimeout(shutdownTimer);
    shutdownTimer = setTimeout(() => {
      console.warn("[Shutdown] Timed out waiting for the renderer; quitting anyway");
      shutdownWait = null;
      shutdownTimer = null;
      resolve();
    }, 35000);
    shutdownWait = () => {
      if (shutdownTimer) clearTimeout(shutdownTimer);
      shutdownTimer = null;
      shutdownWait = null;
      resolve();
    };
    console.log("[Shutdown] Requesting renderer to flush pending saves");
    mainWindow.webContents.send("app-before-quit");
  });
}

async function finishClose() {
  await requestRendererShutdown();
  allowQuit = true;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
  }
  app.quit();
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Quit only after the renderer finishes pending saves.
app.on("before-quit", (event) => {
  if (allowQuit) return;
  event.preventDefault();
  requestRendererShutdown()
    .catch((err) => console.error("[Shutdown] Failed while flushing saves:", err))
    .finally(() => {
      allowQuit = true;
      app.quit();
    });
});

ipcMainLocal.on("app-shutdown-complete", () => {
  console.log("[Shutdown] Renderer finished pending saves");
  if (shutdownWait) shutdownWait();
});

ipcMainLocal.handle("confirm-close", async (_event, hasUnsavedChanges) => {
  closePromptOpen = false;
  if (!hasUnsavedChanges) {
    await finishClose();
    return true;
  }

  const result = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    title: "Unsaved Changes",
    message: "You have unsaved changes.",
    detail: "Save before closing?",
    buttons: ["Save and Close", "Close Without Saving", "Cancel"],
    defaultId: 0,
    cancelId: 2,
  });

  if (result.response === 0) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("save-and-close");
    }
    return false;
  }
  if (result.response === 1) {
    allowQuit = true;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.destroy();
    }
    app.quit();
    return true;
  }
  return false;
});

ipcMainLocal.on("close-after-save", () => {
  finishClose().catch((err) => console.error("[Shutdown] close-after-save failed:", err));
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Create NPC file in project's npcs/ folder
ipcMainLocal.handle("create-npc-file", async (event, projectPath, npcData) => {
  try {
    if (!projectPath) {
      throw new Error("Project path is required");
    }
    if (!fs.existsSync(projectPath)) {
      throw new Error("Project path does not exist");
    }
    if (!npcData || !npcData.name) {
      throw new Error("NPC name is required");
    }

    // Create npcs directory if it doesn't exist
    const npcsDir = path.join(projectPath, "npcs");
    if (!fs.existsSync(npcsDir)) {
      fs.mkdirSync(npcsDir, { recursive: true });
      console.log("Created npcs directory:", npcsDir);
    }

    // Sanitize NPC name for filename
    const sanitizedName = flareAdapter.slugFileName(npcData.name);

    // Only generate the sanitized filename here — the actual NPC .txt content
    // is written by the save-export flow (saveExportFiles) which produces the
    // authoritative file with dialogues, vendor settings, and proper relative
    // paths.  Writing a skeleton here would be immediately overwritten on save,
    // and if save never runs the skeleton could have stale/incorrect data.

    console.log("NPC filename generated:", `${sanitizedName}.txt`);
    return {
      success: true,
      filePath: path.join(npcsDir, `${sanitizedName}.txt`),
      filename: `${sanitizedName}.txt`,
    };
  } catch (error) {
    console.error("Error creating NPC file:", error);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// Item helpers
// ============================================================================

/**
 * Parse a category .txt file into an array of parsed items.
 * Each item object carries all key=value pairs found inside its [item] block
 * plus a special `_role` and `_resourceSubtype` field extracted from comment lines.
 */
function parseItemsInCategoryFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  try {
    const content = fs.readFileSync(filePath, "utf8");
    // Split into blocks: each [item] section
    const blocks = content.split(/\[item\]/i);
    const items = [];
    for (let b = 1; b < blocks.length; b += 1) {
      const block = blocks[b];
      const lines = block.split("\n");
      let item = {};
      for (const line of lines) {
        const trimmed = line.trim();
        // Preserve role/resource info from comment lines that the writer adds above [item]
        const roleMatch = trimmed.match(/^#\s*role=(.+)$/i);
        if (roleMatch) {
          item._role = roleMatch[1].trim().toLowerCase();
          continue;
        }
        const resMatch = trimmed.match(/^#\s*resource_subtype=(.+)$/i);
        if (resMatch) {
          item._resourceSubtype = resMatch[1].trim().toLowerCase();
          continue;
        }
        if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("[")) continue;
        const eqIndex = trimmed.indexOf("=");
        if (eqIndex > 0) {
          const key = trimmed.substring(0, eqIndex).trim();
          const value = trimmed.substring(eqIndex + 1).trim();
          if (key === "id") {
            item.id = parseInt(value, 10) || 0;
            continue;
          }
          if (Object.prototype.hasOwnProperty.call(item, key)) {
            if (Array.isArray(item[key])) {
              item[key].push(value);
            } else {
              item[key] = [item[key], value];
            }
          } else {
            item[key] = value;
          }
        }
      }
      if (item.id !== undefined) {
        items.push(item);
      }
    }
    return items;
  } catch {
    return [];
  }
}

function appendItemProperty(lines, key, value, options = {}) {
  const { shouldWrite = (v) => v !== undefined && v !== null && v !== "", format = (v) => String(v) } = options;
  const writeValue = (v) => {
    if (shouldWrite(v)) {
      lines.push(`${key}=${format(v)}`);
    }
  };

  if (Array.isArray(value)) {
    for (const itemValue of value) {
      writeValue(itemValue);
    }
    return;
  }

  writeValue(value);
}

function appendItemLines(lines, item) {
  if (item._role) lines.push(`# role=${item._role}`);
  if (item._resourceSubtype) lines.push(`# resource_subtype=${item._resourceSubtype}`);
  appendItemProperty(lines, "id", item.id);
  appendItemProperty(lines, "name", item.name);
  appendItemProperty(lines, "flavor", item.flavor);
  appendItemProperty(lines, "level", item.level, { shouldWrite: (v) => parseInt(v, 10) > 1 });
  appendItemProperty(lines, "icon", item.icon);
  appendItemProperty(lines, "quality", item.quality);
  appendItemProperty(lines, "price", item.price);
  appendItemProperty(lines, "price_per_level", item.price_per_level);
  appendItemProperty(lines, "price_sell", item.price_sell);
  appendItemProperty(lines, "type", item.type);
  appendItemProperty(lines, "speed", item.speed);
  appendItemProperty(lines, "radius", item.radius);
  appendItemProperty(lines, "trait_elemental", item.trait_elemental);
  appendItemProperty(lines, "wall_power", item.wall_power);
  if (item.use_hazard) appendItemProperty(lines, "use_hazard", item.use_hazard, { format: () => "true", shouldWrite: (v) => !!v });
  appendItemProperty(lines, "post_power", item.post_power);
  appendItemProperty(lines, "post_effect", item.post_effect);
  appendItemProperty(lines, "requires_hpmp_state", item.requires_hpmp_state);
  appendItemProperty(lines, "requires_item", item.requires_item);
  appendItemProperty(lines, "new_state", item.new_state);
  appendItemProperty(lines, "modifier_damage", item.modifier_damage);
  appendItemProperty(lines, "lifespan", item.lifespan);
  if (item.face) appendItemProperty(lines, "face", item.face, { format: () => "true", shouldWrite: (v) => !!v });
  appendItemProperty(lines, "max_quantity", item.max_quantity, { shouldWrite: (v) => parseInt(v, 10) > 1 });
  if (item.quest_item) appendItemProperty(lines, "quest_item", item.quest_item, { format: () => "true", shouldWrite: (v) => !!v });
  if (item.no_stash) appendItemProperty(lines, "no_stash", item.no_stash, { shouldWrite: (v) => v !== "ignore" });
  appendItemProperty(lines, "item_type", item.item_type);
  appendItemProperty(lines, "equip_flags", item.equip_flags);
  appendItemProperty(lines, "requires_level", item.requires_level, { shouldWrite: (v) => parseInt(v, 10) > 0 });
  appendItemProperty(lines, "requires_stat", item.requires_stat);
  appendItemProperty(lines, "requires_class", item.requires_class);
  appendItemProperty(lines, "disable_slots", item.disable_slots);
  appendItemProperty(lines, "gfx", item.gfx);
  appendItemProperty(lines, "bonus", item.bonus);
  appendItemProperty(lines, "bonus_power_level", item.bonus_power_level);
  appendItemProperty(lines, "dmg", item.dmg);
  appendItemProperty(lines, "abs", item.abs);
  appendItemProperty(lines, "power", item.power);
  appendItemProperty(lines, "power_desc", item.power_desc);
  appendItemProperty(lines, "replace_power", item.replace_power);
  appendItemProperty(lines, "book", item.book);
  if (item.book_is_readable) appendItemProperty(lines, "book_is_readable", item.book_is_readable, { format: () => "true", shouldWrite: (v) => !!v });
  appendItemProperty(lines, "script", item.script);
  appendItemProperty(lines, "soundfx", item.soundfx);
  appendItemProperty(lines, "stepfx", item.stepfx);
  appendItemProperty(lines, "loot_animation", item.loot_animation);
  appendItemProperty(lines, "randomizer_def", item.randomizer_def);
  appendItemProperty(lines, "loot_drops_max", item.loot_drops_max, { shouldWrite: (v) => parseInt(v, 10) > 1 });
  appendItemProperty(lines, "pickup_status", item.pickup_status);
}

/**
 * Rebuild a category .txt file from a full list of items (all belonging to this category).
 * For each item, writes an optional role comment, then the [item] block with all fields.
 */
function projectPathFromItemFile(filePath) {
  const dir = path.dirname(filePath);
  if (path.basename(dir) === "categories") return path.dirname(path.dirname(dir));
  return path.dirname(dir);
}

function mergePowerFile(projectPath, powers) {
  if (!projectPath || !powers || powers.length === 0) return;
  const file = path.join(projectPath, "powers", "powers.txt");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const fresh = powers.filter((power) => {
    const id = power && power.id != null ? String(power.id) : "";
    if (!id) return true;
    return !new RegExp(`^id=${id}$`, "m").test(existing);
  });
  if (fresh.length === 0) return;
  const block = flareAdapter.exportPowerFile(fresh).replace(/^APPEND\s*\n/, "");
  if (!existing.trim()) {
    fs.writeFileSync(file, flareAdapter.exportPowerFile(fresh), "utf8");
    return;
  }
  const base = /^APPEND\b/m.test(existing) ? existing : flareAdapter.withAppend(existing);
  fs.writeFileSync(file, `${base.endsWith("\n") ? base : `${base}\n`}\n${block}`, "utf8");
}

function writeCategoryFile(filePath, items) {
  const rendered = flareAdapter.exportItemFile(items, { append: true });
  fs.writeFileSync(filePath, rendered.text, "utf8");
  mergePowerFile(projectPathFromItemFile(filePath), rendered.powers);
}

/**
 * Rebuild the top-level items/items.txt index file with INCLUDE directives
 * for each existing category file plus any 'Default' items.
 */
function rebuildItemsIndex(projectPath) {
  const itemsDir = path.join(projectPath, "items");
  const categoriesDir = path.join(itemsDir, "categories");
  if (!fs.existsSync(itemsDir)) return;

  const itemsIndexFile = path.join(itemsDir, "items.txt");
  const defaultItems = fs.existsSync(itemsIndexFile) ? parseItemsInCategoryFile(itemsIndexFile) : [];
  const includes = fs.existsSync(categoriesDir)
    ? fs.readdirSync(categoriesDir).filter((f) => f.toLowerCase().endsWith(".txt")).sort().map((f) => `items/categories/${f}`)
    : [];
  const rendered = flareAdapter.exportItemFile(defaultItems, { append: true, includes });
  fs.writeFileSync(itemsIndexFile, rendered.text, "utf8");
  mergePowerFile(projectPath, rendered.powers);
  console.log("Rebuilt items index:", itemsIndexFile);
}

/**
 * Ensure items and items/categories folders/file structure exist.
 * Category structure: items/categories/<name>.txt (file, not directory).
 */
ipcMainLocal.handle("ensure-items-folders", async (event, projectPath) => {
  try {
    if (!projectPath || !fs.existsSync(projectPath)) {
      throw new Error("Project path is required and must exist");
    }

    const itemsDir = path.join(projectPath, "items");
    const categoriesDir = path.join(itemsDir, "categories");

    if (!fs.existsSync(itemsDir)) {
      fs.mkdirSync(itemsDir, { recursive: true });
      console.log("Created items directory:", itemsDir);
    }

    if (!fs.existsSync(categoriesDir)) {
      fs.mkdirSync(categoriesDir, { recursive: true });
      console.log("Created items/categories directory:", categoriesDir);
    }

    // Migrate old category directories (items/categories/potions/*.txt) to files
    // (items/categories/potions.txt) so the structure matches Flare conventions.
    if (fs.existsSync(categoriesDir)) {
      const catEntries = fs.readdirSync(categoriesDir, { withFileTypes: true });
      for (const entry of catEntries) {
        if (entry.isDirectory()) {
          const dirPath = path.join(categoriesDir, entry.name);
          const txtPath = path.join(categoriesDir, entry.name + ".txt");
          // Skip if the .txt file already exists
          if (fs.existsSync(txtPath)) {
            console.log("Category .txt already exists, removing old directory:", dirPath);
            try { fs.rmSync(dirPath, { recursive: true, force: true }); } catch {}
            continue;
          }
          // Collect all [item] blocks from files inside the directory
          const items = [];
          const files = fs.readdirSync(dirPath);
          for (const f of files) {
            if (f.toLowerCase().endsWith(".txt")) {
              const parsed = parseItemsInCategoryFile(path.join(dirPath, f));
              items.push(...parsed);
            }
          }
          if (items.length > 0) {
            // Sort by id
            items.sort((a, b) => (parseInt(a.id, 10) || 0) - (parseInt(b.id, 10) || 0));
            writeCategoryFile(txtPath, items);
            console.log("Migrated category directory to file:", entry.name, "->", txtPath);
          }
          try { fs.rmSync(dirPath, { recursive: true, force: true }); } catch {}
        }
      }
    }

    // Create qualities.txt file if it doesn't exist
    const qualitiesFile = path.join(itemsDir, "qualities.txt");
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
      fs.writeFileSync(qualitiesFile, flareAdapter.withAppend(qualitiesContent), "utf8");
      console.log("Created qualities.txt file:", qualitiesFile);
    }

    // Create / rebuild items.txt index
    rebuildItemsIndex(projectPath);

    return { success: true };
  } catch (error) {
    console.error("Error ensuring items folders:", error);
    return { success: false, error: error.message };
  }
});

// Get item categories (.txt files in items/categories)
ipcMainLocal.handle("get-item-categories", async (event, projectPath) => {
  try {
    if (!projectPath || !fs.existsSync(projectPath)) {
      return { success: true, categories: ["Default"] };
    }

    const categoriesDir = path.join(projectPath, "items", "categories");
    const categories = ["Default"]; // Default is always first

    if (fs.existsSync(categoriesDir)) {
      const entries = fs.readdirSync(categoriesDir);
      for (const f of entries) {
        if (f.toLowerCase().endsWith(".txt")) {
          categories.push(f.replace(/\.txt$/i, ""));
        }
      }
    }

    return { success: true, categories };
  } catch (error) {
    console.error("Error getting item categories:", error);
    return { success: false, error: error.message, categories: ["Default"] };
  }
});

// Create a new item category file
ipcMainLocal.handle(
  "create-item-category",
  async (event, projectPath, categoryName) => {
    try {
      if (!projectPath || !fs.existsSync(projectPath)) {
        throw new Error("Project path is required and must exist");
      }
      if (!categoryName || !categoryName.trim()) {
        throw new Error("Category name is required");
      }

      const sanitize = (input) => {
        return (
          String(input || "")
            .replace(/[<>:"/\\|?*]/g, "_")
            .trim()
            .replace(/\s+/g, "_")
            .replace(/_{2,}/g, "_") || "unnamed_category"
        );
      };

      const sanitizedName = sanitize(categoryName);
      const categoriesDir = path.join(projectPath, "items", "categories");

      // Ensure items/categories exists
      if (!fs.existsSync(categoriesDir)) {
        fs.mkdirSync(categoriesDir, { recursive: true });
      }

      const categoryFile = path.join(categoriesDir, `${sanitizedName}.txt`);

      if (!fs.existsSync(categoryFile)) {
        fs.writeFileSync(categoryFile, "", "utf8");
        console.log("Created item category file:", categoryFile);
      }

      // Rebuild the main items index
      rebuildItemsIndex(projectPath);

      return {
        success: true,
        categoryName: sanitizedName,
        categoryPath: categoryFile,
      };
    } catch (error) {
      console.error("Error creating item category:", error);
      return { success: false, error: error.message };
    }
  }
);

// Get next item ID by scanning existing items
ipcMainLocal.handle("get-next-item-id", async (event, projectPath) => {
  try {
    if (!projectPath || !fs.existsSync(projectPath)) {
      return { success: true, nextId: 1 };
    }

    const itemsDir = path.join(projectPath, "items");
    let maxId = 0;

    const scanFile = (filePath) => {
      if (!fs.existsSync(filePath)) return;
      const items = parseItemsInCategoryFile(filePath);
      for (const item of items) {
        if (item.id > maxId) maxId = item.id;
      }
    };

    // Scan all category files
    const categoriesDir = path.join(itemsDir, "categories");
    if (fs.existsSync(categoriesDir)) {
      const entries = fs.readdirSync(categoriesDir);
      for (const f of entries) {
        if (f.toLowerCase().endsWith(".txt")) {
          scanFile(path.join(categoriesDir, f));
        }
      }
    }

    // Also scan items.txt for any Default items
    const itemsIndexFile = path.join(itemsDir, "items.txt");
    scanFile(itemsIndexFile);

    return { success: true, nextId: maxId + 1 };
  } catch (error) {
    console.error("Error getting next item ID:", error);
    return { success: true, nextId: 1 };
  }
});

// Create item file — adds a new [item] block to the category .txt file
ipcMainLocal.handle(
  "create-item-file",
  async (event, projectPath, itemData) => {
    try {
      if (!projectPath || !fs.existsSync(projectPath)) {
        throw new Error("Project path is required and must exist");
      }
      if (!itemData || !itemData.name) {
        throw new Error("Item name is required");
      }

      const category = itemData.category || "Default";
      const role = String(itemData.role || "").trim().toLowerCase() || "unspecified";
      const resourceSubtype = String(itemData.resourceSubtype || "").trim().toLowerCase();

      let categoryFilePath;
      if (category === "Default") {
        // Default items live in items.txt (we'll append to it)
        categoryFilePath = path.join(projectPath, "items", "items.txt");
      } else {
        const categoriesDir = path.join(projectPath, "items", "categories");
        if (!fs.existsSync(categoriesDir)) {
          fs.mkdirSync(categoriesDir, { recursive: true });
        }
        categoryFilePath = path.join(categoriesDir, `${category}.txt`);
        if (!fs.existsSync(categoryFilePath)) {
          fs.writeFileSync(categoryFilePath, "", "utf8");
        }
      }

      // Read existing items for this category file
      let existingItems = [];
      if (category === "Default" && fs.existsSync(categoryFilePath)) {
        // For items.txt, we only extract Default items — but since items.txt
        // may have INCLUDE lines, we keep it simple: append-only, no dedup.
        // The file is rewritten below, so we need to read the block we wrote.
        // Actually for Default we need to rebuild items.txt.
        existingItems = parseItemsInCategoryFile(categoryFilePath);
      } else {
        existingItems = parseItemsInCategoryFile(categoryFilePath);
      }

      // Check for duplicate (same name + same role)
      const normalizedName = itemData.name.trim().toLowerCase();
      const isDup = existingItems.some(
        (it) =>
          (it.name || "").toLowerCase() === normalizedName &&
          (it._role || "unspecified") === role
      );
      if (isDup) {
        console.warn("Duplicate item skipped:", normalizedName, role);
        return { success: false, error: `Item "${itemData.name}" already exists in category "${category}" with role "${role}".` };
      }

      // Build the new item object
      const newItem = {
        id: itemData.id,
        name: itemData.name.trim(),
        _role: role,
        ...(resourceSubtype && role === "resource" ? { _resourceSubtype: resourceSubtype } : {}),
        ...(itemData.flavor ? { flavor: itemData.flavor } : {}),
        ...(itemData.level != null ? { level: itemData.level } : {}),
        ...(itemData.icon ? { icon: itemData.icon } : {}),
        ...(itemData.quality ? { quality: itemData.quality } : {}),
        ...(itemData.price != null ? { price: itemData.price } : {}),
        ...(itemData.price_per_level != null ? { price_per_level: itemData.price_per_level } : {}),
        ...(itemData.price_sell != null ? { price_sell: itemData.price_sell } : {}),
        ...(itemData.type ? { type: itemData.type } : {}),
        ...(itemData.speed ? { speed: itemData.speed } : {}),
        ...(itemData.radius ? { radius: itemData.radius } : {}),
        ...(itemData.trait_elemental ? { trait_elemental: itemData.trait_elemental } : {}),
        ...(itemData.wall_power ? { wall_power: itemData.wall_power } : {}),
        ...(itemData.use_hazard ? { use_hazard: "true" } : {}),
        ...(itemData.post_power ? { post_power: itemData.post_power } : {}),
        ...(itemData.post_effect ? { post_effect: itemData.post_effect } : {}),
        ...(itemData.requires_hpmp_state ? { requires_hpmp_state: itemData.requires_hpmp_state } : {}),
        ...(itemData.requires_item ? { requires_item: itemData.requires_item } : {}),
        ...(itemData.new_state ? { new_state: itemData.new_state } : {}),
        ...(itemData.modifier_damage ? { modifier_damage: itemData.modifier_damage } : {}),
        ...(itemData.lifespan ? { lifespan: itemData.lifespan } : {}),
        ...(itemData.face ? { face: "true" } : {}),
        ...(itemData.max_quantity && itemData.max_quantity > 1 ? { max_quantity: itemData.max_quantity } : {}),
        ...(itemData.quest_item ? { quest_item: "true" } : {}),
        ...(itemData.no_stash && itemData.no_stash !== "ignore" ? { no_stash: itemData.no_stash } : {}),
        ...(itemData.item_type ? { item_type: itemData.item_type } : {}),
        ...(itemData.equip_flags ? { equip_flags: itemData.equip_flags } : {}),
        ...(itemData.requires_level && itemData.requires_level > 0 ? { requires_level: itemData.requires_level } : {}),
        ...(itemData.requires_stat ? { requires_stat: itemData.requires_stat } : {}),
        ...(itemData.requires_class ? { requires_class: itemData.requires_class } : {}),
        ...(itemData.disable_slots ? { disable_slots: itemData.disable_slots } : {}),
        ...(itemData.gfx ? { gfx: itemData.gfx } : {}),
        ...(itemData.bonus ? { bonus: itemData.bonus } : {}),
        ...(itemData.bonus_power_level ? { bonus_power_level: itemData.bonus_power_level } : {}),
        ...(itemData.dmg ? { dmg: itemData.dmg } : {}),
        ...(itemData.abs ? { abs: itemData.abs } : {}),
        ...(itemData.power ? { power: itemData.power } : {}),
        ...(itemData.power_desc ? { power_desc: itemData.power_desc } : {}),
        ...(itemData.replace_power ? { replace_power: itemData.replace_power } : {}),
        ...(itemData.book ? { book: itemData.book } : {}),
        ...(itemData.book_is_readable ? { book_is_readable: "true" } : {}),
        ...(itemData.script ? { script: itemData.script } : {}),
        ...(itemData.soundfx ? { soundfx: itemData.soundfx } : {}),
        ...(itemData.stepfx ? { stepfx: itemData.stepfx } : {}),
        ...(itemData.loot_animation ? { loot_animation: itemData.loot_animation } : {}),
        ...(itemData.randomizer_def ? { randomizer_def: itemData.randomizer_def } : {}),
        ...(itemData.loot_drops_max && itemData.loot_drops_max > 1 ? { loot_drops_max: itemData.loot_drops_max } : {}),
        ...(itemData.pickup_status ? { pickup_status: itemData.pickup_status } : {}),
      };

      // Append and rebuild
      existingItems.push(newItem);

      if (category === "Default") {
        rebuildDefaultItems(categoryFilePath, existingItems, projectPath);
      } else {
        writeCategoryFile(categoryFilePath, existingItems);
      }

      // Rebuild the main items index
      rebuildItemsIndex(projectPath);

      console.log("Item added to category:", itemData.name.trim(), "@", categoryFilePath);
      return {
        success: true,
        filePath: `${categoryFilePath}#item_${itemData.id}`,
        filename: category === "Default" ? "items.txt" : `${category}.txt`,
        categoryFilePath,
      };
    } catch (error) {
      console.error("Error creating item file:", error);
      return { success: false, error: error.message };
    }
  }
);

/**
 * Rewrite items/items.txt with Default items embedded and INCLUDE lines for categories.
 * Receives the projectPath so path derivation remains correct.
 */
function rebuildDefaultItems(itemsTxtPath, defaultItems, projectPath) {
  const itemsDir = path.join(projectPath, "items");
  if (!fs.existsSync(itemsDir)) return;

  const categoriesDir = path.join(itemsDir, "categories");
  const includes = fs.existsSync(categoriesDir)
    ? fs.readdirSync(categoriesDir).filter((f) => f.toLowerCase().endsWith(".txt")).sort().map((f) => `items/categories/${f}`)
    : [];
  const rendered = flareAdapter.exportItemFile(defaultItems, { append: true, includes });
  fs.writeFileSync(itemsTxtPath, rendered.text, "utf8");
  mergePowerFile(projectPath, rendered.powers);
}

// List all items in the project
ipcMainLocal.handle("list-items", async (event, projectPath) => {
  try {
    if (!projectPath || !fs.existsSync(projectPath)) {
      return { success: true, items: [] };
    }

    const itemsDir = path.join(projectPath, "items");
    const categoriesDir = path.join(itemsDir, "categories");
    const items = [];

    /**
     * Read a category .txt, extract every [item] block, return normalized summaries.
     * filePath uses a #item_<id> fragment so the renderer can target the correct item.
     */
    const addItemsFromFile = (filePath, category, categoryFilePath) => {
      const parsed = parseItemsInCategoryFile(filePath);
      for (const item of parsed) {
        items.push({
          id: item.id,
          name: item.name || path.basename(filePath, ".txt"),
          category,
          filePath: `${filePath}#item_${item.id}`,
          fileName: path.basename(categoryFilePath),
          role: item._role || "unspecified",
          resourceSubtype: item._resourceSubtype || "",
        });
      }
    };

    // Scan categories/*.txt
    if (fs.existsSync(categoriesDir)) {
      const entries = fs.readdirSync(categoriesDir);
      for (const f of entries) {
        if (f.toLowerCase().endsWith(".txt")) {
          const catName = f.replace(/\.txt$/i, "");
          addItemsFromFile(
            path.join(categoriesDir, f),
            catName,
            `items/categories/${f}`
          );
        }
      }
    }

    // Also scan items.txt for any Default items embedded directly
    const itemsIndexFile = path.join(itemsDir, "items.txt");
    if (fs.existsSync(itemsIndexFile)) {
      addItemsFromFile(itemsIndexFile, "Default", "items/items.txt");
    }

    items.sort((a, b) => a.id - b.id);
    return { success: true, items };
  } catch (error) {
    console.error("Error listing items:", error);
    return { success: false, error: error.message, items: [] };
  }
});

// Read item file and parse all properties
// filePath may include a #item_<id> fragment — strip it to find the real file
ipcMainLocal.handle("read-item-file", async (event, filePath) => {
  try {
    const hashIdx = filePath.indexOf("#");
    const realPath = hashIdx > 0 ? filePath.substring(0, hashIdx) : filePath;
    if (!realPath || !fs.existsSync(realPath)) {
      return { success: false, error: "Item file not found" };
    }

    const hashPart = hashIdx > 0 ? filePath.substring(hashIdx + 1) : "";
    const itemIdMatch = hashPart.match(/^item_(\d+)$/);
    const targetId = itemIdMatch ? parseInt(itemIdMatch[1], 10) : null;

    const parsed = parseItemsInCategoryFile(realPath);

    if (targetId !== null) {
      // Find the specific item
      const item = parsed.find(i => i.id === targetId);
      if (item) {
        // Convert numeric fields
        if (item.level) item.level = parseInt(item.level, 10) || 1;
        if (item.max_quantity) item.max_quantity = parseInt(item.max_quantity, 10) || 1;
        if (item.requires_level) item.requires_level = parseInt(item.requires_level, 10) || 0;
        if (item.loot_drops_max) item.loot_drops_max = parseInt(item.loot_drops_max, 10) || 1;
        return { success: true, data: item };
      }
      return { success: false, error: `Item with id=${targetId} not found in file` };
    }

    // Fallback: return first item if no fragment provided
    if (parsed.length > 0) {
      return { success: true, data: parsed[0] };
    }

    return { success: false, error: "No items found in file" };
  } catch (error) {
    console.error("Error reading item file:", error);
    return { success: false, error: error.message };
  }
});

// Write item file with all properties
// filePath may include #item_<id> — we update that item inside a multi-item category .txt
ipcMainLocal.handle("write-item-file", async (event, filePath, itemData) => {
  try {
    // Strip the #item_<id> fragment to get the real file path
    const hashIdx = filePath.indexOf("#");
    const categoryFilePath = hashIdx > 0 ? filePath.substring(0, hashIdx) : filePath;
    if (!fs.existsSync(categoryFilePath)) {
      return { success: false, error: `Category file not found: ${categoryFilePath}` };
    }

    const hashPart = hashIdx > 0 ? filePath.substring(hashIdx + 1) : "";
    const itemIdMatch = hashPart.match(/^item_(\d+)$/);
    const targetId = itemIdMatch ? parseInt(itemIdMatch[1], 10) : (itemData.id != null ? itemData.id : null);

    // Read existing items
    const existingItems = parseItemsInCategoryFile(categoryFilePath);
    const idx = existingItems.findIndex(i => i.id === targetId);

    // Preserve role/resource metadata
    const normalizedRole = (typeof itemData.role === "string" ? itemData.role : "").toLowerCase() || "unspecified";
    const normalizedResourceSubtype = (typeof itemData.resourceSubtype === "string" ? itemData.resourceSubtype : "").toLowerCase();

    if (idx >= 0) {
      // Update existing item — merge current editor state, preserving unknown fields
      const existing = existingItems[idx];
      existingItems[idx] = {
        ...existing,
        ...itemData,
        id: itemData.id ?? existing.id,
        name: itemData.name ?? existing.name,
        _role: normalizedRole,
        ...(normalizedResourceSubtype ? { _resourceSubtype: normalizedResourceSubtype } : existing._resourceSubtype ? { _resourceSubtype: existing._resourceSubtype } : {}),
      };
    } else {
      // Item not found — create new
      existingItems.push({
        id: itemData.id ?? (existingItems.length > 0 ? Math.max(...existingItems.map(i => i.id)) + 1 : 1),
        name: itemData.name || "Unnamed Item",
        _role: normalizedRole,
        ...(normalizedResourceSubtype ? { _resourceSubtype: normalizedResourceSubtype } : {}),
        ...(itemData.flavor ? { flavor: itemData.flavor } : {}),
        ...(itemData.level ? { level: itemData.level } : {}),
        ...(itemData.icon ? { icon: itemData.icon } : {}),
        ...(itemData.quality ? { quality: itemData.quality } : {}),
        ...(itemData.price != null ? { price: itemData.price } : {}),
        ...(itemData.price_sell != null ? { price_sell: itemData.price_sell } : {}),
        ...(itemData.max_quantity && itemData.max_quantity > 1 ? { max_quantity: itemData.max_quantity } : {}),
        ...(itemData.quest_item ? { quest_item: "true" } : {}),
        ...(itemData.no_stash && itemData.no_stash !== "ignore" ? { no_stash: itemData.no_stash } : {}),
        ...(itemData.item_type ? { item_type: itemData.item_type } : {}),
        ...(itemData.equip_flags ? { equip_flags: itemData.equip_flags } : {}),
        ...(itemData.requires_level && itemData.requires_level > 0 ? { requires_level: itemData.requires_level } : {}),
        ...(itemData.requires_stat ? { requires_stat: itemData.requires_stat } : {}),
        ...(itemData.requires_class ? { requires_class: itemData.requires_class } : {}),
        ...(itemData.disable_slots ? { disable_slots: itemData.disable_slots } : {}),
        ...(itemData.gfx ? { gfx: itemData.gfx } : {}),
        ...(itemData.bonus ? { bonus: itemData.bonus } : {}),
        ...(itemData.bonus_power_level ? { bonus_power_level: itemData.bonus_power_level } : {}),
        ...(itemData.dmg ? { dmg: itemData.dmg } : {}),
        ...(itemData.abs ? { abs: itemData.abs } : {}),
        ...(itemData.power ? { power: itemData.power } : {}),
        ...(itemData.power_desc ? { power_desc: itemData.power_desc } : {}),
        ...(itemData.replace_power ? { replace_power: itemData.replace_power } : {}),
        ...(itemData.book ? { book: itemData.book } : {}),
        ...(itemData.book_is_readable ? { book_is_readable: "true" } : {}),
        ...(itemData.script ? { script: itemData.script } : {}),
        ...(itemData.soundfx ? { soundfx: itemData.soundfx } : {}),
        ...(itemData.stepfx ? { stepfx: itemData.stepfx } : {}),
        ...(itemData.loot_animation ? { loot_animation: itemData.loot_animation } : {}),
        ...(itemData.randomizer_def ? { randomizer_def: itemData.randomizer_def } : {}),
        ...(itemData.price_per_level != null ? { price_per_level: itemData.price_per_level } : {}),
        ...(itemData.type ? { type: itemData.type } : {}),
        ...(itemData.speed ? { speed: itemData.speed } : {}),
        ...(itemData.radius ? { radius: itemData.radius } : {}),
        ...(itemData.trait_elemental ? { trait_elemental: itemData.trait_elemental } : {}),
        ...(itemData.wall_power ? { wall_power: itemData.wall_power } : {}),
        ...(itemData.use_hazard ? { use_hazard: "true" } : {}),
        ...(itemData.post_power ? { post_power: itemData.post_power } : {}),
        ...(itemData.post_effect ? { post_effect: itemData.post_effect } : {}),
        ...(itemData.requires_hpmp_state ? { requires_hpmp_state: itemData.requires_hpmp_state } : {}),
        ...(itemData.requires_item ? { requires_item: itemData.requires_item } : {}),
        ...(itemData.new_state ? { new_state: itemData.new_state } : {}),
        ...(itemData.modifier_damage ? { modifier_damage: itemData.modifier_damage } : {}),
        ...(itemData.lifespan ? { lifespan: itemData.lifespan } : {}),
        ...(itemData.face ? { face: "true" } : {}),
        ...(itemData.loot_drops_max && itemData.loot_drops_max > 1 ? { loot_drops_max: itemData.loot_drops_max } : {}),
        ...(itemData.pickup_status ? { pickup_status: itemData.pickup_status } : {}),
      });
    }

    writeCategoryFile(categoryFilePath, existingItems);
    console.log("Item saved:", targetId, "@", categoryFilePath);
    return { success: true };
  } catch (error) {
    console.error("Error writing item file:", error);
    return { success: false, error: error.message };
  }
});

// Delete item file — removes the [item] block from the category .txt
ipcMainLocal.handle("read-file", async (event, filePath) => {
  try {
    if (!isAllowedProjectPath(filePath) || !fs.existsSync(filePath)) {
      return null;
    }
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    console.error("Error reading file:", error);
    return null;
  }
});

ipcMainLocal.handle("create-folder-if-not-exists", async (_event, folderPath) => {
  try {
    if (!isAllowedProjectPath(folderPath)) return false;
    fs.mkdirSync(folderPath, { recursive: true });
    return true;
  } catch (error) {
    console.error("Error creating folder:", folderPath, error);
    return false;
  }
});

ipcMainLocal.handle("write-file", async (_event, filePath, content) => {
  try {
    if (!isAllowedProjectPath(filePath)) return false;
    const directory = path.dirname(filePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    fs.writeFileSync(filePath, content, "utf8");
    return true;
  } catch (error) {
    console.error("Error writing file:", filePath, error);
    return false;
  }
});

ipcMainLocal.handle("read-dir", async (_event, dirPath) => {
  try {
    if (!isAllowedProjectPath(dirPath) || !fs.existsSync(dirPath)) {
      return [];
    }
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries.map((entry) => ({ name: entry.name, isDirectory: entry.isDirectory() }));
  } catch (error) {
    console.error("Error reading directory:", dirPath, error);
    return [];
  }
});

ipcMainLocal.handle("get-project-folder", async () => {
  try {
    return app.getPath("documents");
  } catch (error) {
    console.error("Error retrieving project folder:", error);
    return null;
  }
});

ipcMainLocal.handle("delete-item-file", async (event, filePath) => {
  try {
    if (!filePath) {
      return { success: false, error: "File path is required" };
    }

    const hashIdx = filePath.indexOf("#");
    const categoryFilePath = hashIdx > 0 ? filePath.substring(0, hashIdx) : filePath;

    if (!fs.existsSync(categoryFilePath)) {
      return { success: false, error: "File does not exist" };
    }

    const hashPart = hashIdx > 0 ? filePath.substring(hashIdx + 1) : "";
    const itemIdMatch = hashPart.match(/^item_(\d+)$/);
    const targetId = itemIdMatch ? parseInt(itemIdMatch[1], 10) : null;

    if (targetId == null) {
      return { success: false, error: "Cannot delete: no item id in path" };
    }

    const existingItems = parseItemsInCategoryFile(categoryFilePath);
    const filtered = existingItems.filter(i => i.id !== targetId);

    if (filtered.length === 0) {
      // No items left — remove the empty file
      fs.unlinkSync(categoryFilePath);
    } else {
      writeCategoryFile(categoryFilePath, filtered);
    }

    console.log("Item deleted:", targetId, "@", categoryFilePath);
    return { success: true };
  } catch (error) {
    console.error("Error deleting item file:", error);
    return { success: false, error: error.message };
  }
});

// Launch Flare engine with optional arguments
const { spawn: spawnProcess } = require("child_process");

let activeFlareProcess = null;
// Symlinks this process created under path_user/mods. They are left in place
// so the next Play can reuse them; the set records what we added.
const createdJunctions = new Set();

ipcMainLocal.handle("select-flare-exe", async () => {
  const options = {
    title: "Select the Flare executable",
    properties: ["openFile"],
  };
  if (process.platform === "win32") {
    options.filters = [
      { name: "Flare executable", extensions: ["exe"] },
      { name: "All files", extensions: ["*"] },
    ];
  }
  const result = await dialog.showOpenDialog(mainWindow, options);
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

function flarePathProbe() {
  return {
    platform: process.platform,
    exists: (candidate) => fs.existsSync(candidate),
    isDirectory: (candidate) => {
      try {
        return fs.statSync(candidate).isDirectory();
      } catch {
        return false;
      }
    },
  };
}

function readProjectMods(projectPath, flarePath) {
  const modName = path.basename(String(projectPath || "").replace(/[\\/]+$/, ""));
  const settingsPath = path.join(projectPath, "settings.txt");
  const settingsText = fs.existsSync(settingsPath) ? fs.readFileSync(settingsPath, "utf8") : "";
  const mods = flareLaunch.buildModList(flareLaunch.parseRequires(settingsText), modName);
  const pathUser = currentPathUser();
  const probe = flarePathProbe();
  const target = flarePath ? flareLaunch.resolveFlareLaunchTarget(flarePath, probe) : null;
  const dataPath = target && !target.error ? target.dataPath : flareLaunch.dataPathFromFlareSelection(flarePath || "");
  const cwd = target && !target.error ? target.cwd : dataPath;
  const passDataPath = Boolean(target && !target.error && target.passDataPath);
  const missingMods = flareLaunch.findMissingMods(mods, {
    pathUser,
    dataPath,
    cwd,
    passDataPath,
    platform: process.platform,
    env: process.env,
    projectModName: modName,
    exists: probe.exists,
  });
  return { modName, mods, missingMods, pathUser, dataPath };
}

ipcMainLocal.handle("ensure-flare-mod-link", async (_event, { flarePath, projectPath } = {}) => {
  try {
    if (!projectPath) return { success: false, error: "Project path is required." };
    const pathUser = currentPathUser();
    fs.mkdirSync(path.join(pathUser, "mods"), { recursive: true });
    fs.mkdirSync(path.join(pathUser, "saves"), { recursive: true });

    const dataPath = flareLaunch.dataPathFromFlareSelection(flarePath || "");
    const resolvedProject = path.resolve(projectPath);
    const dataMods = dataPath ? path.resolve(dataPath, "mods") : "";
    let linkResult;
    if (dataMods && flareLaunch.isPathInside(dataMods, resolvedProject)) {
      linkResult = {
        success: true,
        modName: path.basename(resolvedProject),
        junctionCreated: false,
      };
    } else {
      linkResult = flareLaunch.linkProjectMod(projectPath, pathUser);
      if (linkResult.junctionCreated && linkResult.linkPath) {
        createdJunctions.add(linkResult.linkPath);
      }
    }
    if (!linkResult.success) return linkResult;

    const modsInfo = readProjectMods(projectPath, flarePath);
    return {
      ...linkResult,
      mods: modsInfo.mods,
      missingMods: modsInfo.missingMods,
    };
  } catch (err) {
    console.error("[FlareEngine] ensure-flare-mod-link error:", err);
    return { success: false, error: err.message };
  }
});

function readOptionalText(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return "";
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function resolveQuickLaunchMap(projectPath, mapName, mode) {
  if (mode === "new-game") {
    const spawnText = readOptionalText(path.join(projectPath, "maps", "spawn.txt"))
      || readOptionalText(path.join(projectPath, "maps", "spawn.txt.bak"));
    const intermap = flareLaunch.parseIntermap(spawnText);
    if (intermap) {
      return { relativePath: intermap.map, x: intermap.x, y: intermap.y, fromIntermap: true };
    }
  }
  const candidates = flareLaunch.candidateMapRelatives(mapName);
  for (const relativePath of candidates) {
    if (fs.existsSync(path.join(projectPath, relativePath))) {
      return { relativePath, x: null, y: null, fromIntermap: false };
    }
  }
  return { relativePath: candidates[0] || "", x: null, y: null, fromIntermap: false };
}

ipcMainLocal.handle("prepare-flare-quick-launch", async (_event, { flarePath, projectPath, mapName, mode } = {}) => {
  let previousMisc = null;
  let miscPath = null;
  let testSaveDir = null;
  try {
    if (!projectPath) return { success: false, error: "Project path is required." };
    cleanupPlaySession(projectPath);

    const engineInfo = ensureProjectEngineFiles(projectPath);
    miscPath = engineInfo.miscPath;
    // A crashed launch can leave the temporary playtest prefix in misc.txt.
    let stablePrefix = engineInfo.savePrefix;
    if (stablePrefix.endsWith("_playtest")) {
      stablePrefix = stablePrefix.slice(0, -"_playtest".length) || stablePrefix;
      const healed = flareLaunch.upsertKey(fs.readFileSync(miscPath, "utf8"), "save_prefix", stablePrefix);
      fs.writeFileSync(miscPath, healed, "utf8");
    }
    const modsInfo = readProjectMods(projectPath, flarePath);
    if (modsInfo.missingMods.length > 0) {
      return {
        success: false,
        error: `Missing Flare mods: ${modsInfo.missingMods.join(", ")}. Install them where Flare looks for mods, or remove them from settings.txt requires=.`,
      };
    }

    const target = resolveQuickLaunchMap(projectPath, mapName, mode);
    if (!target.relativePath) {
      return { success: false, error: "No map is available to launch. Save the map first." };
    }
    const mapFile = path.join(projectPath, target.relativePath);
    if (!fs.existsSync(mapFile)) {
      return {
        success: false,
        error: `Map file not found: ${target.relativePath}. Save the project before playing.`,
      };
    }

    let x = target.x;
    let y = target.y;
    if (!target.fromIntermap) {
      const hero = flareLaunch.parseHeroPos(fs.readFileSync(mapFile, "utf8"));
      x = hero ? hero.x : 0;
      y = hero ? hero.y : 0;
    }

    const className = flareLaunch.firstHeroClassName(readOptionalText(path.join(projectPath, "engine", "classes.txt")));
    const testPrefix = flareLaunch.playtestPrefix(stablePrefix);
    previousMisc = fs.readFileSync(miscPath, "utf8");
    const playMisc = flareLaunch.upsertKey(previousMisc, "save_prefix", testPrefix, { appendIfEmpty: true });
    fs.writeFileSync(miscPath, playMisc, "utf8");

    const pathUser = currentPathUser();
    testSaveDir = path.join(pathUser, "saves", testPrefix);
    fs.rmSync(testSaveDir, { recursive: true, force: true });
    const slotDir = path.join(testSaveDir, "1");
    fs.mkdirSync(slotDir, { recursive: true });
    const avatar = flareLaunch.buildAvatarText({
      name: "StudioTest",
      className,
      mapPath: target.relativePath.replace(/\\/g, "/"),
      x,
      y,
    });
    fs.writeFileSync(path.join(slotDir, "avatar.txt"), avatar, "utf8");

    const slotNames = fs.readdirSync(testSaveDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    const loadSlot = flareLaunch.loadSlotIndex(slotNames, "1");
    if (!loadSlot) {
      throw new Error("Could not resolve a --load-slot index for the test save.");
    }

    const sessionDir = path.join(projectPath, PLAY_SESSION_DIR);
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFileSync(
      playSessionPath(projectPath),
      JSON.stringify({ previousMisc, testSaveDir, testPrefix, loadSlot }, null, 2),
      "utf8"
    );

    console.log(`[FlareEngine] Quick launch ${target.relativePath} at ${x},${y} via --load-slot=${loadSlot} (${testPrefix})`);
    return {
      success: true,
      loadSlot,
      slotNum: loadSlot,
      mods: modsInfo.mods,
    };
  } catch (err) {
    console.error("[FlareEngine] prepare-flare-quick-launch error:", err);
    if (previousMisc != null && miscPath) {
      try {
        fs.writeFileSync(miscPath, previousMisc, "utf8");
      } catch (restoreErr) {
        console.error("[FlareEngine] Failed to roll back misc.txt:", restoreErr);
      }
    }
    if (testSaveDir) {
      try {
        fs.rmSync(testSaveDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
    try {
      const sessionFile = projectPath ? playSessionPath(projectPath) : "";
      if (sessionFile && fs.existsSync(sessionFile)) fs.unlinkSync(sessionFile);
    } catch {
      /* ignore */
    }
    return { success: false, error: err.message };
  }
});

ipcMainLocal.handle("restore-spawn-backup", async (_event, { projectPath } = {}) => {
  try {
    if (!projectPath) return false;
    cleanupPlaySession(projectPath);
    return true;
  } catch (err) {
    console.error("[FlareEngine] restore-spawn-backup error:", err);
    return false;
  }
});

ipcMainLocal.handle("launch-flare-engine", async (_event, options = {}) => {
  const flarePath = options.flarePath;
  const target = flareLaunch.resolveFlareLaunchTarget(flarePath, flarePathProbe());
  if (target.error) {
    if (options.projectPath) cleanupPlaySession(options.projectPath);
    return { success: false, error: target.error };
  }

  if (activeFlareProcess && !activeFlareProcess.killed) {
    try {
      process.kill(activeFlareProcess.pid, 0);
      return { success: false, error: "Flare is already running. Close it first." };
    } catch {
      activeFlareProcess = null;
    }
  }

  const args = flareLaunch.buildFlareArgs({
    dataPath: target.passDataPath ? target.dataPath : undefined,
    mods: options.mods,
    loadSlot: options.loadSlot,
    loadScript: options.loadScript,
  });

  try {
    console.log("[FlareEngine] Launching:", target.exePath, args.join(" "), "cwd:", target.cwd);
    const child = spawnProcess(target.exePath, args, {
      cwd: target.cwd,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const logChunk = (prefix, chunk) => {
      const text = chunk.toString().trim();
      if (text) console.log(`[FlareEngine] ${prefix} ${text}`);
    };
    child.stdout?.on("data", (chunk) => logChunk("stdout", chunk));
    child.stderr?.on("data", (chunk) => logChunk("stderr", chunk));
    child.unref();
    activeFlareProcess = child;

    let settled = false;
    const onFlareStopped = (payload) => {
      if (settled) return;
      settled = true;
      activeFlareProcess = null;
      if (options.projectPath) cleanupPlaySession(options.projectPath);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("flare-engine-exited", payload);
      }
    };
    child.on("exit", () => onFlareStopped());
    child.on("error", (err) => {
      console.error("[FlareEngine] Process error:", err);
      onFlareStopped({ error: err.message });
    });

    return { success: true, pid: child.pid };
  } catch (err) {
    console.error("[FlareEngine] Failed to launch:", err);
    if (options.projectPath) cleanupPlaySession(options.projectPath);
    return { success: false, error: err.message };
  }
});

ipcMainLocal.handle("is-flare-running", async () => {
  if (!activeFlareProcess) return false;
  try {
    process.kill(activeFlareProcess.pid, 0);
    return true;
  } catch {
    activeFlareProcess = null;
    return false;
  }
});

ipcMainLocal.handle("file-exists", async (_event, filePath) => {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
});

// Handle app protocol for development
if (isDev) {
  if (process.platform === "win32") {
    process.on("message", (data) => {
      if (data === "graceful-exit") {
        app.quit();
      }
    });
  } else {
    process.on("SIGTERM", () => {
      app.quit();
    });
  }
}
