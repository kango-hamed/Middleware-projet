// src/app.js
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('./middlewares/rateLimit.middleware');
const logger = require('./middlewares/logger.middleware');
const errorHandler = require('./middlewares/errorHandler.middleware');

// Routes
const filmsRoutes = require('./routes/films.routes');
const authRoutes = require('./routes/auth.routes');
const reservationsRoutes = require('./routes/reservations.routes');

const app = express();

// === Middlewares globaux ===

// Sécurité
app.use(helmet());

// CORS
app.use(cors());

// Limitation de débit
app.use(rateLimit);

// Parsing JSON
app.use(express.json());

// Logging (morgan + custom)
app.use(morgan('combined')); // Optionnel : pour logs formatés
app.use(logger); // Middleware personnalisé avec durée

// === Routes ===
app.use('/films', filmsRoutes);
app.use('/login', authRoutes);
app.use('/reservations', reservationsRoutes);

// === Gestion globale des erreurs ===
app.use(errorHandler);

module.exports = app;