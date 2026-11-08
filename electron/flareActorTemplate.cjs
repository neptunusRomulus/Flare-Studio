/**
 * "Start with template": NPC looks and enemy definitions shipped in the
 * installed Flare's fantasycore mod. Read-only; free of Electron for tests.
 */
const fs = require("fs");
const path = require("path");
const flareTemplate = require("./flareTemplate.cjs");

const REF_EXT = /\.(txt|png|ogg|wav|jpg|jpeg)$/i;

/** Mod-relative file references in a Flare text file (INCLUDE lines and key=value parts with a file extension). */
function collectFlareRefs(text) {
  const refs = new Set();
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("[")) continue;
    if (line.startsWith("INCLUDE ")) { refs.add(line.slice(8).trim()); continue; }
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    for (const part of line.slice(eq + 1).split(",")) {
      const v = part.trim();
      if (v && REF_EXT.test(v) && !/^[a-z]+:/i.test(v) && !path.isAbsolute(v)) refs.add(v.replace(/\\/g, "/"));
    }
  }
  return [...refs];
}

/** First value of a key (e.g. "image", "animations") in a Flare text file. */
function firstValue(text, key) {
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith(`${key}=`)) return line.slice(key.length + 1).trim();
  }
  return null;
}

function listTxt(dir, fsImpl) {
  try {
    return fsImpl.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && /\.txt$/i.test(e.name))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

function listPng(dir, fsImpl) {
  try {
    return fsImpl.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && /\.png$/i.test(e.name))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

/**
 * NPC looks (animations/npcs/*.txt), NPC definitions (npcs/*.txt, raw) and enemy
 * definitions (enemies/*.txt and enemies/base/*.txt, raw) of the template mod.
 * Every referenced file is checked against the mod folder; misses are reported.
 */
function listTemplateActors(flarePath, { probe, fsImpl = fs } = {}) {
  const resolved = flareTemplate.templateTilesetDir(flarePath, probe);
  if (resolved.error) return { ok: false, error: resolved.error, npcLooks: [], portraits: [], npcs: [], enemies: [], missing: [] };
  const modDir = path.join(resolved.dataPath, "mods", flareTemplate.TEMPLATE_MOD);
  const read = (rel) => { try { return fsImpl.readFileSync(path.join(modDir, rel), "utf8"); } catch { return null; } };
  const missing = new Set();
  const check = (from, text) => {
    for (const ref of collectFlareRefs(text)) if (!fsImpl.existsSync(path.join(modDir, ref))) missing.add(`${from} -> ${ref}`);
  };

  const npcLooks = [];
  for (const name of listTxt(path.join(modDir, "animations", "npcs"), fsImpl)) {
    const rel = `animations/npcs/${name}`;
    const text = read(rel);
    if (text == null) continue;
    check(rel, text);
    const image = firstValue(text, "image");
    npcLooks.push({ key: name.replace(/\.txt$/i, ""), animation: rel, image, imagePath: image ? path.join(modDir, image) : null });
  }

  const portraits = [];
  for (const name of listPng(path.join(modDir, "images", "portraits"), fsImpl)) {
    const rel = `images/portraits/${name}`;
    portraits.push({ key: name.replace(/\.png$/i, ""), path: rel, imagePath: path.join(modDir, rel) });
  }

  const npcs = [];
  for (const name of listTxt(path.join(modDir, "npcs"), fsImpl)) {
    const rel = `npcs/${name}`;
    const text = read(rel);
    if (text == null) continue;
    check(rel, text);
    npcs.push({ key: name.replace(/\.txt$/i, ""), file: rel, raw: text });
  }

  const enemies = [];
  for (const [sub, isBase] of [["enemies", false], [path.join("enemies", "base"), true]]) {
    for (const name of listTxt(path.join(modDir, sub), fsImpl)) {
      const rel = `${sub.replace(/\\/g, "/")}/${name}`;
      const text = read(rel);
      if (text == null) continue;
      check(rel, text);
      enemies.push({ key: name.replace(/\.txt$/i, ""), file: rel, raw: text, isBase });
    }
  }
  return { ok: true, mod: flareTemplate.TEMPLATE_MOD, modDir, npcLooks, portraits, npcs, enemies, missing: [...missing].sort() };
}

module.exports = { collectFlareRefs, firstValue, listTemplateActors };
