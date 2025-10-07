/**
 * Module JWT "maison" - sans dépendance externe
 * Implémente : génération, vérification et décodage de token
 */

const crypto = require('crypto');

function base64UrlEncode(obj) {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(Buffer.from(base64, 'base64').toString());
}

function createSignature(header, payload, secret) {
  const data = `${header}.${payload}`;
  return crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Génère un token JWT simple
 * @param {object} payload - Données (ex: { userId })
 * @param {string} secret - Clé secrète
 * @param {number} expiresIn - Durée en secondes
 */
function generateToken(payload, secret, expiresIn = 3600) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + expiresIn;

  const encodedHeader = base64UrlEncode(header);
  const encodedPayload = base64UrlEncode({ ...payload, iat, exp });
  const signature = createSignature(encodedHeader, encodedPayload, secret);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Vérifie un token et renvoie le payload si valide
 */
function verifyToken(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Token invalide');

  const [headerB64, payloadB64, signature] = parts;
  const expectedSig = createSignature(headerB64, payloadB64, secret);

  if (signature !== expectedSig) throw new Error('Signature invalide');

  const payload = base64UrlDecode(payloadB64);
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expiré');

  return payload;
}

function decodeToken(token) {
  const [, payloadB64] = token.split('.');
  return base64UrlDecode(payloadB64);
}

module.exports = { generateToken, verifyToken, decodeToken };
