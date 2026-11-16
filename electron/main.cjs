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
const { migrateUserDataFromLegacyName } = require("./migrateUserData.cjs");
const { debugLog } = require("./debugLog.cjs");

// Before anything reads userData: package name is now flare-studio, so
// app.getPath("userData") is ~/.config/flare-studio (or the OS equivalent).
try {
  const migration = migrateUserDataFromLegacyName(app);
  if (migration.migrated) {
    debugLog("[userData] Copied settings from ism-tile to flare-studio");
  } else if (migration.skipped) {
    debugLog("[userData] Migration skipped:", migration.skipped);
  }
} catch (error) {
  console.warn("[userData] Migration failed:", error);
}

const displaySettings = require("./displaySettings.cjs");
const { validateSerializedFlareData, loadFlareDataSchema } = require("./flareDataValidator.cjs");
const flareLaunch = require("./flareLaunch.cjs");
const flareInstaller = require("./flareInstaller.cjs");
const flareTemplate = require("./flareTemplate.cjs");
const flareActorTemplate = require("./flareActorTemplate.cjs");
const tilesetDefLookup = require("./tilesetDefLookup.cjs");
const registerItemIpc = require("./itemIpc.cjs");
const registerFileIpc = require("./fileIpc.cjs");
const registerPlayIpc = require("./playIpc.cjs");
const flareAdapter = require("../src/adapters/flare/flareAdapter.cjs");
/** Map file base name; same slug Play and the adapter use. */
const sanitizeMapNameForFilename = (name) => flareAdapter.slugFileName(name);

/** Case-insensitive unlink of a single file inside dir. Path pieces in filename are rejected. */
const deleteMatchingFile = (dir, filename) => {
  if (!dir || !filename) return false;
  const base = String(filename);
  if (base.includes("/") || base.includes("\\") || base.includes("..")) return false;
  if (!fs.existsSync(dir)) return false;
  try {
    const entries = fs.readdirSync(dir);
    const normalized = base.toLowerCase();
    const match = entries.find((entry) => entry.toLowerCase() === normalized);
    if (!match) return false;
    const targetPath = path.join(dir, match);
    if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
      fs.unlinkSync(targetPath);
      return true;
    }
  } catch (error) {
    console.warn("deleteMatchingFile failed for", dir, filename, error);
  }
  return false;
};
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
  debugLog("Wrote settings.txt at", settingsPath);
  return true;
}

function ensureProjectEngineFiles(projectPath, tile) {
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
    fs.writeFileSync(tilesetConfigPath, flareAdapter.exportTilesetConfig(tile), "utf8");
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
  if (!result.files || result.files.length === 0) {
    console.warn("[migrate] kept the backup and did not write canonical files:", result.errors);
    return { migrated: false, errors: result.errors, backup: backupRoot };
  }
  for (const file of result.files) writeAdapterFile(projectPath, file.path, file.content);
  if (result.errors && result.errors.length > 0) {
    console.warn("[migrate] wrote files with per-file errors:", result.errors);
    return { migrated: true, errors: result.errors, backup: backupRoot };
  }
  debugLog("[migrate] wrote canonical project from", backupRoot);
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
    debugLog("[FlareEngine] Restored original spawn.txt");
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
        debugLog("[FlareEngine] Removed test save", session.testSaveDir);
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
  // build/icons is copied to resources/icons in packaged builds (see package.json extraResources).
  const dir = app.isPackaged ? path.join(process.resourcesPath, "icons") : path.join(__dirname, "..", "build", "icons");
  return path.join(dir, process.platform === "win32" ? "flare.ico" : "512x512.png");
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
    title: "Flare Studio",
  });

  displaySettings.applyInterfaceZoom(
    mainWindow.webContents,
    displaySettings.readDisplaySettings().interfaceScale,
  );

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
    promptClose();
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
      debugLog("NPC file saved:", npcFilePath);
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
            debugLog(
              "Found valid map file:",
              f,
              "name:",
              content.name,
              "layers:",
              content.layers?.length || 0
            );
          } else {
            if (isPhantomUntitledMap) {
              debugLog(
                "Skipping phantom Untitled_Map.json (empty default map from old bug):", f
              );
            } else {
              debugLog(
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

    debugLog("list-maps final result:", maps);
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


ipcMainLocal.handle("get-display-settings", async () => displaySettings.readDisplaySettings());

ipcMainLocal.handle("set-display-settings", async (_event, settings) => displaySettings.writeDisplaySettings(settings));

ipcMainLocal.handle("set-zoom-factor", async (_event, factor) => {
  if (!mainWindow || !mainWindow.webContents) return false;
  const n = Number(factor);
  if (!Number.isFinite(n)) return false;
  try {
    mainWindow.webContents.setZoomFactor(Math.min(2, Math.max(0.75, n)));
    return true;
  } catch (error) {
    console.error("set-zoom-factor failed:", error);
    return false;
  }
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

    // New projects use fantasycore's grid for the active Flare install:
    // 192x96 for Modern (1.15) and other engines, 64x32 for Classic (1.14).
    // Changeable later in Game Settings.
    const tile = { ...flareInstaller.tileForFlarePath(config.flarePath), orientation: "isometric" };

    // Create basic project structure
    const mapData = {
      name: config.name,
      width: config.width,
      height: config.height,
      tileSize: tile.width,
      tileHeight: tile.height,
      orientation: tile.orientation,
      layers: [],
      tilesets: [],
      version: "1.0",
    };

    // Save map configuration
    const mapConfigPath = path.join(projectPath, `${config.name}.json`);
    fs.writeFileSync(mapConfigPath, JSON.stringify(mapData, null, 2));
    const project = flareAdapter.emptyProject(config.name);
    project.tile = tile;
    const tilesetText = flareAdapter.exportTilesetConfig(tile);
    writeAdapterFile(
      projectPath,
      "project.json",
      `${JSON.stringify(project, null, 2)}\n`
    );
    writeAdapterFile(
      projectPath,
      "content/documents/engine/tileset_config.txt.json",
      flareAdapter.canonicalJson("document", { path: "engine/tileset_config.txt", text: tilesetText })
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
      ensureProjectEngineFiles(projectPath, tile);
    } catch (settingsErr) {
      console.warn(
        "Failed to write default settings.txt during project creation:",
        settingsErr
      );
    }

    // Do not create spawn.txt yet. It will be generated when a starting map is selected.

    return { success: true, projectPath };
  } catch (error) {
    console.error("Error creating map project:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});

ipcMainLocal.handle("open-map-project", async (event, projectPath, mapName) => {
  try {
    rememberProjectRoot(projectPath);
    debugLog("=== ELECTRON LOAD DEBUG ===");
    debugLog("Loading project from:", projectPath);
    debugLog("Requested map name:", mapName);
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
          debugLog("Requested map file not found:", candidate);
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
      debugLog("Loading map file:", mapConfigPath);
      const mapData = JSON.parse(fs.readFileSync(mapConfigPath, "utf8"));
      debugLog("Loaded map data:", {
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
                debugLog(
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
            debugLog(
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
        debugLog(
          "Tileset image files found:",
          Object.keys(mapData.tilesetImages)
        );
        // Show first few characters of each image data
        for (const [filename, imageData] of Object.entries(
          mapData.tilesetImages
        )) {
          if (typeof imageData === "string") {
            debugLog(
              `${filename}: ${
                imageData.length
              } chars, starts with: ${imageData.substring(0, 50)}...`
            );
          }
        }
      }

      return mapData;
    }

    debugLog("No map file found in project");
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
    debugLog(`[PROFILE SAVE] Saved tileset profiles to: ${profilePath}`);
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
      debugLog(`[PROFILE LOAD] Profile file not found: ${profilePath}`);
      return null;
    }

    const profileData = JSON.parse(fs.readFileSync(profilePath, "utf8"));
    debugLog(`[PROFILE LOAD] Loaded tileset profiles from: ${profilePath}`);
    debugLog(`[PROFILE LOAD] Profile version: ${profileData.version}, count: ${Object.keys(profileData.profiles || {}).length}`);
    
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
    debugLog("=== ELECTRON SAVE DEBUG ===");
    debugLog("Project path:", projectPath);
    debugLog("Map data received:", !!mapData);
    debugLog("Map name:", mapData?.name);

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
    debugLog("Saving to:", mapConfigPath);

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

    debugLog("Complete map data structure:", {
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
      debugLog(
        "Processing tileset images:",
        Object.keys(mapData.tilesetImages)
      );
      if (!fs.existsSync(imagesPath)) {
        fs.mkdirSync(imagesPath, { recursive: true });
        debugLog("Created images directory");
      }
      if (!fs.existsSync(tilesetsPath)) {
        fs.mkdirSync(tilesetsPath, { recursive: true });
        debugLog("Created tilesets directory");
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
            debugLog("Saved tileset image:", path.relative(projectPath, imagePath));
          } else {
            debugLog("Tileset image unchanged, skipping write:", filename);
          }
        }
      }
    } else {
      debugLog("No tileset images to save");
    }

    // Strip base64 image data from the JSON — images are stored as separate
    // files in images/tilesets/ so embedding them in the map JSON is redundant
    // and makes the .json file extremely large.
    const jsonData = { ...completeMapData };
    jsonData.tilesetImages = {};

    // Write the map data (lean JSON, no embedded base64 images)
    fs.writeFileSync(mapConfigPath, JSON.stringify(jsonData, null, 2));
    debugLog("Map configuration saved successfully (tileset images stored separately)");

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
        debugLog("Saved minimap to:", minimapPath);
      }
    } catch (mmErr) {
      console.warn("Failed to save minimap:", mmErr);
    }

    debugLog("Map project saved successfully:", mapConfigPath);
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
        debugLog("Spawn file saved:", spawnPath);
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
              debugLog(
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
              debugLog("Export: saved tileset image to", imagePath);
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
            debugLog("Created npcs directory:", npcsDir);
          }

          for (const npcFile of options.npcFiles) {
            if (npcFile && npcFile.filename && npcFile.content) {
              const npcFilePath = path.join(npcsDir, npcFile.filename);
              fs.writeFileSync(npcFilePath, npcFile.content, "utf8");
              debugLog("Export: saved NPC file to", npcFilePath);
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
            debugLog("Created images directory:", imagesDir);
          }
          if (!fs.existsSync(portraitsDir)) {
            fs.mkdirSync(portraitsDir, { recursive: true });
            debugLog("Created portraits directory:", portraitsDir);
          }

          for (const portrait of options.portraitFiles) {
            if (portrait && portrait.sourcePath && portrait.destFilename) {
              const destPath = path.join(portraitsDir, portrait.destFilename);
              if (fs.existsSync(portrait.sourcePath)) {
                fs.copyFileSync(portrait.sourcePath, destPath);
                debugLog("Export: copied portrait", portrait.sourcePath, "->", destPath);
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
            debugLog("Created images directory:", imagesDir);
          }
          if (!fs.existsSync(npcsImgDir)) {
            fs.mkdirSync(npcsImgDir, { recursive: true });
            debugLog("Created images/npcs directory:", npcsImgDir);
          }

          for (const img of options.npcTilesetImages) {
            if (img && img.sourcePath && img.destFilename) {
              const destPath = path.join(npcsImgDir, img.destFilename);
              if (fs.existsSync(img.sourcePath)) {
                fs.copyFileSync(img.sourcePath, destPath);
                debugLog("Export: copied NPC tileset image", img.sourcePath, "->", destPath);
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
            debugLog("Created animations directory:", animationsDir);
          }
          if (!fs.existsSync(npcsAnimDir)) {
            fs.mkdirSync(npcsAnimDir, { recursive: true });
            debugLog("Created animations/npcs directory:", npcsAnimDir);
          }

          for (const animFile of options.npcAnimationFiles) {
            if (animFile && animFile.filename && animFile.content) {
              const animFilePath = path.join(npcsAnimDir, animFile.filename);
              fs.writeFileSync(animFilePath, animFile.content, "utf8");
              debugLog("Export: saved NPC animation file to", animFilePath);
            }
          }
        }
      } catch (animErr) {
        console.warn("Failed to save NPC animation files:", animErr);
      }

      debugLog("Export files saved successfully:");
      debugLog("- Map:", mapFilePath);
      debugLog("- Tileset:", tilesetFilePath);
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





// Restart the application
ipcMainLocal.on("restart-app", () => {
  app.relaunch();
  app.exit(0);
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
        {
          label: "Interface larger",
          accelerator: "CmdOrCtrl+Plus",
          click: () => {
            if (mainWindow) mainWindow.webContents.send("interface-scale", "in");
          },
        },
        {
          label: "Interface larger",
          accelerator: "CmdOrCtrl+=",
          visible: false,
          acceleratorWorksWhenHidden: true,
          click: () => {
            if (mainWindow) mainWindow.webContents.send("interface-scale", "in");
          },
        },
        {
          label: "Interface larger",
          accelerator: "CmdOrCtrl+Shift+=",
          visible: false,
          acceleratorWorksWhenHidden: true,
          click: () => {
            if (mainWindow) mainWindow.webContents.send("interface-scale", "in");
          },
        },
        {
          label: "Interface larger",
          accelerator: "CmdOrCtrl+NumAdd",
          visible: false,
          acceleratorWorksWhenHidden: true,
          click: () => {
            if (mainWindow) mainWindow.webContents.send("interface-scale", "in");
          },
        },
        {
          label: "Interface smaller",
          accelerator: "CmdOrCtrl+-",
          click: () => {
            if (mainWindow) mainWindow.webContents.send("interface-scale", "out");
          },
        },
        {
          label: "Interface smaller",
          accelerator: "CmdOrCtrl+NumSub",
          visible: false,
          acceleratorWorksWhenHidden: true,
          click: () => {
            if (mainWindow) mainWindow.webContents.send("interface-scale", "out");
          },
        },
        {
          label: "Reset interface size",
          accelerator: "CmdOrCtrl+0",
          click: () => {
            if (mainWindow) mainWindow.webContents.send("interface-scale", "reset");
          },
        },
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
let closeFallbackTimer = null;
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
    debugLog("[Shutdown] Requesting renderer to flush pending saves");
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

function quitWithoutSaving() {
  allowQuit = true;
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
  app.quit();
}

/**
 * Ask the renderer about closing. It acks at once ("before-close-ack");
 * without a listener (e.g. welcome screen) it acks handled=false and we close.
 * No ack within 3s means the renderer is hung: fall back to the OS dialog.
 */
function promptClose() {
  if (closePromptOpen) return;
  if (!mainWindow || mainWindow.isDestroyed()) { quitWithoutSaving(); return; }
  closePromptOpen = true;
  mainWindow.webContents.send("before-close");
  if (closeFallbackTimer) clearTimeout(closeFallbackTimer);
  closeFallbackTimer = setTimeout(() => {
    closeFallbackTimer = null;
    if (!closePromptOpen) return;
    console.warn("[Close] Renderer did not answer before-close; using OS dialog");
    showFallbackCloseDialog().catch((err) => console.error("[Close] fallback dialog failed:", err));
  }, 3000);
}

async function showFallbackCloseDialog() {
  if (!mainWindow || mainWindow.isDestroyed()) { quitWithoutSaving(); return; }
  const result = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    title: "Flare Studio is not responding",
    message: "Close anyway?",
    detail: "Unsaved changes may be lost.",
    buttons: ["Close", "Cancel"],
    defaultId: 1,
    cancelId: 1,
  });
  closePromptOpen = false;
  if (result.response === 0) quitWithoutSaving();
}

ipcMainLocal.on("before-close-ack", (_event, handled) => {
  if (closeFallbackTimer) clearTimeout(closeFallbackTimer);
  closeFallbackTimer = null;
  if (!handled) {
    closePromptOpen = false;
    finishClose().catch((err) => console.error("[Shutdown] close failed:", err));
  }
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Ctrl+Q / menu Quit asks the same way as closing the window.
app.on("before-quit", (event) => {
  if (allowQuit) return;
  if (!mainWindow || mainWindow.isDestroyed()) return;
  event.preventDefault();
  promptClose();
});

ipcMainLocal.on("app-shutdown-complete", () => {
  debugLog("[Shutdown] Renderer finished pending saves");
  if (shutdownWait) shutdownWait();
});

// Renderer answer to before-close: false/"close" = nothing unsaved, "save", "discard", "cancel".
ipcMainLocal.handle("confirm-close", async (_event, decision) => {
  if (closeFallbackTimer) clearTimeout(closeFallbackTimer);
  closeFallbackTimer = null;
  closePromptOpen = false;
  if (decision === "save") {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("save-and-close");
    return false;
  }
  if (decision === "discard") {
    quitWithoutSaving();
    return true;
  }
  if (decision === "cancel") return false;
  await finishClose();
  return true;
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
      debugLog("Created npcs directory:", npcsDir);
    }

    // Sanitize NPC name for filename; append _2, _3 when that file already exists.
    const base = flareAdapter.slugFileName(npcData.name);
    let sanitizedName = base;
    let n = 2;
    while (fs.existsSync(path.join(npcsDir, `${sanitizedName}.txt`))) {
      sanitizedName = `${base}_${n}`;
      n += 1;
    }

    // Only generate the sanitized filename here — the actual NPC .txt content
    // is written by the save-export flow (saveExportFiles) which produces the
    // authoritative file with dialogues, vendor settings, and proper relative
    // paths.  Writing a skeleton here would be immediately overwritten on save,
    // and if save never runs the skeleton could have stale/incorrect data.

    debugLog("NPC filename generated:", `${sanitizedName}.txt`);
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












registerItemIpc({
  ipcMain: ipcMainLocal,
  fs,
  path,
  debugLog,
  flareAdapter,
  rememberProjectRoot,
  isAllowedProjectPath,
});

registerFileIpc({
  ipcMain: ipcMainLocal,
  app,
  dialog,
  shell,
  fs,
  path,
  rememberProjectRoot,
  isAllowedProjectPath,
  getMainWindow: () => mainWindow,
});

registerPlayIpc({
  ipcMain: ipcMainLocal,
  dialog,
  shell,
  fs,
  path,
  debugLog,
  flareLaunch,
  flareInstaller,
  flareTemplate,
  flareActorTemplate,
  tilesetDefLookup,
  rememberProjectRoot,
  isAllowedProjectPath,
  currentPathUser,
  playSessionPath,
  cleanupPlaySession,
  ensureProjectEngineFiles,
  PLAY_SESSION_DIR,
  getMainWindow: () => mainWindow,
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
