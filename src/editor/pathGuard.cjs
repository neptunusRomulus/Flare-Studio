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

module.exports = { isInsideRoot };
