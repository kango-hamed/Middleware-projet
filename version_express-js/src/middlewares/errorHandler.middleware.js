// src/middlewares/errorHandler.middleware.js
const errorHandler = (err, req, res, next) => {
  // Si l'erreur est déjà formatée (HttpError)
  if (err.statusCode && err.code) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details || [],
      },
    });
  }

  // Erreurs inattendues
  console.error('Erreur non gérée :', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_000',
      message: 'Erreur interne du serveur',
      details: [],
    },
  });
};

module.exports = errorHandler;