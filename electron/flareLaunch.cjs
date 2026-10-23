/**
 * Pure helpers for launching Flare from Flare Studio.
 *
 * Ground truth is flare-engine (v1.14 line, EngineSettings save_prefix,
 * GameStateLoad --load-slot, ModManager settings.txt, Platform* path_user).
 * These functions stay free of Electron so unit tests can import them.
 */

const fs = require("fs");
const path = require("path");
const { slugFileName, legacyMapFileName } = require("../src/adapters/flare/slug.cjs");

const DEFAULT_MOD_VERSION = "1.0";
const DEFAULT_GAME = "flare-game";
const DEFAULT_ENGINE_MIN = "1.13.01";

/** ASCII slug. Play also tries the pre-slug filename so older maps still open. */
function sanitizeMapFileName(input) {
  return slugFileName(input);
}

/**
 * Flare's Parse::toInt: stringstream >> int, default 0.
 * Leading whitespace is skipped; the first integer is consumed.
 */
function toIntFlare(value) {
  const match = String(value).match(/^\s*([+-]?\d+)/);
  if (!match) return 0;
  const parsed = parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Slot directories GameStateLoad::readGameSlots keeps, in the order
 * compareSaveDirs sorts them (numeric, not lexicographic). Names whose
 * integer value is < 1 are dropped, matching the engine.
 */
function loadSlotNames(names) {
  return (names || [])
    .map((name) => String(name))
    .filter((name) => toIntFlare(name) >= 1)
    .sort((a, b) => {
      const delta = toIntFlare(a) - toIntFlare(b);
      if (delta !== 0) return delta;
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });
}

/**
 * --load-slot is a 1-based index into that sorted list, not the folder name.
 * GameStateLoad.cpp uses Parse::toInt(load_slot) - 1 as the vector index.
 */
function loadSlotIndex(names, target) {
  const sorted = loadSlotNames(names);
  const index = sorted.indexOf(String(target));
  if (index < 0) return null;
  return index + 1;
}

function buildFlareArgs({ dataPath, mods, loadSlot, loadScript } = {}) {
  const args = [];
  if (dataPath) args.push(`--data-path=${dataPath}`);
  if (Array.isArray(mods) && mods.length > 0) {
    args.push(`--mods=${mods.join(",")}`);
  }
  if (loadSlot !== undefined && loadSlot !== null && String(loadSlot) !== "") {
    args.push(`--load-slot=${String(loadSlot)}`);
  }
  if (loadScript) args.push(`--load-script=${loadScript}`);
  return args;
}

function parseSettingsMap(text) {
  const map = {};
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    map[key] = line.slice(eq + 1).trim();
  }
  return map;
}

/**
 * requires=mod[:min[:max]],mod2
 * The engine splits on comma or semicolon, then on ':'.
 * "default" is omitted; the engine always loads it first.
 */
function parseRequires(settingsText) {
  const mods = [];
  for (const raw of String(settingsText || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    if (line.slice(0, eq).trim() !== "requires") continue;
    for (const part of line.slice(eq + 1).split(/[,;]/)) {
      const name = part.trim().split(":")[0].trim();
      if (!name || name === "default" || mods.includes(name)) continue;
      mods.push(name);
    }
  }
  return mods;
}

function buildModList(requires, projectModName) {
  const mods = [];
  const source = Array.isArray(requires) ? requires : parseRequires(String(requires || ""));
  for (const entry of source) {
    const name = String(entry).split(":")[0].trim();
    if (!name || name === "default" || name === projectModName || mods.includes(name)) continue;
    mods.push(name);
  }
  if (projectModName && projectModName !== "default" && !mods.includes(projectModName)) {
    mods.push(projectModName);
  }
  return mods;
}

function renderSettings({
  description,
  version = DEFAULT_MOD_VERSION,
  game = DEFAULT_GAME,
  requires = [],
  engineVersionMin = DEFAULT_ENGINE_MIN,
} = {}) {
  const lines = [];
  if (description) lines.push(`description=${description}`);
  if (version) lines.push(`version=${version}`);
  if (game) lines.push(`game=${game}`);
  if (requires && requires.length > 0) lines.push(`requires=${requires.join(",")}`);
  if (engineVersionMin) lines.push(`engine_version_min=${engineVersionMin}`);
  return `${lines.join("\n")}\n`;
}

/**
 * Build settings.txt from the project name. Never substitute the map name.
 * An existing file is left untouched except for keys that are absent.
 */
function planSettingsWrite(existingText, projectName) {
  const description = String(projectName || "Project").trim() || "Project";
  if (existingText == null || !String(existingText).trim()) {
    return {
      write: true,
      content: renderSettings({ description }),
    };
  }
  const existing = String(existingText);
  const map = parseSettingsMap(existing);
  const additions = [];
  if (!Object.prototype.hasOwnProperty.call(map, "description")) {
    additions.push(`description=${description}`);
  }
  if (!map.version) additions.push(`version=${DEFAULT_MOD_VERSION}`);
  if (!map.game) additions.push(`game=${DEFAULT_GAME}`);
  if (!map.engine_version_min) additions.push(`engine_version_min=${DEFAULT_ENGINE_MIN}`);
  if (additions.length === 0) return { write: false, content: existing };
  const separator = existing.endsWith("\n") ? "" : "\n";
  return { write: true, content: `${existing}${separator}${additions.join("\n")}\n` };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readKey(content, key) {
  const re = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=(.*)$`, "m");
  const match = String(content || "").match(re);
  return match ? match[1].trim() : "";
}

/**
 * Set key=value. A brand-new file starts with APPEND so it layers on
 * default/fantasycore instead of replacing those files (FileParser.cpp).
 * An existing file keeps its other lines; the key is updated in place.
 */
function upsertKey(content, key, value, { appendIfEmpty = true } = {}) {
  const text = content == null ? "" : String(content);
  const re = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=.*$`, "m");
  if (re.test(text)) {
    return text.replace(re, `${key}=${value}`);
  }
  if (!text.trim()) {
    return appendIfEmpty ? `APPEND\n${key}=${value}\n` : `${key}=${value}\n`;
  }
  const base = text.endsWith("\n") ? text : `${text}\n`;
  return `${base}${key}=${value}\n`;
}

function slugSavePrefix(projectName) {
  const slug = String(projectName || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return `studio_${slug || "project"}`;
}

function playtestPrefix(stablePrefix) {
  const base = stablePrefix || "studio_project";
  if (base.endsWith("_playtest")) return base;
  return `${base}_playtest`;
}

/** Keep an existing save_prefix. Only fill it in when the key is missing. */
function ensureSavePrefix(content, prefix) {
  const current = readKey(content, "save_prefix");
  if (current) return { content: content == null ? "" : String(content), changed: false, prefix: current };
  const next = upsertKey(content, "save_prefix", prefix, { appendIfEmpty: true });
  return { content: next, changed: true, prefix };
}

/**
 * String-only guess used by the renderer. The main process re-checks the
 * filesystem, because a saved legacy value may be a directory.
 * A path whose last segment contains a dot, or is exactly "flare", is a file.
 */
function dataPathFromFlareSelection(flarePath) {
  const normalized = String(flarePath || "").replace(/\\/g, "/").replace(/\/+$/, "");
  if (!normalized) return "";
  const base = normalized.split("/").pop() || "";
  const looksLikeFile = base.includes(".") || base === "flare";
  if (!looksLikeFile) return normalized;
  const slash = normalized.lastIndexOf("/");
  if (slash <= 0) return normalized;
  return normalized.slice(0, slash);
}

/**
 * path_user from PlatformWin32.cpp / PlatformLinux.cpp.
 * platform is explicit so tests do not depend on the host OS.
 */
function resolvePathUser(platform, env = {}, cwd = ".") {
  if (platform === "win32") {
    if (env.APPDATA) return path.win32.join(env.APPDATA, "flare", "userdata");
    return path.win32.resolve(cwd || ".", "userdata");
  }
  if (env.XDG_DATA_HOME) return path.posix.join(env.XDG_DATA_HOME, "flare");
  if (env.HOME) return path.posix.join(env.HOME, ".local", "share", "flare");
  return path.posix.resolve(cwd || ".", "userdata");
}

function resolveFlareLaunchTarget(flarePath, { platform, exists, isDirectory }) {
  if (!flarePath) {
    return { error: "Flare executable path is not set." };
  }
  if (!exists(flarePath)) {
    return { error: `Flare executable not found: ${flarePath}` };
  }
  if (!isDirectory(flarePath)) {
    const directory = path.dirname(flarePath);
    return {
      exePath: flarePath,
      dataPath: directory,
      cwd: directory,
      // --data-path replaces the engine's own search. Pass it only when this
      // directory actually contains mods/, otherwise cwd + the engine fallback
      // (XDG, /usr/share/flare, the exe directory) can still find the data.
      passDataPath: exists(path.join(directory, "mods")),
    };
  }
  const names = platform === "win32" ? ["flare.exe", "Flare.exe"] : ["flare", "flare.exe"];
  for (const name of names) {
    const candidate = path.join(flarePath, name);
    if (exists(candidate) && !isDirectory(candidate)) {
      return {
        exePath: candidate,
        dataPath: flarePath,
        cwd: flarePath,
        passDataPath: exists(path.join(flarePath, "mods")),
      };
    }
  }
  return {
    error: "That path is a folder. Select the Flare executable (flare on Linux, flare.exe on Windows).",
  };
}

/**
 * Directories the engine will list mods from.
 *
 * --data-path (custom_path_data) replaces path_data, so only that directory
 * and path_user are searched (ModManager::setPaths + the constructor's
 * getDirList calls). Without it, PlatformLinux walks XDG_DATA_DIRS, then
 * /usr/local/share/flare, /usr/share/flare and the games/ variants, and stops
 * at the first directory that exists. DATA_INSTALL_DIR is a compile-time
 * prefix we cannot see. Windows with no --data-path uses cwd ("mods") plus
 * path_user. An empty list means we could not see a mods directory, so the
 * caller must not block the launch.
 */
function engineModRoots({
  pathUser,
  dataPath,
  cwd,
  passDataPath,
  platform = "linux",
  env = {},
  exists,
} = {}) {
  const p = platform === "win32" ? path.win32 : path.posix;
  const roots = [];
  const pushMods = (dir) => {
    if (!dir) return;
    const modsDir = p.join(dir, "mods");
    if (!roots.includes(modsDir)) roots.push(modsDir);
  };

  const custom = passDataPath === undefined ? Boolean(dataPath && exists(p.join(dataPath, "mods"))) : passDataPath;
  if (custom) {
    pushMods(dataPath);
    pushMods(pathUser);
  } else if (platform === "win32") {
    pushMods(cwd || dataPath);
    pushMods(pathUser);
  } else {
    const candidates = [];
    if (env.XDG_DATA_DIRS) {
      for (const dir of String(env.XDG_DATA_DIRS).split(":")) {
        if (dir) candidates.push(p.join(dir, "flare"));
      }
    }
    for (const dir of [
      "/usr/local/share/flare",
      "/usr/share/flare",
      "/usr/local/share/games/flare",
      "/usr/share/games/flare",
    ]) {
      if (!candidates.includes(dir)) candidates.push(dir);
    }
    // First existing data root wins, same as PlatformLinux::setPaths.
    const dataRoot = candidates.find((dir) => exists(dir)) || "";
    if (dataRoot) pushMods(dataRoot);
    else pushMods(cwd || dataPath);
    pushMods(pathUser);
  }

  return roots.filter((root) => exists(root));
}

function findMissingMods(mods, options) {
  const { projectModName, exists } = options || {};
  const roots = engineModRoots(options);
  if (roots.length === 0) return [];
  const p = options.platform === "win32" ? path.win32 : path.posix;
  const missing = [];
  for (const name of mods || []) {
    if (!name || name === projectModName) continue;
    if (!roots.some((root) => exists(p.join(root, name)))) missing.push(name);
  }
  return missing;
}

function candidateMapRelatives(mapName) {
  const raw = String(mapName || "").trim().replace(/\\/g, "/");
  if (!raw) return [];
  const out = [];
  const push = (value) => {
    const norm = value.replace(/\/+/g, "/").replace(/^\.\//, "");
    if (norm && !out.includes(norm)) out.push(norm);
  };
  if (raw.includes("/")) {
    push(raw.toLowerCase().endsWith(".txt") ? raw : `${raw}.txt`);
  }
  const leaf = raw.split("/").pop() || raw;
  const withoutExt = leaf.replace(/\.txt$/i, "");
  push(`maps/${sanitizeMapFileName(withoutExt)}.txt`);
  const legacy = legacyMapFileName(withoutExt);
  if (legacy && legacy !== sanitizeMapFileName(withoutExt)) {
    push(`maps/${legacy}.txt`);
  }
  return out;
}

function parseHeroPos(mapText) {
  const match = String(mapText || "").match(/^hero_pos\s*=\s*(-?\d+)\s*,\s*(-?\d+)/m);
  if (!match) return null;
  return { x: parseInt(match[1], 10), y: parseInt(match[2], 10) };
}

function parseIntermap(spawnText) {
  const match = String(spawnText || "").match(/^intermap\s*=\s*([^,\s]+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)/m);
  if (!match) return null;
  return {
    map: match[1].trim().replace(/\\/g, "/"),
    x: parseInt(match[2], 10),
    y: parseInt(match[3], 10),
  };
}

function firstHeroClassName(classesText) {
  let inClass = false;
  for (const raw of String(classesText || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("[")) {
      inClass = line.toLowerCase() === "[class]";
      continue;
    }
    if (inClass && line.toLowerCase().startsWith("name=")) {
      return line.slice(line.indexOf("=") + 1).trim();
    }
  }
  return "";
}

function buildAvatarText({ name = "StudioTest", className, mapPath, x, y }) {
  const lines = [
    "## flare-engine save file ##",
    "# flare-studio-quick-launch",
    `name=${name}`,
    "permadeath=0",
    "xp=0",
  ];
  if (className) lines.push(`class=${className}`);
  const map = String(mapPath || "").replace(/\\/g, "/");
  lines.push(`spawn=${map},${Number(x) || 0},${Number(y) || 0}`);
  lines.push("");
  return lines.join("\n");
}

function isPathInside(parent, target) {
  if (!parent || !target) return false;
  const relative = path.relative(path.resolve(parent), path.resolve(target));
  return relative === "" || (relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative));
}

/**
 * Point path_user/mods/<project> at the project. A real directory is never deleted.
 */
function linkProjectMod(projectPath, pathUser) {
  const modName = path.basename(String(projectPath || "").replace(/[\\/]+$/, ""));
  if (!modName || !projectPath || !pathUser) {
    return { success: false, error: "Project path is required to link a Flare mod." };
  }
  const modsDir = path.join(pathUser, "mods");
  const linkPath = path.join(modsDir, modName);
  const resolvedProject = path.resolve(projectPath);
  fs.mkdirSync(modsDir, { recursive: true });

  if (isPathInside(modsDir, resolvedProject)) {
    return { success: true, modName, junctionCreated: false, linkPath: resolvedProject };
  }

  let stat = null;
  try {
    stat = fs.lstatSync(linkPath);
  } catch {
    stat = null;
  }
  if (stat) {
    if (stat.isSymbolicLink()) {
      let target = null;
      try {
        target = fs.realpathSync(linkPath);
      } catch {
        target = null;
      }
      if (target && path.resolve(target) === resolvedProject) {
        return { success: true, modName, junctionCreated: false, linkPath };
      }
      fs.unlinkSync(linkPath);
    } else {
      return {
        success: false,
        error: `Cannot link the project. ${linkPath} already exists and is not a symlink. Move that folder aside or rename the project.`,
      };
    }
  }

  try {
    if (process.platform === "win32") {
      fs.symlinkSync(resolvedProject, linkPath, "junction");
    } else {
      fs.symlinkSync(resolvedProject, linkPath, "dir");
    }
  } catch (err) {
    return { success: false, error: `Failed to link the project into ${linkPath}: ${err.message}` };
  }
  return { success: true, modName, junctionCreated: true, linkPath };
}

module.exports = {
  DEFAULT_GAME,
  DEFAULT_MOD_VERSION,
  DEFAULT_ENGINE_MIN,
  sanitizeMapFileName,
  toIntFlare,
  loadSlotNames,
  loadSlotIndex,
  buildFlareArgs,
  parseSettingsMap,
  parseRequires,
  buildModList,
  renderSettings,
  planSettingsWrite,
  readKey,
  upsertKey,
  slugSavePrefix,
  playtestPrefix,
  ensureSavePrefix,
  dataPathFromFlareSelection,
  resolvePathUser,
  resolveFlareLaunchTarget,
  engineModRoots,
  findMissingMods,
  candidateMapRelatives,
  parseHeroPos,
  parseIntermap,
  firstHeroClassName,
  buildAvatarText,
  isPathInside,
  linkProjectMod,
};
