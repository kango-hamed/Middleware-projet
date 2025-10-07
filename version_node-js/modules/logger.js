// modules/logger.js
const fs = require('fs');
const path = require('path');

// --- Définition des niveaux de log ---
const LOG_LEVELS = {
  DEBUG: { value: 0, label: 'DEBUG', color: '\x1b[36m' },    // Cyan
  INFO: { value: 1, label: 'INFO', color: '\x1b[32m' },      // Vert
  WARN: { value: 2, label: 'WARN', color: '\x1b[33m' },      // Jaune
  ERROR: { value: 3, label: 'ERROR', color: '\x1b[31m' },    // Rouge
  CRITICAL: { value: 4, label: 'CRITICAL', color: '\x1b[35m' } // Magenta
};

// Niveau actif selon l'environnement
const CURRENT_LOG_LEVEL =
  process.env.NODE_ENV === 'production'
    ? LOG_LEVELS.INFO.value
    : LOG_LEVELS.DEBUG.value;

function log(level, message, context = {}, error = null) {
  const levelValue = LOG_LEVELS[level]?.value;
  if (levelValue === undefined || levelValue < CURRENT_LOG_LEVEL) return;

  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
    error: error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      : null,
  };

  // Afficher dans la console (si en dev)
  writeToConsole(logEntry);

  // Écrire dans les fichiers correspondants
  const filePaths = getLogFilePaths(level, context);

  filePaths.forEach((filePath) => {
    writeToFile(filePath, logEntry);
  });
}


function writeToConsole(logEntry) {
  // Ne rien afficher en production
  if (process.env.NODE_ENV === 'production') return;

  const color = LOG_LEVELS[logEntry.level].color;
  const reset = '\x1b[0m';

  console.log(
    `${color}[${logEntry.timestamp}] ${logEntry.level}:${reset}`,
    logEntry.message,
    logEntry.context
  );

  // Si c’est une erreur, afficher le stack trace
  if (logEntry.error) {
    console.error(logEntry.error.stack);
  }
}

function writeToFile(filePath, logEntry) {
  const logLine = JSON.stringify(logEntry) + '\n';

  fs.appendFile(filePath, logLine, 'utf8', (err) => {
    if (err) {
      console.error('Erreur écriture log:', err.message);
    }
  });
}

function getLogFilePaths(level, context) {
  const date = new Date().toISOString().split('T')[0]; // ex: 2025-10-07
  const logDir = path.join(__dirname, '..', 'logs');
  const files = [];

  // Tous les logs vont dans app.log
  files.push(path.join(logDir, `app-${date}.log`));

  // Les erreurs vont aussi dans error.log
  if (level === 'ERROR' || level === 'CRITICAL') {
    files.push(path.join(logDir, `error-${date}.log`));
  }

  // Les requêtes HTTP vont dans access.log
  if (context.method && context.url) {
    files.push(path.join(logDir, `access-${date}.log`));
  }

  // Les événements de sécurité vont dans security.log
  if (context.security || level === 'CRITICAL') {
    files.push(path.join(logDir, `security-${date}.log`));
  }

  return files;
}

function shouldRotate(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const stats = fs.statSync(filePath);
  const maxSize = 10 * 1024 * 1024; // 10 MB
  return stats.size >= maxSize;
}

function rotateLogFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const archiveDir = path.join(path.dirname(filePath), 'archives');

  // Créer le dossier archives s'il n'existe pas
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }

  const fileName = path.basename(filePath);
  let archiveNumber = 1;
  let archivePath;

  do {
    archivePath = path.join(archiveDir, `${fileName}.${archiveNumber}`);
    archiveNumber++;
  } while (fs.existsSync(archivePath));

  // Déplacer le fichier vers archives
  fs.renameSync(filePath, archivePath);

  console.log(`Log archivé : ${archivePath}`);
}

function checkAndRotateLogs() {
  const logDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logDir)) return;

  const files = fs.readdirSync(logDir)
    .filter(file => file.endsWith('.log'))
    .map(file => path.join(logDir, file));

  files.forEach(filePath => {
    if (shouldRotate(filePath)) {
      rotateLogFile(filePath);
    }
  });
}

// Vérifier automatiquement toutes les heures
setInterval(checkAndRotateLogs, 60 * 60 * 1000);

function cleanOldLogs(retentionDays = 30) {
  const logDir = path.join(__dirname, '..', 'logs');
  const archiveDir = path.join(logDir, 'archives');
  const now = Date.now();
  const maxAge = retentionDays * 24 * 60 * 60 * 1000;

  // Nettoyer le dossier principal
  cleanDirectory(logDir, maxAge, now);

  // Nettoyer le dossier des archives
  if (fs.existsSync(archiveDir)) {
    cleanDirectory(archiveDir, maxAge, now);
  }
}

function cleanDirectory(dir, maxAge, now) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);

    if (stats.isFile() && (now - stats.mtimeMs) > maxAge) {
      fs.unlinkSync(filePath);
      console.log(`🧽 Log supprimé : ${filePath}`);
    }
  });
}

function scheduleCleanup() {
  const now = new Date();
  const next3AM = new Date(now);
  next3AM.setHours(3, 0, 0, 0);

  // Si on a déjà dépassé 3h aujourd’hui → planifier pour demain
  if (next3AM <= now) {
    next3AM.setDate(next3AM.getDate() + 1);
  }

  const timeUntil3AM = next3AM - now;

  setTimeout(() => {
    cleanOldLogs(30); // suppression automatique des logs vieux de 30 jours
    setInterval(() => cleanOldLogs(30), 24 * 60 * 60 * 1000); // ensuite chaque jour
  }, timeUntil3AM);
}

function generateRequestId() {
  const crypto = require('crypto');
  return crypto.randomBytes(16).toString('hex'); // identifiant aléatoire de 32 caractères
}

function extractHttpContext(req) {
  return {
    method: req.method,
    url: req.url,
    ip: req.socket.remoteAddress || req.headers['x-forwarded-for'],
    userAgent: req.headers['user-agent'] || 'unknown',
    referer: req.headers['referer'] || null,
    contentLength: req.headers['content-length'] || 0,
  };
}

function logHttpRequest(req, res) {
  const startTime = Date.now();

  // Générer un requestId unique
  req.requestId = generateRequestId();

  // Extraire le contexte HTTP
  const context = extractHttpContext(req);
  context.requestId = req.requestId;

  // Log de début de requête
  log('DEBUG', `Requête entrante : ${req.method} ${req.url}`, context);

  // Capturer la fin de la réponse
  const originalEnd = res.end;
  res.end = function (...args) {
    const duration = Date.now() - startTime;
    context.statusCode = res.statusCode;
    context.duration = duration;

    // Déterminer le niveau de log selon le code HTTP
    let level = 'INFO';
    if (res.statusCode >= 500) level = 'ERROR';
    else if (res.statusCode >= 400) level = 'WARN';

    log(level, `Requête terminée : ${req.method} ${req.url}`, context);

    originalEnd.apply(res, args);
  };
}

// --- Événements de sécurité possibles ---
const SECURITY_EVENTS = {
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILED: 'login_failed',
  LOGOUT: 'logout',
  SIGNUP: 'signup',
  PASSWORD_CHANGE: 'password_change',
  RATE_LIMIT_HIT: 'rate_limit_hit',
  BRUTE_FORCE_DETECTED: 'brute_force_detected',
  INVALID_TOKEN: 'invalid_token',
  UNAUTHORIZED_ACCESS: 'unauthorized_access',
  SUSPICIOUS_REQUEST: 'suspicious_request'
};

function logSecurity(eventType, details, req = null) {
  const context = {
    security: true,
    event: eventType,
    ...details
  };

  // Ajouter le contexte HTTP si une requête est passée
  if (req) {
    Object.assign(context, extractHttpContext(req));
    context.requestId = req.requestId;
  }

  // Déterminer le niveau selon la gravité de l'événement
  let level = 'INFO';

  if (
    eventType === SECURITY_EVENTS.BRUTE_FORCE_DETECTED ||
    eventType === SECURITY_EVENTS.UNAUTHORIZED_ACCESS
  ) {
    level = 'CRITICAL';
  } else if (
    eventType === SECURITY_EVENTS.LOGIN_FAILED ||
    eventType === SECURITY_EVENTS.INVALID_TOKEN
  ) {
    level = 'WARN';
  }

  // Enregistrer le log
  log(level, `Événement de sécurité : ${eventType}`, context);
}

function initLogger() {
  const config = require('../config');
  const logDir = path.join(__dirname, '..', config.logs.directory);

  // Créer le dossier logs s’il n’existe pas
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Créer le dossier archives
  const archiveDir = path.join(logDir, 'archives');
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }

  // Démarrer la rotation automatique (toutes les heures)
  setInterval(checkAndRotateLogs, 60 * 60 * 1000);

  // Démarrer le nettoyage planifié (tous les jours à 3h)
  scheduleCleanup();

  // Log d’initialisation
  log('INFO', 'Système de logging initialisé', {
    directory: logDir,
    level: config.logs.level[process.env.NODE_ENV || 'development'],
    retentionDays: config.logs.retentionDays
  });
}


// Démarrage automatique de la planification
scheduleCleanup();


module.exports = {
  LOG_LEVELS,
  CURRENT_LOG_LEVEL,
  log,
  checkAndRotateLogs,
  cleanOldLogs,
  scheduleCleanup,
  generateRequestId,
  extractHttpContext,
  logHttpRequest,
  SECURITY_EVENTS,
  logSecurity,
  initLogger
};


