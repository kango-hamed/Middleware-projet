// ============================================
// CinéReserve - Serveur Node.js pur (avec gestion d’erreurs intégrée)
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

// ============================================
// CONFIGURATION
// ============================================
const PORT = 3000;
const DB_DIR = path.join(__dirname, 'data');
const FILMS_DB = path.join(DB_DIR, 'films.json');
const USERS_DB = path.join(DB_DIR, 'users.json');
const RESERVATIONS_DB = path.join(DB_DIR, 'reservations.json');

// ============================================
// UTILITAIRES
// ============================================
function readJsonFile(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    throw new ServerError(`Erreur lecture fichier : ${filePath}`, 'SYS_002');
  }
}

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    throw new ServerError(`Erreur écriture fichier : ${filePath}`, 'SYS_003');
  }
}

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk.toString()));
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        resolve(parsed);
      } catch (err) {
        reject(new ValidationError('Corps JSON invalide', 'VAL_002'));
      }
    });
    req.on('error', err => reject(err));
  });
}

function sendJsonResponse(res, statusCode, data) {
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

// POST /login
const handleLogin = asyncHandler(async (req, res) => {
  const body = await parseRequestBody(req);
  validate(body, loginSchema);

  const users = readJsonFile(USERS_DB);
  const user = users.find(u => u.username === body.username && u.password === body.password);
  if (!user) throw new AuthenticationError('Identifiants incorrects', 'AUTH_004');

  sendJsonResponse(res, 200, {
    success: true,
    message: 'Connexion réussie',
    data: { userId: user.id, username: user.username, nom: user.nom },
  });
});

// POST /signup
const handleSignup = asyncHandler(async (req, res) => {
  const body = await parseRequestBody(req);
  validate(body, signupSchema);

  const users = readJsonFile(USERS_DB);
  if (users.some(u => u.username === body.username)) {
    throw new ConflictError('Cet utilisateur existe déjà', 'USER_002');
  }

  const newUser = {
    id: users.length ? Math.max(...users.map(u => u.id)) + 1 : 1,
    username: body.username,
    password: body.password,
    nom: body.nom,
  };

  users.push(newUser);
  writeJsonFile(USERS_DB, users);

  sendJsonResponse(res, 201, {
    success: true,
    message: 'Inscription réussie',
    data: newUser,
  });
});

// POST /reservations
const handleCreateReservation = asyncHandler(async (req, res) => {
  const body = await parseRequestBody(req);
  validate(body, reservationSchema);

  const films = readJsonFile(FILMS_DB);
  const film = films.find(f => f.id === body.filmId);
  if (!film) throw new NotFoundError('Film non trouvé', 'FILM_001');

  if (film.places_disponibles < body.nombrePlaces) {
    throw new ValidationError('Places insuffisantes', 'FILM_002');
  }

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

  sendJsonResponse(res, 201, { success: true, message: 'Réservation confirmée', data: newReservation });
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
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  const method = req.method;
  const url = req.url.split('?')[0];

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
  console.log(`✅ Serveur CinéReserve lancé sur http://localhost:${PORT}`);
});


// ============================================
// GESTION DES ERREURS NON CAPTURÉES & ARRÊT PROPRE
// ============================================

// 1️⃣ Erreurs synchrones non gérées
process.on('uncaughtException', (error) => {
  console.error('🚨 ERREUR CRITIQUE NON GÉRÉE (uncaughtException) 🚨');
  console.error('Message :', error.message);
  console.error('Stack :', error.stack);
  
  // Tenter un arrêt propre
  try {
    console.log('🧹 Fermeture du serveur suite à une erreur critique...');
    server.close(() => {
      console.log('✅ Connexions fermées proprement.');
      process.exit(1); // Quitte avec échec
    });

    // Sécurité : forcer la sortie après 5 s
    setTimeout(() => {
      console.error('⚠️ Forçage de la fermeture du processus.');
      process.exit(1);
    }, 5000);
  } catch (shutdownError) {
    console.error('Erreur lors de la fermeture du serveur :', shutdownError);
    process.exit(1);
  }
});

// 2️⃣ Promesses rejetées non gérées
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ PROMESSE REJETÉE NON GÉRÉE (unhandledRejection) ⚠️');
  console.error('Raison :', reason);
  console.error('Promise :', promise);

  // Ici, on log seulement, le serveur peut continuer
  // (si ces erreurs deviennent fréquentes, on envisagera un redémarrage auto)
});

// 3️⃣ Arrêt manuel / système (SIGINT, SIGTERM)
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

function gracefulShutdown(signal) {
  console.log(`\n🛑 Signal ${signal} reçu : arrêt du serveur...`);

  server.close(() => {
    console.log('✅ Toutes les connexions fermées proprement.');
    console.log('👋 Serveur arrêté.');
    process.exit(0);
  });

  // Sécurité : forcer la sortie après 30 s
  setTimeout(() => {
    console.error('⚠️ Forçage de l’arrêt après 30 secondes.');
    process.exit(1);
  }, 30000);
}
