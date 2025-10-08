// src/controllers/auth.controller.js
const usersData = require('../data/users.json');
const config = require('../config');
const { generateToken } = require('../utils/jwt.util');
const AuthenticationError = require('../errors/authentificationError');

const login = (req, res, next) => {
  try {
    const { username, password } = req.body;

    const user = usersData.find(
      u => u.username === username && u.password === password
    );

    if (!user) {
      throw new AuthenticationError('Identifiants invalides');
    }

    const token = generateToken({ id: user.id, username: user.username });

    res.status(200).json({
      success: true,
      data: {
        token,
        expiresIn: config.jwtExpiresIn,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { login };