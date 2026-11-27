const fs = require('fs');
const os = require('os');
const path = require('path');

/** Directories or files that only a Flare Studio project root has. */
const PROJECT_MARKERS = [
  'project.json',
  'settings.txt',
  'maps',
  'items',
  'animations',
  'powers',
  'enemies',
  'tilesets',
];

/**
 * A root the renderer asked us to trust must look like a project.
 *
 * Without this, a single IPC call with "/" or "$HOME" widened the whole file
 * allowlist (rememberProjectRoot), and every guarded handler afterwards wrote
 * anywhere. Returns false for filesystem roots, the home directory, and any
 * directory without a project marker.
 */
function isPlausibleProjectRoot(candidate, io = {}) {
  const ioFs = io.fs || fs;
  const ioOs = io.os || os;
  if (typeof candidate !== 'string' || !candidate.trim()) return false;

  let resolved;
  try {
    resolved = ioFs.realpathSync(candidate);
  } catch {
    return false;
  }

  let stats;
  try {
    stats = ioFs.statSync(resolved);
  } catch {
    return false;
  }
  if (!stats.isDirectory()) return false;

  if (resolved === path.parse(resolved).root) return false;
  try {
    if (resolved === ioFs.realpathSync(ioOs.homedir())) return false;
  } catch {
    /* no home directory: nothing to compare against */
  }

  let entries;
  try {
    entries = ioFs.readdirSync(resolved);
  } catch {
    return false;
  }
  const names = new Set(entries.map((entry) => String(entry).toLowerCase()));
  if (PROJECT_MARKERS.some((marker) => names.has(marker))) return true;
  // A Studio project always carries its map json at the root.
  return entries.some((entry) => String(entry).toLowerCase().endsWith('.json'));
}

/**
 * A folder a new project may be created in: it exists, it is a directory, and
 * it is neither the filesystem root nor the home directory.
 */
function isUsableProjectLocation(candidate, io = {}) {
  const ioFs = io.fs || fs;
  const ioOs = io.os || os;
  if (typeof candidate !== 'string' || !candidate.trim()) return false;
  let resolved;
  try {
    resolved = ioFs.realpathSync(candidate);
    if (!ioFs.statSync(resolved).isDirectory()) return false;
    if (resolved === path.parse(resolved).root) return false;
    if (resolved === ioFs.realpathSync(ioOs.homedir())) return false;
  } catch {
    return false;
  }
  return true;
}

module.exports = { isPlausibleProjectRoot, isUsableProjectLocation, PROJECT_MARKERS };
