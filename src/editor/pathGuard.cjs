const fs = require('fs');
const path = require('path');

/**
 * True when target is the root directory or a path inside it.
 * Comparison uses path.resolve so ".." segments cannot escape.
 * A sibling whose name only starts with the root name is rejected.
 */
function isInsideRoot(root, target) {
  if (typeof root !== 'string' || typeof target !== 'string') return false;
  if (!root || !target) return false;

  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const rootCmp = process.platform === 'win32' ? resolvedRoot.toLowerCase() : resolvedRoot;
  const targetCmp = process.platform === 'win32' ? resolvedTarget.toLowerCase() : resolvedTarget;
  const separator = process.platform === 'win32' ? '\\' : path.sep;
  const rootPrefix = rootCmp.endsWith(separator) ? rootCmp : rootCmp + separator;
  return targetCmp === rootCmp || targetCmp.startsWith(rootPrefix);
}

/**
 * Resolve symlinks for the deepest part of target that exists, then re-attach
 * the segments that do not exist yet (a file about to be written).
 */
function realPathOfNearest(target) {
  let current = path.resolve(target);
  const rest = [];
  for (;;) {
    try {
      return path.join(fs.realpathSync.native ? fs.realpathSync.native(current) : fs.realpathSync(current), ...rest);
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(target);
      rest.unshift(path.basename(current));
      current = parent;
    }
  }
}

/**
 * Like isInsideRoot, but a symlink inside the root cannot point outside it.
 * Use this before touching the disk; isInsideRoot stays the cheap lexical gate.
 */
function isInsideRootReal(root, target) {
  if (!isInsideRoot(root, target)) return false;
  const realRoot = realPathOfNearest(root);
  const realTarget = realPathOfNearest(target);
  return isInsideRoot(realRoot, realTarget);
}

module.exports = { isInsideRoot, isInsideRootReal, realPathOfNearest };
