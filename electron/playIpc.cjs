"use strict";

/**
 * Play IPC: launching the Flare engine, the mod links it needs, install and
 * template helpers. Registered from main.cjs; the channel names are part of
 * the preload API and must stay exactly the same.
 */
module.exports = function registerPlayIpc({
  ipcMain,
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
  getMainWindow,
}) {

// Delete item file — removes the [item] block from the category .txt
// Look for the Flare tileset definition that belongs to a tileset image the
// user just picked. Only .txt files in the usual Flare spots next to the image
// are read, and only when their img= line names that same image.
ipcMain.handle("find-tileset-def", async (_event, imagePath, flarePath) => {
  try {
    const modsDirs = [];
    if (typeof flarePath === "string" && flarePath) {
      const target = flareLaunch.resolveFlareLaunchTarget(flarePath, flarePathProbe());
      if (target && !target.error && target.dataPath) modsDirs.push(path.join(target.dataPath, "mods"));
    }
    return tilesetDefLookup.findTilesetDefForImage(imagePath, modsDirs);
  } catch (error) {
    console.error("Error finding tileset definition:", error);
    return null;
  }
});

// Launch Flare engine with optional arguments
const { spawn: spawnProcess } = require("child_process");

let activeFlareProcess = null;
// Symlinks this process created under path_user/mods. They are left in place
// so the next Play can reuse them; the set records what we added.
const createdJunctions = new Set();

ipcMain.handle("select-flare-exe", async () => {
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
  const result = await dialog.showOpenDialog(getMainWindow(), options);
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

/**
 * Link required mods that Flare cannot see (e.g. fantasycore from a flare-game
 * checkout next to flare-engine) into path_user/mods. Existing entries are kept.
 */
function linkMissingRequiredMods(projectPath, flarePath) {
  const info = readProjectMods(projectPath, flarePath);
  if (info.missingMods.length === 0) return;
  const target = flarePath ? flareLaunch.resolveFlareLaunchTarget(flarePath, flarePathProbe()) : null;
  const dataPath = target && !target.error ? target.dataPath : "";
  const searchDirs = [
    dataPath ? path.join(path.dirname(dataPath), "flare-game", "mods") : "",
    dataPath ? path.join(dataPath, "..", "..", "flare-game", "mods") : "",
    "/usr/local/share/flare/mods",
    "/usr/share/flare/mods",
    "/usr/share/games/flare/mods",
  ].filter(Boolean);
  const userMods = path.join(info.pathUser, "mods");
  fs.mkdirSync(userMods, { recursive: true });
  for (const mod of info.missingMods) {
    const linkPath = path.join(userMods, mod);
    if (fs.existsSync(linkPath)) continue;
    const source = searchDirs.map((dir) => path.resolve(dir, mod)).find((dir) => fs.existsSync(path.join(dir, "settings.txt")));
    if (!source) continue;
    try {
      fs.symlinkSync(source, linkPath, process.platform === "win32" ? "junction" : "dir");
      debugLog(`[FlareEngine] Linked required mod ${mod} -> ${source}`);
    } catch (err) {
      console.warn(`[FlareEngine] Could not link required mod ${mod}:`, err.message);
    }
  }
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

ipcMain.handle("ensure-flare-mod-link", async (_event, { flarePath, projectPath } = {}) => {
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

    linkMissingRequiredMods(projectPath, flarePath);
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

ipcMain.handle("prepare-flare-quick-launch", async (_event, { flarePath, projectPath, mapName, mode } = {}) => {
  let previousMisc = null;
  let miscPath = null;
  let testSaveDir = null;
  try {
    if (!projectPath) return { success: false, error: "Project path is required." };
    cleanupPlaySession(projectPath);

    const engineInfo = ensureProjectEngineFiles(projectPath);
    miscPath = engineInfo.miscPath;
    // A crashed launch can leave the temporary playtest prefix in misc.txt.
    let stablePrefix = flareLaunch.stableSavePrefix(engineInfo.savePrefix);
    if (stablePrefix !== engineInfo.savePrefix) {
      const healed = flareLaunch.upsertKey(fs.readFileSync(miscPath, "utf8"), "save_prefix", stablePrefix);
      fs.writeFileSync(miscPath, healed, "utf8");
    }
    linkMissingRequiredMods(projectPath, flarePath);
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
    const useStudioTest = mode !== "new-game";
    const testPrefix = useStudioTest
      ? flareLaunch.studioTestPrefix(stablePrefix)
      : flareLaunch.playtestPrefix(stablePrefix);
    previousMisc = fs.readFileSync(miscPath, "utf8");
    const playMisc = flareLaunch.upsertKey(previousMisc, "save_prefix", testPrefix, { appendIfEmpty: true });
    fs.writeFileSync(miscPath, playMisc, "utf8");

    const pathUser = currentPathUser();
    testSaveDir = path.join(pathUser, "saves", testPrefix);
    if (!useStudioTest) {
      fs.rmSync(testSaveDir, { recursive: true, force: true });
    }
    const slotDir = path.join(testSaveDir, "1");
    fs.mkdirSync(slotDir, { recursive: true });
    const existingAvatar = useStudioTest ? readOptionalText(path.join(slotDir, "avatar.txt")) : "";
    const previousAvatar = flareLaunch.parseAvatarText(existingAvatar);
    const avatar = flareLaunch.buildAvatarText({
      name: previousAvatar.name || "StudioTest",
      className: className || previousAvatar.class,
      mapPath: target.relativePath.replace(/\\/g, "/"),
      x,
      y,
      xp: previousAvatar.xp,
      campaign: previousAvatar.campaign,
      carried: previousAvatar.carried,
      equipped: previousAvatar.equipped,
      equippedQuantity: previousAvatar.equipped_quantity,
      carriedQuantity: previousAvatar.carried_quantity,
      currency: previousAvatar.currency,
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
      JSON.stringify({ previousMisc, testSaveDir, testPrefix, loadSlot, keepSave: useStudioTest }, null, 2),
      "utf8"
    );

    debugLog(`[FlareEngine] Quick launch ${target.relativePath} at ${x},${y} via --load-slot=${loadSlot} (${testPrefix})`);
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

ipcMain.handle("restore-spawn-backup", async (_event, { projectPath } = {}) => {
  try {
    if (!projectPath) return false;
    cleanupPlaySession(projectPath);
    return true;
  } catch (err) {
    console.error("[FlareEngine] restore-spawn-backup error:", err);
    return false;
  }
});

ipcMain.handle("write-flare-test-save", async (_event, options = {}) => {
  try {
    const projectPath = options.projectPath;
    if (!projectPath) return { success: false, error: "Project path is required." };
    const miscPath = path.join(projectPath, "engine", "misc.txt");
    const misc = fs.existsSync(miscPath) ? fs.readFileSync(miscPath, "utf8") : "";
    const listed = flareLaunch.readKey(misc, "save_prefix");
    const stablePrefix = listed || flareLaunch.slugSavePrefix(path.basename(String(projectPath).replace(/[\\/]+$/, "")));
    const testPrefix = flareLaunch.studioTestPrefix(stablePrefix);
    const pathUser = currentPathUser();
    const testSaveDir = path.join(pathUser, "saves", testPrefix);
    const slotDir = path.join(testSaveDir, "1");
    fs.mkdirSync(slotDir, { recursive: true });
    const className = options.className || flareLaunch.firstHeroClassName(readOptionalText(path.join(projectPath, "engine", "classes.txt")));
    const avatar = flareLaunch.buildAvatarText({
      name: options.name || "StudioTest",
      className,
      mapPath: options.mapPath,
      x: options.x,
      y: options.y,
      xp: options.xp,
      campaign: options.campaign,
      carried: options.carried,
      equipped: options.equipped,
      currency: options.currency,
    });
    const avatarPath = path.join(slotDir, "avatar.txt");
    fs.writeFileSync(avatarPath, avatar, "utf8");
    return { success: true, avatarPath, testSaveDir, testPrefix, loadSlot: "1" };
  } catch (err) {
    console.error("[FlareEngine] write-flare-test-save error:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("launch-flare-engine", async (_event, options = {}) => {
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
    debugLog("[FlareEngine] Launching:", target.exePath, args.join(" "), "cwd:", target.cwd);
    const child = spawnProcess(target.exePath, args, {
      cwd: target.cwd,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const logChunk = (prefix, chunk) => {
      const text = chunk.toString().trim();
      if (text) debugLog(`[FlareEngine] ${prefix} ${text}`);
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
      if (getMainWindow() && !getMainWindow().isDestroyed()) {
        getMainWindow().webContents.send("flare-engine-exited", payload);
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

// One-click Flare install (engine + content) from the Welcome screen.
const flareInstallControllers = new Map();
ipcMain.handle("install-flare", async (event, variant) => {
  const sender = event.sender;
  const controller = new AbortController();
  flareInstallControllers.set(variant, controller);
  return flareInstaller.installFlare(variant, {
    signal: controller.signal,
    log: (message) => debugLog(message),
    onProgress: ({ received, total }) => {
      if (!sender.isDestroyed()) sender.send("install-flare-progress", { variant, received, total });
    },
  }).finally(() => {
    if (flareInstallControllers.get(variant) === controller) flareInstallControllers.delete(variant);
  });
});

ipcMain.handle("cancel-install-flare", async (_event, variant) => {
  const controller = flareInstallControllers.get(variant);
  if (!controller) return false;
  controller.abort();
  return true;
});

// "Start with template": NPC looks and enemy definitions in the installed Flare's fantasycore (read-only).
ipcMain.handle("list-template-actors", async (_event, flarePath) => {
  try {
    return flareActorTemplate.listTemplateActors(typeof flarePath === "string" ? flarePath : "");
  } catch (err) {
    return { ok: false, error: err.message, npcLooks: [], portraits: [], enemyLooks: [], npcs: [], enemies: [], missing: [] };
  }
});

// "Start with template": PNGs in the installed Flare's fantasycore/images/tilesets.
ipcMain.handle("list-template-tilesets", async (_event, flarePath) => {
  try {
    return flareTemplate.listTemplateTilesets(typeof flarePath === "string" ? flarePath : "");
  } catch (err) {
    return { ok: false, error: err.message, files: [] };
  }
});

ipcMain.handle("open-external", async (_event, url) => {
  if (typeof url !== "string" || !/^https:\/\//i.test(url)) return false;
  await shell.openExternal(url);
  return true;
});

ipcMain.handle("is-flare-running", async () => {
  if (!activeFlareProcess) return false;
  try {
    process.kill(activeFlareProcess.pid, 0);
    return true;
  } catch {
    activeFlareProcess = null;
    return false;
  }
});
};
