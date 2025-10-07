/**
 * Module de hashage et vérification des mots de passe
 * Utilise l’API crypto native de Node.js (aucun package externe)
 */

const crypto = require('crypto');

/**
 * Génère un sel unique pour chaque utilisateur
 * @returns {string} sel aléatoire hexadécimal
 */
function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Hash un mot de passe avec un sel
 * @param {string} password - Mot de passe en clair
 * @param {string} salt - Sel unique
 * @returns {string} hash hexadécimal
 */
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

/**
 * Vérifie si un mot de passe correspond au hash enregistré
 * @param {string} password - Mot de passe entré
 * @param {string} hash - Hash stocké
 * @param {string} salt - Sel stocké
 * @returns {boolean} true si correspondance, sinon false
 */
function verifyPassword(password, hash, salt) {
  const hashed = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(hashed, 'hex'));
}

module.exports = {
  generateSalt,
  hashPassword,
  verifyPassword
};
