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
const registerMapIpc = require("./mapIpc.cjs");
const { ensureDefaultMenus } = require("./defaultMenus.cjs");
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
const { isInsideRootReal } = require("../src/editor/pathGuard.cjs");
const { isPlausibleProjectRoot } = require("../src/editor/projectRoot.cjs");
const allowedProjectRoots = new Set();

function rememberProjectRoot(projectPath) {
  if (typeof projectPath !== "string" || !projectPath) return;
  // The renderer asks for this, so it is untrusted: only a directory that looks
  // like a project may widen the allowlist. Without the check one call with "/"
  // or "$HOME" made every guarded handler accept any path on disk.
  if (!isPlausibleProjectRoot(projectPath)) {
    console.warn("rememberProjectRoot: not a project root, ignored:", projectPath);
    return;
  }
  allowedProjectRoots.add(path.resolve(projectPath));
}

function isAllowedProjectPath(targetPath) {
  if (typeof targetPath !== "string" || !targetPath) return false;
  for (const root of allowedProjectRoots) {
    if (isInsideRootReal(root, targetPath)) return true;
  }
  return false;
}
const isDev = !app.isPackaged;
// Automated tests must not open DevTools: the extra devtools:// window steals
// focus and breaks window/focus/screenshot assertions. The e2e launcher
// (tests/e2e/electron-utils.ts) sets FLARE_NO_DEVTOOLS=1; CI forces it off too.
const showDevToolsOnStart =
  isDev && process.env.FLARE_NO_DEVTOOLS !== "1" && process.env.CI !== "true";
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

  if (session && session.testSaveDir && !session.keepSave) {
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
    if (showDevToolsOnStart) mainWindow.webContents.openDevTools();
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

registerMapIpc({
  ipcMain: ipcMainLocal,
  dialog,
  fs,
  path,
  debugLog,
  displaySettings,
  flareAdapter,
  flareTemplate,
  flareActorTemplate,
  flareLaunch,
  flareInstaller,
  SESSION_FILENAME,
  validationRoot,
  validateSerializedFlareData,
  loadFlareDataSchema,
  sanitizeMapNameForFilename,
  deleteMatchingFile,
  rememberProjectRoot,
  isAllowedProjectPath,
  rememberCanonicalMap,
  writeProjectSettings,
  ensureProjectEngineFiles,
  ensureDefaultMenus,
  writeAdapterFile,
  collectProjectText,
  migrateProjectIfNeeded,
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
