/**
 * Find the Flare tilesetdef that describes a tileset PNG. Free of Electron for tests.
 *  1. The PNG's own mod: <mod>/images/tilesets/x.png -> <mod>/tilesetdefs/*.txt
 *  2. Fallback by file name: every mod of the configured engine (<dataPath>/mods/*).
 * A def matches when one of its img= lines points at a file with the same name.
 * A def named after the image (tileset_cave.txt for tileset_cave.png) wins over
 * one that merely also references it (tileset_cave_and_dungeon.txt).
 */
const fs = require("fs");
const path = require("path");

function imgNames(text) {
  const out = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("img=")) out.push(path.basename(line.slice(4).trim().replace(/\\/g, "/")).toLowerCase());
  }
  return out;
}

function findInDefsDir(defsDir, imageName, fsImpl = fs) {
  let entries;
  try {
    entries = fsImpl.readdirSync(defsDir).filter((n) => /\.txt$/i.test(n)).sort();
  } catch {
    return null;
  }
  const want = imageName.toLowerCase();
  const stem = want.replace(/\.png$/i, "");
  entries.sort((a, b) => (a.toLowerCase() === `${stem}.txt` ? -1 : 0) - (b.toLowerCase() === `${stem}.txt` ? -1 : 0));
  for (const name of entries) {
    const full = path.join(defsDir, name);
    let text;
    try {
      text = fsImpl.readFileSync(full, "utf8");
    } catch {
      continue;
    }
    if (imgNames(text).includes(want)) return { path: full, text };
  }
  return null;
}

/** imagePath may be a full path or just a file name; modsDirs = engine mods folders for the fallback. */
function findTilesetDefForImage(imagePath, modsDirs = [], fsImpl = fs) {
  if (typeof imagePath !== "string" || !/\.png$/i.test(imagePath)) return null;
  const imageName = path.basename(imagePath.replace(/\\/g, "/"));
  if (/[\\/]/.test(imagePath)) {
    const dir = path.dirname(path.resolve(imagePath));
    if (path.basename(dir).toLowerCase() === "tilesets" && path.basename(path.dirname(dir)).toLowerCase() === "images") {
      const found = findInDefsDir(path.join(dir, "..", "..", "tilesetdefs"), imageName, fsImpl);
      if (found) return found;
    }
  }
  for (const modsDir of modsDirs) {
    let mods;
    try {
      mods = fsImpl.readdirSync(modsDir).sort();
    } catch {
      continue;
    }
    for (const mod of mods) {
      const found = findInDefsDir(path.join(modsDir, mod, "tilesetdefs"), imageName, fsImpl);
      if (found) return found;
    }
  }
  return null;
}

module.exports = { findTilesetDefForImage, imgNames };
