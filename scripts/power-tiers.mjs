#!/usr/bin/env node
/**
 * Weak / Balanced / Strong bands for power sliders, from real flare-game data.
 *
 * Usage: node scripts/power-tiers.mjs <path-to-flare-game> > src/editor/powers/powerTiers.json
 *
 * Reads every powers/**.txt line in flare-game/mods/* (including powers/base
 * templates), parses the numeric value of each tracked key (durations in seconds,
 * modifier_damage "multiply,N,0" as N%), and writes p33 / p66 (nearest-rank
 * percentiles) plus min / max / sample count. Below p33 is Weak, above p66 is
 * Strong, in between is Balanced.
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const root = process.argv[2];
if (!root) {
  console.error('usage: node scripts/power-tiers.mjs <flare-game>');
  process.exit(1);
}

const seconds = (v) => {
  const m = String(v).trim().match(/^(-?[\d.]+)\s*(ms|s)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return m[2] === 's' ? n : n / 1000;
};
const number = (v) => {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};
const TRACKED = {
  requires_mp: number,
  radius: number,
  target_range: number,
  count: number,
  speed: number,
  cooldown: seconds,
  lifespan: seconds,
  modifier_damage: (v) => {
    const [mode, a] = String(v).split(',');
    return mode === 'multiply' ? number(a) : null;
  },
  post_effect_duration: null,
  post_effect_magnitude: null,
};

const samples = Object.fromEntries(Object.keys(TRACKED).map((k) => [k, []]));
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? walk(p) : p.endsWith('.txt') ? [p] : [];
});
for (const mod of fs.readdirSync(path.join(root, 'mods'))) {
  const dir = path.join(root, 'mods', mod, 'powers');
  if (!fs.existsSync(dir)) continue;
  for (const file of walk(dir)) {
    if (/effects\.txt$|[\\/]trees[\\/]/.test(file)) continue;
    for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
      const line = raw.trim();
      const eq = line.indexOf('=');
      if (eq <= 0 || line.startsWith('#')) continue;
      const key = line.slice(0, eq);
      const value = line.slice(eq + 1);
      if (key === 'post_effect') {
        const [, mag, dur] = value.split(',');
        const d = seconds(dur || '');
        if (d && d > 0) samples.post_effect_duration.push(d);
        const m = number(mag);
        if (m && m > 0 && !String(mag).includes('%')) samples.post_effect_magnitude.push(m);
        continue;
      }
      const parse = TRACKED[key];
      if (!parse) continue;
      const n = parse(value);
      if (n != null && n > 0) samples[key].push(n);
    }
  }
}

const rank = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))];
let commit = '';
try { commit = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim(); } catch { /* not a git checkout */ }
const out = { source: `flare-game${commit ? ` ${commit}` : ''}`, method: 'nearest-rank p33/p66 of positive values in mods/*/powers', keys: {} };
for (const [key, list] of Object.entries(samples)) {
  if (!list.length) continue;
  const sorted = list.slice().sort((a, b) => a - b);
  out.keys[key] = { p33: rank(sorted, 1 / 3), p66: rank(sorted, 2 / 3), min: sorted[0], max: sorted[sorted.length - 1], n: sorted.length };
}
process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
