const { verifyToken } = require('./jwt');
const { getSession } = require('./sessionManager');
const SECRET = process.env.JWT_SECRET || 'devSecretKey';

/**
 * Extrait et vérifie le token dans le header Authorization
 * @returns {object|null} { userId } ou null si invalide
 */
function authenticate(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;

  const token = authHeader.replace('Bearer ', '').trim();
  try {
    verifyToken(token, SECRET);
    const session = getSession(token);
    if (!session) return null;
    return { userId: session.userId };
  } catch {
    return null;
  }
}

module.exports = { authenticate };
