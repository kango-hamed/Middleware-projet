// ================================
// 📄 server.js - Point d'entrée
// ================================

const app = require('./src/app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🎬 Serveur CinéReserve démarré sur http://localhost:${PORT}`);
  console.log(`📚 Documentation API disponible sur http://localhost:${PORT}/api`);
});


// ================================
// 📄 src/app.js - Configuration Express
// ================================

const express = require('express');
const filmsRoutes = require('./routes/films.routes');
const authRoutes = require('./routes/auth.routes');
const reservationsRoutes = require('./routes/reservations.routes');
const loggerMiddleware = require('./middlewares/logger.middleware');
const errorMiddleware = require('./middlewares/error.middleware');

const app = express();

// ============================================
// MIDDLEWARES GLOBAUX
// ============================================

// 1. Parser JSON - Analyse le corps des requêtes JSON
app.use(express.json());

// 2. Parser URL-encoded - Pour les formulaires
app.use(express.urlencoded({ extended: true }));

// 3. Logger personnalisé - Log toutes les requêtes
app.use(loggerMiddleware);

// ============================================
// ROUTES
// ============================================

// Route racine
app.get('/', (req, res) => {
  res.json({
    message: '🎬 Bienvenue sur CinéReserve API',
    version: '1.0.0',
    endpoints: {
      films: 'GET /api/films',
      login: 'POST /api/login',
      signup: 'POST /api/signup',
      reservations: 'POST /api/reservations, GET /api/reservations'
    }
  });
});

// Montage des routes
app.use('/api', authRoutes);
app.use('/api', filmsRoutes);
app.use('/api', reservationsRoutes);

// Route 404 - Gestion des routes inexistantes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} non trouvée`
  });
});

// ============================================
// MIDDLEWARE DE GESTION D'ERREURS
// ============================================

app.use(errorMiddleware);

module.exports = app;


// ================================
// 📄 src/config/database.js
// ================================

const fs = require('fs');
const path = require('path');

/**
 * Classe de gestion de la base de données JSON
 */
class Database {
  constructor() {
    this.dataPath = path.join(__dirname, '../data');
  }

  /**
   * Lire un fichier JSON
   */
  read(filename) {
    try {
      const filePath = path.join(this.dataPath, filename);
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Erreur lecture ${filename}:`, error.message);
      return [];
    }
  }

  /**
   * Écrire dans un fichier JSON
   */
  write(filename, data) {
    try {
      const filePath = path.join(this.dataPath, filename);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    } catch (error) {
      console.error(`Erreur écriture ${filename}:`, error.message);
      return false;
    }
  }

  /**
   * Ajouter un élément
   */
  add(filename, item) {
    const data = this.read(filename);
    data.push(item);
    return this.write(filename, data);
  }

  /**
   * Trouver un élément
   */
  find(filename, predicate) {
    const data = this.read(filename);
    return data.find(predicate);
  }

  /**
   * Filtrer des éléments
   */
  filter(filename, predicate) {
    const data = this.read(filename);
    return data.filter(predicate);
  }
}

module.exports = new Database();


// ================================
// 📄 src/data/films.json
// ================================

[
  {
    "id": 1,
    "titre": "Inception",
    "realisateur": "Christopher Nolan",
    "annee": 2010,
    "genre": "Science-fiction",
    "duree": 148,
    "prix": 12.50
  },
  {
    "id": 2,
    "titre": "Avatar",
    "realisateur": "James Cameron",
    "annee": 2009,
    "genre": "Science-fiction",
    "duree": 162,
    "prix": 15.00
  },
  {
    "id": 3,
    "titre": "Interstellar",
    "realisateur": "Christopher Nolan",
    "annee": 2014,
    "genre": "Science-fiction",
    "duree": 169,
    "prix": 13.00
  },
  {
    "id": 4,
    "titre": "Le Parrain",
    "realisateur": "Francis Ford Coppola",
    "annee": 1972,
    "genre": "Drame",
    "duree": 175,
    "prix": 10.00
  },
  {
    "id": 5,
    "titre": "Pulp Fiction",
    "realisateur": "Quentin Tarantino",
    "annee": 1994,
    "genre": "Crime",
    "duree": 154,
    "prix": 11.50
  }
]


// ================================
// 📄 src/data/users.json
// ================================

[
  {
    "id": 1,
    "username": "admin",
    "password": "1234",
    "email": "admin@cinereserve.com",
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
]


// ================================
// 📄 src/data/reservations.json
// ================================

[]


// ================================
// 📄 src/middlewares/logger.middleware.js
// ================================

/**
 * Middleware de logging des requêtes
 */
const logger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl;
  const ip = req.ip || req.connection.remoteAddress;

  console.log(`[${timestamp}] ${method} ${url} - IP: ${ip}`);

  // Mesurer le temps de réponse
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    console.log(`[${timestamp}] ${method} ${url} - Status: ${status} - ${duration}ms`);
  });

  next();
};

module.exports = logger;


// ================================
// 📄 src/middlewares/auth.middleware.js
// ================================

const db = require('../config/database');

/**
 * Middleware d'authentification simple
 * Vérifie la présence d'un header Authorization
 */
const authenticate = (req, res, next) => {
  const username = req.headers.authorization;

  if (!username) {
    return res.status(401).json({
      success: false,
      message: 'Authentification requise. Ajoutez le header Authorization avec votre username.'
    });
  }

  // Vérifier si l'utilisateur existe
  const user = db.find('users.json', u => u.username === username);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Utilisateur non trouvé. Veuillez vous connecter.'
    });
  }

  // Attacher l'utilisateur à la requête
  req.user = user;
  next();
};

module.exports = authenticate;


// ================================
// 📄 src/middlewares/error.middleware.js
// ================================

/**
 * Middleware de gestion centralisée des erreurs
 */
const errorHandler = (err, req, res, next) => {
  console.error('❌ Erreur:', err);

  const status = err.status || 500;
  const message = err.message || 'Erreur interne du serveur';

  res.status(status).json({
    success: false,
    message: message,
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

module.exports = errorHandler;


// ================================
// 📄 src/routes/films.routes.js
// ================================

const express = require('express');
const router = express.Router();
const filmsController = require('../controllers/films.controller');

/**
 * @route   GET /api/films
 * @desc    Récupérer la liste de tous les films
 * @access  Public
 */
router.get('/films', filmsController.getAllFilms);

/**
 * @route   GET /api/films/:id
 * @desc    Récupérer un film par son ID
 * @access  Public
 */
router.get('/films/:id', filmsController.getFilmById);

module.exports = router;


// ================================
// 📄 src/routes/auth.routes.js
// ================================

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

/**
 * @route   POST /api/login
 * @desc    Connexion d'un utilisateur
 * @access  Public
 */
router.post('/login', authController.login);

/**
 * @route   POST /api/signup
 * @desc    Inscription d'un nouvel utilisateur
 * @access  Public
 */
router.post('/signup', authController.signup);

module.exports = router;


// ================================
// 📄 src/routes/reservations.routes.js
// ================================

const express = require('express');
const router = express.Router();
const reservationsController = require('../controllers/reservations.controller');
const authenticate = require('../middlewares/auth.middleware');

/**
 * @route   POST /api/reservations
 * @desc    Créer une nouvelle réservation
 * @access  Private (authentification requise)
 */
router.post('/reservations', authenticate, reservationsController.createReservation);

/**
 * @route   GET /api/reservations
 * @desc    Récupérer les réservations de l'utilisateur connecté
 * @access  Private (authentification requise)
 */
router.get('/reservations', authenticate, reservationsController.getUserReservations);

module.exports = router;


// ================================
// 📄 src/controllers/films.controller.js
// ================================

const db = require('../config/database');

/**
 * Récupérer tous les films
 */
exports.getAllFilms = (req, res) => {
  try {
    const films = db.read('films.json');

    res.status(200).json({
      success: true,
      count: films.length,
      data: films
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des films',
      error: error.message
    });
  }
};

/**
 * Récupérer un film par ID
 */
exports.getFilmById = (req, res) => {
  try {
    const filmId = parseInt(req.params.id);
    const film = db.find('films.json', f => f.id === filmId);

    if (!film) {
      return res.status(404).json({
        success: false,
        message: `Film avec l'ID ${filmId} non trouvé`
      });
    }

    res.status(200).json({
      success: true,
      data: film
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du film',
      error: error.message
    });
  }
};


// ================================
// 📄 src/controllers/auth.controller.js
// ================================

const db = require('../config/database');

/**
 * Connexion utilisateur
 */
exports.login = (req, res) => {
  try {
    const { username, password } = req.body;

    // Validation des champs
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username et password sont requis'
      });
    }

    // Vérifier les identifiants
    const user = db.find('users.json', u => 
      u.username === username && u.password === password
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Identifiants incorrects'
      });
    }

    // Connexion réussie
    res.status(200).json({
      success: true,
      message: 'Connexion réussie',
      data: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la connexion',
      error: error.message
    });
  }
};

/**
 * Inscription utilisateur
 */
exports.signup = (req, res) => {
  try {
    const { username, password, email } = req.body;

    // Validation des champs
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username et password sont requis'
      });
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = db.find('users.json', u => u.username === username);

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Ce nom d\'utilisateur existe déjà'
      });
    }

    // Créer le nouvel utilisateur
    const users = db.read('users.json');
    const newUser = {
      id: users.length + 1,
      username,
      password, // ⚠️ Dans un vrai projet, hashé le mot de passe !
      email: email || `${username}@cinereserve.com`,
      createdAt: new Date().toISOString()
    };

    db.add('users.json', newUser);

    // Inscription réussie
    res.status(201).json({
      success: true,
      message: 'Inscription réussie',
      data: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'inscription',
      error: error.message
    });
  }
};


// ================================
// 📄 src/controllers/reservations.controller.js
// ================================

const db = require('../config/database');

/**
 * Créer une réservation
 */
exports.createReservation = (req, res) => {
  try {
    const { filmId } = req.body;
    const userId = req.user.id; // Récupéré du middleware d'authentification

    // Validation
    if (!filmId) {
      return res.status(400).json({
        success: false,
        message: 'filmId est requis'
      });
    }

    // Vérifier que le film existe
    const film = db.find('films.json', f => f.id === parseInt(filmId));

    if (!film) {
      return res.status(404).json({
        success: false,
        message: `Film avec l'ID ${filmId} non trouvé`
      });
    }

    // Créer la réservation
    const reservations = db.read('reservations.json');
    const newReservation = {
      id: reservations.length + 1,
      userId: userId,
      filmId: parseInt(filmId),
      filmTitre: film.titre,
      prix: film.prix,
      statut: 'confirmée',
      createdAt: new Date().toISOString()
    };

    db.add('reservations.json', newReservation);

    res.status(201).json({
      success: true,
      message: 'Réservation créée avec succès',
      data: newReservation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la réservation',
      error: error.message
    });
  }
};

/**
 * Récupérer les réservations de l'utilisateur
 */
exports.getUserReservations = (req, res) => {
  try {
    const userId = req.user.id;

    // Filtrer les réservations de l'utilisateur
    const userReservations = db.filter('reservations.json', r => r.userId === userId);

    res.status(200).json({
      success: true,
      count: userReservations.length,
      data: userReservations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des réservations',
      error: error.message
    });
  }
};


// ================================
// 📄 src/utils/helpers.js
// ================================

/**
 * Générer un ID unique
 */
exports.generateId = (array) => {
  if (array.length === 0) return 1;
  return Math.max(...array.map(item => item.id)) + 1;
};

/**
 * Valider un email
 */
exports.isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Formatter une date
 */
exports.formatDate = (date) => {
  return new Date(date).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};