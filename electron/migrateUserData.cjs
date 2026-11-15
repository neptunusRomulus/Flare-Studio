/**
 * One-time copy of Electron userData from the legacy app name (ism-tile)
 * into the current name (flare-studio). Copy only — the old folder is kept.
 */
const fs = require("fs");
const path = require("path");

const MARKER_NAME = ".migrated-from-ism-tile";
const LEGACY_APP_DIR_NAME = "ism-tile";

function isMissingOrEmptyDir(dir) {
  if (!fs.existsSync(dir)) return true;
  try {
    if (!fs.statSync(dir).isDirectory()) return false;
    return fs.readdirSync(dir).length === 0;
  } catch (error) {
    console.warn("[userData] Could not read", dir, error);
    return false;
  }
}

function copyTree(src, dest, errors) {
  let entries;
  try {
    entries = fs.readdirSync(src, { withFileTypes: true });
  } catch (error) {
    errors.push({ path: src, error });
    console.warn("[userData] Could not list", src, error);
    return;
  }
  try {
    fs.mkdirSync(dest, { recursive: true });
  } catch (error) {
    errors.push({ path: dest, error });
    console.warn("[userData] Could not create", dest, error);
    return;
  }
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    try {
      const stat = fs.lstatSync(from);
      if (stat.isDirectory()) {
        copyTree(from, to, errors);
      } else {
        fs.copyFileSync(from, to);
      }
    } catch (error) {
      errors.push({ path: from, error });
      console.warn("[userData] Skipped", from, error);
    }
  }
}

/**
 * @param {{ newDir: string, oldDir: string, markerName?: string }} opts
 * @returns {{ migrated: boolean, skipped?: string, errors: Array<{ path: string, error: unknown }> }}
 */
function migrateUserData(opts) {
  const newDir = opts.newDir;
  const oldDir = opts.oldDir;
  const markerName = opts.markerName || MARKER_NAME;
  const markerPath = path.join(newDir, markerName);
  const errors = [];

  if (fs.existsSync(markerPath)) {
    return { migrated: false, skipped: "already-migrated", errors };
  }
  if (!isMissingOrEmptyDir(newDir)) {
    return { migrated: false, skipped: "new-data-present", errors };
  }
  if (!fs.existsSync(oldDir) || !fs.statSync(oldDir).isDirectory()) {
    return { migrated: false, skipped: "no-old-data", errors };
  }

  copyTree(oldDir, newDir, errors);

  try {
    fs.mkdirSync(newDir, { recursive: true });
    fs.writeFileSync(markerPath, `migrated-from ${oldDir}\n`, "utf8");
  } catch (error) {
    errors.push({ path: markerPath, error });
    console.warn("[userData] Could not write migration marker", error);
  }

  return { migrated: true, errors };
}

/**
 * Run with Electron path helpers. Safe to call before app ready.
 * @param {{ getPath: (name: string) => string }} app
 */
function migrateUserDataFromLegacyName(app) {
  const newDir = app.getPath("userData");
  const oldDir = path.join(app.getPath("appData"), LEGACY_APP_DIR_NAME);
  return migrateUserData({ newDir, oldDir });
}

module.exports = {
  MARKER_NAME,
  LEGACY_APP_DIR_NAME,
  isMissingOrEmptyDir,
  migrateUserData,
  migrateUserDataFromLegacyName,
};
