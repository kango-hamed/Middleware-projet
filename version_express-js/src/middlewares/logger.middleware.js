// src/middlewares/logger.middleware.js
const logger = (req, res, next) => {
  const start = Date.now();

  // Écoute la fin de la réponse pour calculer la durée
  res.on('finish', () => {
    const duration = Date.now() - start;
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`
    );
  });

  next();
};

module.exports = logger;