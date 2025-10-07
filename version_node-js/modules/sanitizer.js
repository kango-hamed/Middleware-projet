// modules/sanitizer.js
const path = require('path');

function sanitizeHtml(str) {
  if (typeof str !== 'string') return str;
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

function sanitizeFilename(filename) {
  if (typeof filename !== 'string') return filename;
  // Remove directory traversal chars and invalid Windows chars
  const base = path.basename(filename);
  return base.replace(/[<>:"\/\\|?*\x00-\x1F]/g, '');
}

function stripDangerousChars(str) {
  if (typeof str !== 'string') return str;
  // Remove control chars and unprintable unicode ranges often used in obfuscation
  return str.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
}

function normalizeEmail(email) {
  if (typeof email !== 'string') return email;
  return email.trim().toLowerCase();
}

/**
 * sanitizeObject: parcourt l'objet et sanitized toutes les strings
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (typeof v === 'string') {
      out[key] = sanitizeHtml(stripDangerousChars(v));
    } else if (typeof v === 'object' && v !== null) {
      out[key] = sanitizeObject(v);
    } else {
      out[key] = v;
    }
  }
  return out;
}

module.exports = {
  sanitizeHtml,
  sanitizeFilename,
  stripDangerousChars,
  normalizeEmail,
  sanitizeObject
};
