// src/config/index.js
require('dotenv').config();

module.exports = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  jwtSecret: process.env.ACCESS_TOKEN_SECRET || 'fallback_secret_change_in_production',
  jwtExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '1h',
};