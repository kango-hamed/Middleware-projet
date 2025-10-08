// src/routes/reservations.routes.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const authMiddleware = require('../middlewares/auth.middleware.js');
const validator = require('../middlewares/validator.middleware');
const reservationsController = require('../controllers/reservations.controller');

const router = express.Router();

// Validation
const reservationValidation = [
  body('filmId').isInt({ min: 1 }).withMessage('filmId doit être un entier positif'),
  body('places').isInt({ min: 1, max: 10 }).withMessage('places doit être entre 1 et 10'),
  validator,
];

router.post(
  '/',
  authMiddleware,
  reservationValidation,
  reservationsController.createReservation
);

module.exports = router;