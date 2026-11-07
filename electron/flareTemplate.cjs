/**
 * "Start with template": the tilesets that ship in the installed Flare's
 * fantasycore mod. Free of Electron so tests and node scripts can use it.
 */

const fs = require("fs");
const path = require("path");
const flareLaunch = require("./flareLaunch.cjs");

const TEMPLATE_MOD = "fantasycore";
const TEMPLATE_TILESET_SUBDIR = ["images", "tilesets"];

function defaultProbe() {
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
 * Resolve the saved Flare path to <dataPath>/mods/fantasycore/images/tilesets.
 * Returns { dataPath, dir } or { error }.
 */
function templateTilesetDir(flarePath, probe = defaultProbe()) {
  if (!flarePath) return { error: "Install Flare Modern or Flare Classic on the Welcome screen first." };
  const target = flareLaunch.resolveFlareLaunchTarget(flarePath, probe);
  if (!target || target.error) return { error: target ? target.error : "Flare path could not be resolved." };
  const modDir = path.join(target.dataPath, "mods", TEMPLATE_MOD);
  if (!probe.exists(path.join(modDir, "settings.txt")) && !probe.exists(modDir)) {
    return { error: `No ${TEMPLATE_MOD} mod in ${target.dataPath}.` };
  }
  const dir = path.join(modDir, ...TEMPLATE_TILESET_SUBDIR);
  if (!probe.isDirectory(dir)) return { error: `No tilesets folder in ${modDir}.` };
  return { dataPath: target.dataPath, dir };
}

/**
 * List the PNG files directly inside the template tilesets folder.
 * Only regular files whose real path stays inside that folder are returned.
 */
function listTemplateTilesets(flarePath, { probe = defaultProbe(), fsImpl = fs } = {}) {
  const resolved = templateTilesetDir(flarePath, probe);
  if (resolved.error) return { ok: false, error: resolved.error, files: [] };
  let realDir;
  try {
    realDir = fsImpl.realpathSync(resolved.dir);
  } catch (err) {
    return { ok: false, error: err.message, files: [] };
  }
  const files = [];
  for (const entry of fsImpl.readdirSync(resolved.dir, { withFileTypes: true })) {
    if (!/\.png$/i.test(entry.name)) continue;
    const full = path.join(resolved.dir, entry.name);
    try {
      const real = fsImpl.realpathSync(full);
      if (path.dirname(real) !== realDir) continue;
      if (!fsImpl.statSync(real).isFile()) continue;
    } catch {
      continue;
    }
    files.push({ name: entry.name, path: full });
  }
  files.sort((a, b) => a.name.localeCompare(b.name));
  return { ok: files.length > 0, error: files.length > 0 ? undefined : "No tileset PNGs found.", dataPath: resolved.dataPath, dir: resolved.dir, files };
}

module.exports = {
  TEMPLATE_MOD,
  templateTilesetDir,
  listTemplateTilesets,
};
