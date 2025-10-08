// src/errors/notFoundError.js
const HttpError = require('./httpError');

class NotFoundError extends HttpError {
  constructor(message = 'Ressource introuvable') {
    super(404, 'NOTF_000', message);
  }
}

module.exports = NotFoundError;