// config.js
module.exports = {
  logs: {
    // Répertoire des logs
    directory: './logs',

    // Niveau minimal à logger selon l'environnement
    level: {
      development: 'DEBUG',
      production: 'INFO'
    },

    // Rotation automatique
    maxFileSize: 10 * 1024 * 1024, // 10 MB
    maxArchives: 5,

    // Rétention (suppression après X jours)
    retentionDays: 30,

    // Console
    consoleEnabled: process.env.NODE_ENV !== 'production',
    consoleColors: true,

    // Types de fichiers à générer
    files: {
      app: true,
      error: true,
      access: true,
      security: true
    }
  }
};
