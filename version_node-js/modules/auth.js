// ============================================
// CinéReserve - Serveur Node.js pur (avec JWT & Auth intégrés)
// ============================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const { asyncHandler, handleError } = require('./errorHandler');
const {
  ValidationError,
  AuthenticationError,
  ConflictError,
  NotFoundError,
  ServerError,
} = require('./errors');
const { validate } = require('./validator');
const logger = require('./logger');
const { SECURITY_EVENTS } = require('./logger');
const { checkRateLimit } = require('./rateLimiter');

// --- Phase 3 modules --
const { setSecurityHeaders } = require('./securityHeaders');
const { sanitizeObject } = require('./sanitizer');
const { checkContentLength, readRequestBody } = require('./requestLimiter');
const { validatePath } = require('./pathSecurity');

// --- JWT & Auth modules ---
const { generateToken, verifyToken } = require('./jwt');
const { authenticate } = require('./auth');
const { createSession, deleteSession } = require('./sessionManager');
const { hashPassword, verifyPassword } = require('./crypto');

/* Initialiser le système de logs */
logger.initLogger();

// ============================================
// CONFIGURATION
// ============================================
const PORT = 3000;
const DB_DIR = path.join(__dirname, 'data');
const FILMS_DB = path.join(DB_DIR, 'films.json');
const USERS_DB = path.join(DB_DIR, 'users.json');
const RESERVATIONS_DB = path.join(DB_DIR, 'reservations.json');

const MAX_BODY_BYTES = 1 * 1024 * 1024; // 1MB
const BODY_TIMEOUT_MS = 30 * 1000; // 30s
const JWT_SECRET = process.env.JWT_SECRET || 'devSecretKey';
const JWT_EXPIRES_IN = 3600 * 24; // 24 heures

// ============================================
// UTILITAIRES
// ============================================
function readJsonFile(filePath) {
  try {
    const safePath = validatePath(path.relative(DB_DIR, filePath), DB_DIR);
    const data = fs.readFileSync(safePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.message && error.message.includes('Tentative de path traversal')) {
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
    if (error.message && error.message.includes('Tentative de path traversal')) {
      throw new ServerError(`Accès fichier non autorisé : ${filePath}`, 'SEC_001');
    }
    throw new ServerError(`Erreur écriture fichier : ${filePath}`, 'SYS_003');
  }
}

async function parseRequestBody(req) {
  const clCheck = checkContentLength(req, MAX_BODY_BYTES);
  if (!clCheck.ok) {
    const err = new ValidationError(clCheck.message, 'VAL_003');
    throw err;
  }

  try {
    const raw = await readRequestBody(req, MAX_BODY_BYTES, BODY_TIMEOUT_MS);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed;
  } catch (err) {
    if (err && err.code === 413) throw new ValidationError('Payload trop volumineux', 'VAL_005');
    if (err && err.code === 408) throw new ValidationError('Timeout lecture du corps', 'VAL_006');
    if (err instanceof SyntaxError || (err && err.message && err.message.includes('JSON'))) {
      throw new ValidationError('Corps JSON invalide', 'VAL_002');
    }
    throw err;
  }
}

function sendJsonResponse(res, statusCode, data) {
  try { setSecurityHeaders(res); } catch (e) { /* ne pas faire planter la réponse */ }
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

/**
 * Middleware d'authentification
 * Vérifie le token JWT et attache userId à la requête
 */
function requireAuth(req) {
  const authResult = authenticate(req);
  if (!authResult) {
    throw new AuthenticationError('Token invalide ou expiré', 'AUTH_001');
  }
  return authResult;
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
  nombrePlaces: { type: 'number', required: true, min: 1, max: 10 },
};

// ============================================
// ROUTES
// ============================================

// GET /films (publique)
const handleGetFilms = asyncHandler(async (req, res) => {
  const films = readJsonFile(FILMS_DB);
  sendJsonResponse(res, 200, { success: true, data: films });
});

// POST /login
const handleLogin = asyncHandler(async (req, res) => {
  const rawBody = await parseRequestBody(req);
  const body = sanitizeObject(rawBody);
  validate(body, loginSchema);

  const users = readJsonFile(USERS_DB);
  const user = users.find(u => u.username === body.username);

  if (!user) {
    logger.logSecurity(SECURITY_EVENTS.LOGIN_FAILED, {
      username: body.username,
      reason: 'user_not_found'
    }, req);
    throw new AuthenticationError('Identifiants incorrects', 'AUTH_004');
  }

  // Vérification du mot de passe (hashé ou plain selon migration)
  let isPasswordValid = false;
  if (user.passwordHash && user.passwordSalt) {
    // Utilisation du système de hash
    isPasswordValid = verifyPassword(body.password, user.passwordHash, user.passwordSalt);
  } else if (user.password) {
    // Fallback pour anciens utilisateurs (à migrer)
    isPasswordValid = user.password === body.password;
  }

  if (!isPasswordValid) {
    logger.logSecurity(SECURITY_EVENTS.LOGIN_FAILED, {
      username: body.username,
      reason: 'invalid_password'
    }, req);
    throw new AuthenticationError('Identifiants incorrects', 'AUTH_004');
  }

  // Génération du token JWT
  const token = generateToken({ userId: user.id }, JWT_SECRET, JWT_EXPIRES_IN);
  
  // Création de la session
  createSession(token, user.id);

  logger.logSecurity(SECURITY_EVENTS.LOGIN_SUCCESS, {
    userId: user.id,
    username: user.username
  }, req);

  sendJsonResponse(res, 200, {
    success: true,
    message: 'Connexion réussie',
    data: { 
      userId: user.id, 
      username: user.username, 
      nom: user.nom,
      token 
    },
  });
});

// POST /signup
const handleSignup = asyncHandler(async (req, res) => {
  const rawBody = await parseRequestBody(req);
  const body = sanitizeObject(rawBody);
  validate(body, signupSchema);

  const users = readJsonFile(USERS_DB);
  if (users.some(u => u.username === body.username)) {
    throw new ConflictError('Cet utilisateur existe déjà', 'USER_002');
  }

  // Hash du mot de passe
  const { hash, salt } = hashPassword(body.password);

  const newUser = {
    id: users.length ? Math.max(...users.map(u => u.id)) + 1 : 1,
    username: body.username,
    passwordHash: hash,
    passwordSalt: salt,
    nom: body.nom,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  writeJsonFile(USERS_DB, users);

  // Génération du token JWT automatique après inscription
  const token = generateToken({ userId: newUser.id }, JWT_SECRET, JWT_EXPIRES_IN);
  createSession(token, newUser.id);

  logger.logSecurity(SECURITY_EVENTS.SIGNUP, {
    userId: newUser.id,
    username: newUser.username
  }, req);

  sendJsonResponse(res, 201, {
    success: true,
    message: 'Inscription réussie',
    data: { 
      id: newUser.id, 
      username: newUser.username, 
      nom: newUser.nom,
      token 
    },
  });
});

// POST /logout
const handleLogout = asyncHandler(async (req, res) => {
  const authResult = requireAuth(req);
  
  // Supprimer la session
  const authHeader = req.headers['authorization'];
  const token = authHeader.replace('Bearer ', '').trim();
  deleteSession(token);

  logger.logSecurity(SECURITY_EVENTS.LOGOUT, {
    userId: authResult.userId
  }, req);

  sendJsonResponse(res, 200, {
    success: true,
    message: 'Déconnexion réussie'
  });
});

// POST /reservations (protégée)
const handleCreateReservation = asyncHandler(async (req, res) => {
  // Authentification requise
  const authResult = requireAuth(req);
  const userId = authResult.userId;

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
    userId: userId,
    filmId: body.filmId
  });

  const reservations = readJsonFile(RESERVATIONS_DB);
  const newReservation = {
    id: reservations.length ? Math.max(...reservations.map(r => r.id)) + 1 : 1,
    filmId: body.filmId,
    userId: userId, // Utilise l'userId du token
    nombrePlaces: body.nombrePlaces,
    date: new Date().toISOString(),
    statut: 'confirmée',
  };

  reservations.push(newReservation);
  writeJsonFile(RESERVATIONS_DB, reservations);

  // mise à jour du film
  film.places_disponibles -= body.nombrePlaces;
  writeJsonFile(FILMS_DB, films);

  sendJsonResponse(res, 201, { 
    success: true, 
    message: 'Réservation confirmée', 
    data: newReservation 
  });
});

// GET /reservations (protégée)
const handleGetReservations = asyncHandler(async (req, res) => {
  // Authentification requise
  const authResult = requireAuth(req);
  const userId = authResult.userId;

  const reservations = readJsonFile(RESERVATIONS_DB);
  const films = readJsonFile(FILMS_DB);
  
  // L'utilisateur ne peut voir que ses propres réservations
  const userReservations = reservations
    .filter(r => r.userId === userId)
    .map(r => ({ 
      ...r, 
      filmTitre: films.find(f => f.id === r.filmId)?.titre || 'Inconnu' 
    }));

  sendJsonResponse(res, 200, { success: true, data: userReservations });
});

// GET /me (nouvelle route pour obtenir les infos de l'utilisateur connecté)
const handleGetMe = asyncHandler(async (req, res) => {
  const authResult = requireAuth(req);
  const userId = authResult.userId;

  const users = readJsonFile(USERS_DB);
  const user = users.find(u => u.id === userId);

  if (!user) {
    throw new NotFoundError('Utilisateur non trouvé', 'USER_001');
  }

  sendJsonResponse(res, 200, {
    success: true,
    data: {
      id: user.id,
      username: user.username,
      nom: user.nom,
      createdAt: user.createdAt
    }
  });
});

// ============================================
// SERVEUR & ROUTING
// ============================================
const server = http.createServer((req, res) => {
  const fullUrl = req.url || '/';
  const pathname = fullUrl.split('?')[0];

  const ip = req.socket.remoteAddress;
  const rate = checkRateLimit(ip, pathname);

  if (rate.blocked) {
    try { setSecurityHeaders(res); } catch (e) {}
    res.writeHead(429, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: rate.reason }));
  }

  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  logger.logHttpRequest(req, res);

  if (req.method === 'OPTIONS') {
    try { setSecurityHeaders(res); } catch (e) {}
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    return res.end();
  }

  const method = req.method;
  const url = pathname;

  try {
    switch (true) {
      // Routes publiques
      case method === 'GET' && url === '/films': 
        return handleGetFilms(req, res);
      case method === 'POST' && url === '/login': 
        return handleLogin(req, res);
      case method === 'POST' && url === '/signup': 
        return handleSignup(req, res);
      
      // Routes protégées
      case method === 'POST' && url === '/logout': 
        return handleLogout(req, res);
      case method === 'POST' && url === '/reservations': 
        return handleCreateReservation(req, res);
      case method === 'GET' && url === '/reservations': 
        return handleGetReservations(req, res);
      case method === 'GET' && url === '/me': 
        return handleGetMe(req, res);
      
      default:
        throw new NotFoundError('Route non trouvée', 'NOT_FOUND');
    }
  } catch (error) {
    handleError(error, req, res);
  }
});

server.listen(PORT, () => {
  logger.log('INFO', `Serveur CinéReserve démarré sur le port ${PORT}`, {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    jwtEnabled: true
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
    logger.log('ERROR', `Forçage de l'arrêt après 30 secondes.`);
    process.exit(1);
  }, 30000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));