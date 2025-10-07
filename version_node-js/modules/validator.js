// modules/validator.js
const { ValidationError } = require('./errors');

/**
 * Vérifie le type d'une valeur
 */
function validateType(value, expectedType) {
  const actualType = Array.isArray(value) ? 'array' : typeof value;
  return actualType === expectedType;
}

/**
 * Vérifie la longueur d'une chaîne ou d'un tableau
 */
function validateLength(value, minLength, maxLength) {
  if (typeof value === 'string' || Array.isArray(value)) {
    if (minLength && value.length < minLength) return false;
    if (maxLength && value.length > maxLength) return false;
  }
  return true;
}

/**
 * Vérifie qu’un nombre est dans une plage
 */
function validateRange(value, min, max) {
  if (typeof value === 'number') {
    if (min !== undefined && value < min) return false;
    if (max !== undefined && value > max) return false;
  }
  return true;
}

/**
 * Vérifie qu’une chaîne correspond à une regex
 */
function validatePattern(value, pattern) {
  if (typeof value === 'string' && pattern instanceof RegExp) {
    return pattern.test(value);
  }
  return true;
}

/**
 * Nettoie une chaîne (supprime caractères dangereux)
 */
function sanitizeString(value) {
  if (typeof value !== 'string') return value;
  return value
    .trim()
    .replace(/[<>&"']/g, (char) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[char])
    )
    .replace(/\x00/g, ''); // null bytes
}

/**
 * Nettoie toutes les données selon leur type
 */
function sanitize(data) {
  const sanitized = {};
  for (const key in data) {
    const val = data[key];
    if (typeof val === 'string') sanitized[key] = sanitizeString(val);
    else if (typeof val === 'number') sanitized[key] = Number(val);
    else if (typeof val === 'boolean') sanitized[key] = val;
    else sanitized[key] = val;
  }
  return sanitized;
}

/**
 * Fonction principale : validate(data, schema)
 */
function validate(data, schema) {
  const errors = [];
  const sanitizedData = sanitize(data);

  for (const field in schema) {
    const rules = schema[field];
    const value = sanitizedData[field];

    // Champ obligatoire
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push({
        field,
        code: 'VAL_001',
        message: `Le champ ${field} est requis`,
      });
      continue;
    }

    // Si pas de valeur et pas requis → skip
    if (value === undefined || value === null) continue;

    // Type
    if (rules.type && !validateType(value, rules.type)) {
      errors.push({
        field,
        code: 'VAL_004',
        message: `Le champ ${field} doit être de type ${rules.type}`,
      });
    }

    // Longueur
    if (!validateLength(value, rules.minLength, rules.maxLength)) {
      errors.push({
        field,
        code: 'VAL_003',
        message: `La longueur de ${field} doit être comprise entre ${rules.minLength} et ${rules.maxLength}`,
      });
    }

    // Plage de valeurs (pour les nombres)
    if (!validateRange(value, rules.min, rules.max)) {
      errors.push({
        field,
        code: 'VAL_003',
        message: `${field} doit être compris entre ${rules.min} et ${rules.max}`,
      });
    }

    // Regex
    if (!validatePattern(value, rules.pattern)) {
      errors.push({
        field,
        code: 'VAL_002',
        message: `Le format de ${field} est invalide`,
      });
    }

    // Enum
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push({
        field,
        code: 'VAL_002',
        message: `${field} doit être l'une des valeurs suivantes : ${rules.enum.join(', ')}`,
      });
    }

    // Validation personnalisée
    if (typeof rules.custom === 'function' && !rules.custom(value)) {
      errors.push({
        field,
        code: 'VAL_003',
        message: `${field} ne respecte pas la règle personnalisée`,
      });
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Erreur de validation', 'VAL_000', errors);
  }

  return { valid: true, data: sanitizedData };
}

module.exports = {
  validate,
  sanitize,
  validateType,
  validateLength,
  validateRange,
  validatePattern,
};
