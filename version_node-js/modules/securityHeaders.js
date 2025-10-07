// modules/securityHeaders.js
/**
 * Ajoute des headers de sécurité recommandés
 */

function setSecurityHeaders(res) {
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    // HSTS - n'utiliser qu'en HTTPS en production
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    // Content-Security-Policy minimal — adapter selon les besoins (scripts/images externes...)
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'"
  };

  for (const [k, v] of Object.entries(headers)) {
    res.setHeader(k, v);
  }
}

module.exports = { setSecurityHeaders };
