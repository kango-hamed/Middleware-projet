// ============================================
// CinéReserve - Serveur Node.js pur (sécurisé)
// ============================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const { asyncHandler, handleError } = require('./modules/errorHandler');
const {
  ValidationError,
  AuthenticationError,
  ConflictError,
  NotFoundError,
  ServerError,
} = require('./modules/errors');
const { validate } = require('./modules/validator');
const logger = require('./modules/logger');
const { SECURITY_EVENTS } = require('./modules/logger');
const { checkRateLimit } = require('./modules/rateLimiter');

// === Sécurité avancée ===
const { setSecurityHeaders } = require('./modules/securityHeaders');
const { sanitizeObject } = require('./modules/sanitizer');
const { checkContentLength, readRequestBody } = require('./modules/requestLimiter');
const { validatePath } = require('./modules/pathSecurity');
const { generateSalt, hashPassword, verifyPassword } = require('./modules/crypto');

// Initialisation du logger
logger.initLogger();

// ============================================
// CONFIGURATION
// ============================================
const PORT = 3000;
const DB_DIR = path.join(__dirname, 'data');
const FILMS_DB = path.join(DB_DIR, 'films.json');
const USERS_DB = path.join(DB_DIR, 'users_hashed.json');
const RESERVATIONS_DB = path.join(DB_DIR, 'reservations.json');

const MAX_BODY_BYTES = 1 * 1024 * 1024; // 1 Mo
const BODY_TIMEOUT_MS = 30 * 1000; // 30 secondes

// ============================================
// UTILITAIRES
// ============================================
function readJsonFile(filePath) {
  try {
    const safePath = validatePath(path.relative(DB_DIR, filePath), DB_DIR);
    const data = fs.readFileSync(safePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.message && error.message.includes('path traversal')) {
      throw new ServerError(`Accès fichier non autorisé : ${filePath}`, 'SEC_001');
    }
    throw new ServerError(`Erreur lecture fichier : ${filePath}`, 'SYS_002');
  }
}

function writeJsonFile(filePath, data) {
  try {
    const safePath = validatePath(path.relative(DB_DIR, filePath), DB_DIR);
    fs.writeFileSync(safePath, JSON.stringify(data, null, 2));
  } catch (error) {
    if (error.message && error.message.includes('path traversal')) {
      throw new ServerError(`Accès fichier non autorisé : ${filePath}`, 'SEC_001');
    }
    throw new ServerError(`Erreur écriture fichier : ${filePath}`, 'SYS_003');
  }
}

// Lecture corps de requête sécurisée (avec timeout + limite taille)
async function parseRequestBody(req) {
  const clCheck = checkContentLength(req, MAX_BODY_BYTES);
  if (!clCheck.ok) throw new ValidationError(clCheck.message, 'VAL_003');

  try {
    const raw = await readRequestBody(req, MAX_BODY_BYTES, BODY_TIMEOUT_MS);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed;
  } catch (err) {
    if (err.code === 413) throw new ValidationError('Payload trop volumineux', 'VAL_005');
    if (err.code === 408) throw new ValidationError('Timeout lecture du corps', 'VAL_006');
    if (err instanceof SyntaxError) throw new ValidationError('Corps JSON invalide', 'VAL_002');
    throw err;
  }
}

// Réponse JSON standard + headers sécurité
function sendJsonResponse(res, statusCode, data) {
  try { setSecurityHeaders(res); } catch {}
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

// ============================================
// VALIDATION SCHEMAS
// ============================================
const loginSchema = {
  username: { type: 'string', required: true, minLength: 3 },
  password: { type: 'string', required: true, minLength: 8 },
};

const signupSchema = {
  username: { type: 'string', required: true, minLength: 3 },
  password: { type: 'string', required: true, minLength: 8 },
  nom: { type: 'string', required: true, minLength: 2 },
};

const reservationSchema = {
  filmId: { type: 'number', required: true, min: 1 },
  userId: { type: 'number', required: true, min: 1 },
  nombrePlaces: { type: 'number', required: true, min: 1, max: 10 },
};

// ============================================
// ROUTES
// ============================================

// GET /films
const handleGetFilms = asyncHandler(async (req, res) => {
  const films = readJsonFile(FILMS_DB);
  sendJsonResponse(res, 200, { success: true, data: films });
});

// POST /signup — crée un utilisateur avec hash sécurisé
const handleSignup = asyncHandler(async (req, res) => {
  const rawBody = await parseRequestBody(req);
  const body = sanitizeObject(rawBody);
  validate(body, signupSchema);

  const users = readJsonFile(USERS_DB);
  if (users.some(u => u.username === body.username)) {
    throw new ConflictError('Cet utilisateur existe déjà', 'USER_002');
  }

  const salt = generateSalt();
  const hash = hashPassword(body.password, salt);

  const newUser = {
    id: users.length ? Math.max(...users.map(u => u.id)) + 1 : 1,
    username: body.username,
    nom: body.nom,
    passwordHash: hash,
    passwordSalt: salt,
  };

  users.push(newUser);
  writeJsonFile(USERS_DB, users);

  sendJsonResponse(res, 201, {
    success: true,
    message: 'Inscription réussie',
    data: { id: newUser.id, username: newUser.username, nom: newUser.nom },
  });

  logger.logSecurity(SECURITY_EVENTS.SIGNUP, {
    userId: newUser.id,
    username: newUser.username
  }, req);
});

// POST /login — vérifie le hash et le salt
const handleLogin = asyncHandler(async (req, res) => {
  const rawBody = await parseRequestBody(req);
  const body = sanitizeObject(rawBody);
  validate(body, loginSchema);

  const users = readJsonFile(USERS_DB);
  const user = users.find(u => u.username === body.username);

  if (!user) {
    logger.logSecurity(SECURITY_EVENTS.LOGIN_FAILED, {
      username: body.username,
      reason: 'unknown_user'
    }, req);
    throw new AuthenticationError('Identifiants incorrects', 'AUTH_004');
  }

  const isValid = verifyPassword(body.password, user.passwordHash, user.passwordSalt);
  if (!isValid) {
    logger.logSecurity(SECURITY_EVENTS.LOGIN_FAILED, {
      username: body.username,
      reason: 'invalid_password'
    }, req);
    throw new AuthenticationError('Identifiants incorrects', 'AUTH_004');
  }

  logger.logSecurity(SECURITY_EVENTS.LOGIN_SUCCESS, {
    userId: user.id,
    username: user.username
  }, req);

  sendJsonResponse(res, 200, {
    success: true,
    message: 'Connexion réussie',
    data: { userId: user.id, username: user.username, nom: user.nom },
  });
});

// POST /reservations
const handleCreateReservation = asyncHandler(async (req, res) => {
  const rawBody = await parseRequestBody(req);
  const body = sanitizeObject(rawBody);
  validate(body, reservationSchema);

  const films = readJsonFile(FILMS_DB);
  const film = films.find(f => f.id === body.filmId);
  if (!film) throw new NotFoundError('Film non trouvé', 'FILM_001');

  if (film.places_disponibles < body.nombrePlaces) {
    throw new ValidationError('Places insuffisantes', 'FILM_002');
  }

  logger.log('INFO', 'Nouvelle demande de réservation', {
    userId: body.userId,
    filmId: body.filmId
  });

  const reservations = readJsonFile(RESERVATIONS_DB);
  const newReservation = {
    id: reservations.length ? Math.max(...reservations.map(r => r.id)) + 1 : 1,
    filmId: body.filmId,
    userId: body.userId,
    nombrePlaces: body.nombrePlaces,
    date: new Date().toISOString(),
    statut: 'confirmée',
  };

  reservations.push(newReservation);
  writeJsonFile(RESERVATIONS_DB, reservations);

  film.places_disponibles -= body.nombrePlaces;
  writeJsonFile(FILMS_DB, films);

  sendJsonResponse(res, 201, {
    success: true,
    message: 'Réservation confirmée',
    data: newReservation
  });
});

// GET /reservations
const handleGetReservations = asyncHandler(async (req, res) => {
  const params = new URLSearchParams(req.url.split('?')[1] || '');
  const userId = Number(params.get('userId'));
  if (!userId || isNaN(userId)) throw new ValidationError('userId invalide ou manquant', 'VAL_004');

  const reservations = readJsonFile(RESERVATIONS_DB);
  const films = readJsonFile(FILMS_DB);
  const userReservations = reservations
    .filter(r => r.userId === userId)
    .map(r => ({ ...r, filmTitre: films.find(f => f.id === r.filmId)?.titre || 'Inconnu' }));

  sendJsonResponse(res, 200, { success: true, data: userReservations });
});

// ============================================
// SERVEUR & ROUTING
// ============================================
const server = http.createServer((req, res) => {
  const pathname = req.url.split('?')[0];
  const ip = req.socket.remoteAddress;

  const rate = checkRateLimit(ip, pathname);
  if (rate.blocked) {
    setSecurityHeaders(res);
    res.writeHead(429, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: rate.reason }));
  }

  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  logger.logHttpRequest(req, res);

  if (req.method === 'OPTIONS') {
    setSecurityHeaders(res);
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  const method = req.method;
  const url = pathname;

  try {
    switch (true) {
      case method === 'GET' && url === '/films': return handleGetFilms(req, res);
      case method === 'POST' && url === '/login': return handleLogin(req, res);
      case method === 'POST' && url === '/signup': return handleSignup(req, res);
      case method === 'POST' && url === '/reservations': return handleCreateReservation(req, res);
      case method === 'GET' && url === '/reservations': return handleGetReservations(req, res);
      default:
        throw new NotFoundError('Route non trouvée', 'NOT_FOUND');
    }
  } catch (error) {
    handleError(error, req, res);
  }
});

server.listen(PORT, () => {
  logger.log('INFO', `✅ Serveur CinéReserve démarré sur le port ${PORT}`, {
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });
});

// ============================================
// GESTION DES ERREURS NON CAPTURÉES & ARRÊT PROPRE
// ============================================
process.on('uncaughtException', (error) => {
  logger.log('CRITICAL', 'Erreur critique non gérée (uncaughtException)', {}, error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.log('WARN', 'Promesse rejetée non gérée', { reason, promise });
});

function gracefulShutdown(signal) {
  logger.log('INFO', `Signal ${signal} reçu : arrêt du serveur...`);
  server.close(() => {
    logger.log('INFO', 'Serveur arrêté proprement.');
    process.exit(0);
  });

  setTimeout(() => {
    logger.log('ERROR', 'Forçage de l’arrêt après 30 secondes.');
    process.exit(1);
  }, 30000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
