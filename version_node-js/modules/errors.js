// modules/errors.js

class AppError extends Error {
  constructor(message, code = 'SYS_000', statusCode = 500, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

// 400 - Données invalides
class ValidationError extends AppError {
  constructor(message = 'Données invalides', code = 'VAL_000', details = null) {
    super(message, code, 400, true);
    this.details = details;
  }
}

// 401 - Non authentifié
class AuthenticationError extends AppError {
  constructor(message = 'Non authentifié', code = 'AUTH_000') {
    super(message, code, 401, true);
  }
}

// 403 - Non autorisé
class AuthorizationError extends AppError {
  constructor(message = 'Accès refusé', code = 'AUTH_403') {
    super(message, code, 403, true);
  }
}

// 404 - Ressource introuvable
class NotFoundError extends AppError {
  constructor(message = 'Ressource introuvable', code = 'NOT_FOUND') {
    super(message, code, 404, true);
  }
}

// 409 - Conflit de données
class ConflictError extends AppError {
  constructor(message = 'Conflit de données', code = 'CONFLICT') {
    super(message, code, 409, true);
  }
}

// 429 - Trop de requêtes
class TooManyRequestsError extends AppError {
  constructor(message = 'Trop de requêtes', code = 'RATE_LIMIT') {
    super(message, code, 429, true);
  }
}

// 500 - Erreur serveur
class ServerError extends AppError {
  constructor(message = 'Erreur interne du serveur', code = 'SYS_001', isOperational = false) {
    super(message, code, 500, isOperational);
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  TooManyRequestsError,
  ServerError,
};
