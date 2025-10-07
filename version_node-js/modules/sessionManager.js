/**
 * Gestion simple des sessions utilisateurs (en mémoire)
 * Chaque session contient un token JWT et sa date d’expiration
 */

const { generateToken, verifyToken } = require('./jwt');
const SECRET = process.env.JWT_SECRET || 'devSecretKey';

const sessions = {}; // { token: { userId, expiresAt } }

/**
 * Crée une nouvelle session et retourne le token
 */
function createSession(userId) {
  const expiresIn = 24 * 3600; // 24h
  const token = generateToken({ userId }, SECRET, expiresIn);
  const expiresAt = Date.now() + expiresIn * 1000;
  sessions[token] = { userId, expiresAt };
  return token;
}

/**
 * Récupère une session valide
 */
function getSession(token) {
  const session = sessions[token];
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    delete sessions[token];
    return null;
  }
  return session;
}

/**
 * Supprime une session (logout)
 */
function deleteSession(token) {
  delete sessions[token];
}

/**
 * Nettoie les sessions expirées automatiquement
 */
function cleanExpiredSessions() {
  const now = Date.now();
  for (const token in sessions) {
    if (now > sessions[token].expiresAt) delete sessions[token];
  }
}
setInterval(cleanExpiredSessions, 60 * 60 * 1000); // chaque heure

module.exports = { createSession, getSession, deleteSession };
