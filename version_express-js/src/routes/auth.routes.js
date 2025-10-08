// src/routes/auth.routes.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/auth.controller');
const validator = require('../middlewares/validator.middleware');

const router = express.Router();

// Validation des données de login
const loginValidation = [
  body('username').notEmpty().withMessage('Le nom d’utilisateur est requis'),
  body('password').notEmpty().withMessage('Le mot de passe est requis'),
  validator,
];

router.post('/', loginValidation, authController.login);

module.exports = router;