// src/middlewares/auth.middleware.js
const jwt = require('jsonwebtoken');
const config = require('../config');
const AuthenticationError = require('../errors/authentificationError');

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Token manquant ou invalide');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded; // Attache l'utilisateur au req

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      next(new AuthenticationError('Token JWT invalide ou expiré'));
    } else {
      next(error);
    }
  }
};

module.exports = authMiddleware;