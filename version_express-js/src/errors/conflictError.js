// src/errors/conflictError.js
const HttpError = require('./httpError');

class ConflictError extends HttpError {
  constructor(message = 'Conflit de ressource') {
    super(409, 'CONFLICT_000', message);
  }
}

module.exports = ConflictError;