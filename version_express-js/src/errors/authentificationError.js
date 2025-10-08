// src/errors/authenticationError.js
const HttpError = require('./httpError');

class AuthenticationError extends HttpError {
  constructor(message = 'Non autorisé') {
    super(401, 'AUTH_000', message);
  }
}

module.exports = AuthenticationError;