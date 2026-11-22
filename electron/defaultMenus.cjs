"use strict";

/**
 * Default menu files for a project created in Studio.
 *
 * These are plain Flare menus, copied into the project's own menus/ folder so
 * the Menu editor starts with a full, editable set instead of an empty list.
 * Existing files are never replaced unless the caller asks for it.
 */

const fs = require("fs");
const path = require("path");

const TEMPLATE_DIR = path.join(__dirname, "templates", "menus");

function defaultMenuNames() {
  if (!fs.existsSync(TEMPLATE_DIR)) return [];
  return fs
    .readdirSync(TEMPLATE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".txt"))
    .map((entry) => entry.name)
    .sort();
}

function ensureDefaultMenus(projectPath, options = {}) {
  if (typeof projectPath !== "string" || !projectPath) {
    throw new Error("A project path is required.");
  }
  const overwrite = options.overwrite === true;
  const targetDir = path.join(projectPath, "menus");
  fs.mkdirSync(targetDir, { recursive: true });

  const written = [];
  const skipped = [];
  for (const name of defaultMenuNames()) {
    const target = path.join(targetDir, name);
    if (!overwrite && fs.existsSync(target)) {
      skipped.push(name);
      continue;
    }
    fs.copyFileSync(path.join(TEMPLATE_DIR, name), target);
    written.push(name);
  }
  return { written, skipped };
}

module.exports = { TEMPLATE_DIR, defaultMenuNames, ensureDefaultMenus };
