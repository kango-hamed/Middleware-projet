// src/routes/films.routes.js
const express = require('express');
const filmsController = require('../controllers/films.controller');

const router = express.Router();

router.get('/', filmsController.getAllFilms);

module.exports = router;