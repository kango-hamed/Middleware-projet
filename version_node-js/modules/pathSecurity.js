// modules/pathSecurity.js
const path = require('path');

/**
 * Validate that requestedPath stays within allowedDir.
 * Returns absolute resolved path if OK, otherwise throws.
 */
function validatePath(requestedPath, allowedDir) {
  const normalizedAllowed = path.resolve(allowedDir);
  const resolved = path.resolve(normalizedAllowed, requestedPath);

  if (!resolved.startsWith(normalizedAllowed + path.sep) && resolved !== normalizedAllowed) {
    throw new Error('Tentative de path traversal détectée');
  }
  return resolved;
}

module.exports = { validatePath };
