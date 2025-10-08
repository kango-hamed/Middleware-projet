// src/controllers/reservations.controller.js
const fs = require('fs');
const path = require('path');
const filmsPath = path.join(__dirname, '../data/films.json');
const NotFoundError = require('../errors/notFoundError');
const ConflictError = require('../errors/conflictError');
const reservationService = require('../services/reservations.service');

const createReservation = async (req, res, next) => {
  try {
    const { filmId, places } = req.body;
    const userId = req.user.id;

    // Lecture des films
    const films = JSON.parse(fs.readFileSync(filmsPath, 'utf8'));
    const film = films.find(f => f.id === filmId);

    if (!film) {
      throw new NotFoundError(`Film avec ID ${filmId} introuvable`);
    }

    if (film.placesDisponibles < places) {
      throw new ConflictError(`Seulement ${film.placesDisponibles} places disponibles`);
    }

    // Mise à jour des places
    film.placesDisponibles -= places;
    fs.writeFileSync(filmsPath, JSON.stringify(films, null, 2));

    // Enregistrement de la réservation (simulé)
    await reservationService.saveReservation({ userId, filmId, places });

    res.status(201).json({
      success: true,
      data: {
        message: 'Réservation créée avec succès',
        reservation: { filmId, places, userId },
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createReservation };