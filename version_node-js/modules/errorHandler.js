// modules/errorHandler.js

const {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  TooManyRequestsError,
  ServerError,
} = require('./errors');

/**
 * Formate une erreur en objet standardisé
 */
function formatError(error) {
  // 1. Si c’est déjà une AppError → on garde
  if (error instanceof AppError) {
    return error;
  }

  // 2. Si c’est une erreur JSON invalide
  if (error instanceof SyntaxError && error.message.includes('JSON')) {
    return new ValidationError('Corps JSON invalide', 'VAL_002');
  }

  // 3. TypeError ou ReferenceError → Erreur interne
  if (error instanceof TypeError || error instanceof ReferenceError) {
    return new ServerError('Erreur interne du serveur', 'SYS_001');
  }

  // 4. Si c’est juste une chaîne
  if (typeof error === 'string') {
    return new ServerError(error, 'SYS_000');
  }

  // 5. Cas inconnu → ServerError par défaut
  return new ServerError('Erreur interne inattendue', 'SYS_000');
}

/**
 * Gère globalement les erreurs et renvoie une réponse formatée
 */
function handleError(error, req, res) {
  const formatted = formatError(error);

  const response = {
    success: false,
    error: {
      code: formatted.code || 'SYS_000',
      message: formatted.message,
    },
    requestId: req?.id || 'N/A',
    timestamp: formatted.timestamp || new Date().toISOString(),
  };

  // Logger enrichi (console.log pour simplifier ici)
  console.error('--- ERREUR ---');
  console.error(`Type: ${formatted.name}`);
  console.error(`Code: ${formatted.code}`);
  console.error(`Message: ${formatted.message}`);
  console.error(`URL: ${req?.url || 'N/A'}`);
  console.error(`Méthode: ${req?.method || 'N/A'}`);
  console.error(`User-Agent: ${req?.headers?.['user-agent'] || 'N/A'}`);
  console.error(`IP: ${req?.socket?.remoteAddress || 'N/A'}`);
  if (!formatted.isOperational) {
    console.error('STACK TRACE:');
    console.error(formatted.stack);
  }

  // Réponse JSON au client
  res.writeHead(formatted.statusCode || 500, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(response, null, 2));
}

/**
 * Wrapper pour les fonctions async
 * @param {Function} fn - fonction asynchrone (req, res) => {}
 * @returns {Function} fonction enveloppée qui capture les erreurs
 * (sera réutilisé plus tard - Phase 4)
 */
function asyncHandler(fn) {
  return function (req, res) {
    Promise.resolve(fn(req, res)).catch((err) => handleError(err, req, res));
  };
}

module.exports = { handleError, formatError, asyncHandler };
