// ============================================
// CinéReserve - Serveur Node.js pur (sans middleware)
// Fichier: server_no_middleware.js
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
// FONCTIONS UTILITAIRES
// ============================================

// Lire les données d'un fichier JSON
function readJsonFile(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Erreur lors de la lecture de ${filePath}:`, error);
    return null;
  }
}

// Écrire des données dans un fichier JSON
function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Erreur lors de l'écriture dans ${filePath}:`, error);
    return false;
  }
}

// Parser le corps de la requête (pour POST)
function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const parsedBody = body ? JSON.parse(body) : {};
        resolve(parsedBody);
      } catch (error) {
        reject(error);
      }
    });
    
    req.on('error', error => {
      reject(error);
    });
  });
}

// Envoyer une réponse JSON
function sendJsonResponse(res, statusCode, data) {
  res.writeHead(statusCode, { 
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data));
}

// ============================================
// HANDLERS DES ROUTES
// ============================================

// GET /films - Récupérer la liste des films
function handleGetFilms(req, res) {
  const films = readJsonFile(FILMS_DB);
  
  if (films) {
    sendJsonResponse(res, 200, {
      success: true,
      data: films
    });
  } else {
    sendJsonResponse(res, 500, {
      success: false,
      message: "Erreur lors de la récupération des films"
    });
  }
}

// POST /login - Authentification
async function handleLogin(req, res) {
  try {
    const body = await parseRequestBody(req);
    const { username, password } = body;

    // Validation des champs
    if (!username || !password) {
      return sendJsonResponse(res, 400, {
        success: false,
        message: "Username et password sont requis"
      });
    }

    // Vérification des identifiants
    const users = readJsonFile(USERS_DB);
    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
      sendJsonResponse(res, 200, {
        success: true,
        message: "Connexion réussie",
        data: {
          userId: user.id,
          username: user.username,
          nom: user.nom
        }
      });
    } else {
      sendJsonResponse(res, 401, {
        success: false,
        message: "Identifiants incorrects"
      });
    }
  } catch (error) {
    sendJsonResponse(res, 400, {
      success: false,
      message: "Erreur lors du traitement de la requête: " + error.message
    });
  }
}

// POST /signup - Inscription
async function handleSignup(req, res) {
  try {
    const body = await parseRequestBody(req);
    const { username, password, nom } = body;

    // Validation des champs
    if (!username || !password || !nom) {
      return sendJsonResponse(res, 400, {
        success: false,
        message: "Username, password et nom sont requis"
      });
    }

    // Vérifier si l'utilisateur existe déjà
    const users = readJsonFile(USERS_DB);
    const existingUser = users.find(u => u.username === username);

    if (existingUser) {
      return sendJsonResponse(res, 409, {
        success: false,
        message: "Cet utilisateur existe déjà"
      });
    }

    // Créer le nouvel utilisateur
    const newUser = {
      id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
      username,
      password,
      nom
    };

    users.push(newUser);
    writeJsonFile(USERS_DB, users);

    sendJsonResponse(res, 201, {
      success: true,
      message: "Inscription réussie",
      data: {
        userId: newUser.id,
        username: newUser.username,
        nom: newUser.nom
      }
    });
  } catch (error) {
    sendJsonResponse(res, 400, {
      success: false,
      message: "Erreur lors du traitement de la requête: " + error.message
    });
  }
}

// POST /reservations - Créer une réservation
async function handleCreateReservation(req, res) {
  try {
    const body = await parseRequestBody(req);
    const { filmId, userId, nombrePlaces } = body;

    // Validation des champs
    if (!filmId || !userId || !nombrePlaces) {
      return sendJsonResponse(res, 400, {
        success: false,
        message: "filmId, userId et nombrePlaces sont requis"
      });
    }

    // Vérifier que le film existe et a assez de places
    const films = readJsonFile(FILMS_DB);
    const filmIndex = films.findIndex(f => f.id === parseInt(filmId));

    if (filmIndex === -1) {
      return sendJsonResponse(res, 404, {
        success: false,
        message: "Film non trouvé"
      });
    }

    const film = films[filmIndex];

    if (film.places_disponibles < nombrePlaces) {
      return sendJsonResponse(res, 400, {
        success: false,
        message: `Pas assez de places disponibles (${film.places_disponibles} restantes)`
      });
    }

    // Créer la réservation
    const reservations = readJsonFile(RESERVATIONS_DB);
    const newReservation = {
      id: reservations.length > 0 ? Math.max(...reservations.map(r => r.id)) + 1 : 1,
      filmId: parseInt(filmId),
      userId: parseInt(userId),
      nombrePlaces: parseInt(nombrePlaces),
      date: new Date().toISOString(),
      statut: "confirmée"
    };

    reservations.push(newReservation);
    writeJsonFile(RESERVATIONS_DB, reservations);

    // Mettre à jour les places disponibles
    films[filmIndex].places_disponibles -= nombrePlaces;
    writeJsonFile(FILMS_DB, films);

    sendJsonResponse(res, 201, {
      success: true,
      message: "Réservation confirmée",
      data: {
        ...newReservation,
        film: film.titre
      }
    });
  } catch (error) {
    sendJsonResponse(res, 400, {
      success: false,
      message: "Erreur lors du traitement de la requête: " + error.message
    });
  }
}

// GET /reservations?userId=X - Récupérer les réservations d'un utilisateur
function handleGetReservations(req, res) {
  // Extraire le paramètre userId de l'URL
  const urlParts = req.url.split('?');
  const queryString = urlParts[1] || '';
  const params = new URLSearchParams(queryString);
  const userId = params.get('userId');

  if (!userId) {
    return sendJsonResponse(res, 400, {
      success: false,
      message: "userId est requis en paramètre"
    });
  }

  const reservations = readJsonFile(RESERVATIONS_DB);
  const films = readJsonFile(FILMS_DB);
  
  // Filtrer les réservations de l'utilisateur
  const userReservations = reservations
    .filter(r => r.userId === parseInt(userId))
    .map(r => {
      const film = films.find(f => f.id === r.filmId);
      return {
        ...r,
        filmTitre: film ? film.titre : "Film inconnu"
      };
    });

  sendJsonResponse(res, 200, {
    success: true,
    data: userReservations
  });
}

// ============================================
// CRÉATION DU SERVEUR
// ============================================
const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  // Gérer les requêtes OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  // Router les requêtes selon la méthode et l'URL
  const method = req.method;
  const url = req.url.split('?')[0]; // Enlever les paramètres de requête pour le routing

  switch (true) {
    case method === 'GET' && url === '/films':
      handleGetFilms(req, res);
      break;

    case method === 'POST' && url === '/login':
      handleLogin(req, res);
      break;

    case method === 'POST' && url === '/signup':
      handleSignup(req, res);
      break;

    case method === 'POST' && url === '/reservations':
      handleCreateReservation(req, res);
      break;

    case method === 'GET' && url === '/reservations':
      handleGetReservations(req, res);
      break;

    default:
      sendJsonResponse(res, 404, {
        success: false,
        message: "Route non trouvée"
      });
  }
});

// ============================================
// DÉMARRAGE DU SERVEUR
// ============================================

server.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('🎬 CinéReserve - Serveur Node.js Pur');
  console.log('='.repeat(50));
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
  console.log('\n📋 Routes disponibles:');
  console.log('  GET  /films              - Liste des films');
  console.log('  POST /login              - Connexion');
  console.log('  POST /signup             - Inscription');
  console.log('  POST /reservations       - Créer une réservation');
  console.log('  GET  /reservations?userId=X - Réservations d\'un utilisateur');
  console.log('='.repeat(50));
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
