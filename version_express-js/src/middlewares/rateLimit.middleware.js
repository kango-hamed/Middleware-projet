// src/middlewares/rateLimit.middleware.js
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limite chaque IP à 100 requêtes par fenêtre
  message: {
    success: false,
    error: {
      code: 'RATE_000',
      message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.',
      details: [],
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = limiter;