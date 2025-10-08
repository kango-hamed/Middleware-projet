// src/middlewares/validator.middleware.js
const { validationResult } = require('express-validator');
const ValidationError = require('../errors/validationError');

const validator = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(e => e.msg);
    return next(new ValidationError('Validation échouée', errorMessages));
  }

  next();
};

module.exports = validator;