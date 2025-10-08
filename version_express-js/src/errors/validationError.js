// src/errors/validationError.js
const HttpError = require('./httpError');

class ValidationError extends HttpError {
  constructor(message = 'Requête invalide', details = []) {
    super(400, 'VAL_000', message, details);
  }
}

module.exports = ValidationError;