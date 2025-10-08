// src/controllers/films.controller.js
const filmsData = require('../data/films.json');

const getAllFilms = (req, res, next) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;
    let films = [...filmsData];

    // Recherche par titre
    if (q) {
      const query = q.toLowerCase();
      films = films.filter(film =>
        film.titre.toLowerCase().includes(query) ||
        film.realisateur.toLowerCase().includes(query)
      );
    }

    // Pagination
    const total = films.length;
    const startIndex = (page - 1) * limit;
    const paginatedFilms = films.slice(startIndex, startIndex + limit);

    res.status(200).json({
      success: true,
      data: {
        films: paginatedFilms,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAllFilms };