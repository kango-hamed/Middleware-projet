// scripts/analyze-logs.js
const fs = require('fs');
const path = require('path');
const readline = require('readline');

/**
 * Analyse un fichier de log JSON et génère des statistiques
 * @param {string} logFile - Chemin du fichier log à analyser
 */
async function analyzeLogs(logFile) {
  const stats = {
    total: 0,
    byLevel: {},
    byEndpoint: {},
    errors: [],
    avgDuration: 0,
    totalDuration: 0
  };

  // Vérification existence fichier
  if (!fs.existsSync(logFile)) {
    console.error(`❌ Fichier introuvable : ${logFile}`);
    process.exit(1);
  }

  const fileStream = fs.createReadStream(logFile);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    try {
      const log = JSON.parse(line);
      stats.total++;

      // Comptage par niveau
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;

      // Comptage par endpoint
      if (log.context && log.context.url) {
        const endpoint = log.context.url.split('?')[0];
        stats.byEndpoint[endpoint] = (stats.byEndpoint[endpoint] || 0) + 1;
      }

      // Enregistrer les erreurs
      if (log.level === 'ERROR' || log.level === 'CRITICAL') {
        stats.errors.push({
          timestamp: log.timestamp,
          message: log.message,
          error: log.error
        });
      }

      // Calcul de la durée moyenne
      if (log.context && log.context.duration) {
        stats.totalDuration += log.context.duration;
      }
    } catch (err) {
      // Ignorer les lignes non valides
    }
  }

  stats.avgDuration = stats.totalDuration / (stats.total || 1);
  return stats;
}

// === Exécution ===
(async () => {
  const logFile = process.argv[2] || path.join(__dirname, '../logs/app-2025-10-07.log');
  const stats = await analyzeLogs(logFile);

  console.log('\n=== STATISTIQUES DES LOGS ===');
  console.log(`📄 Fichier analysé : ${logFile}`);
  console.log(`🧾 Total d’entrées : ${stats.total}`);

  console.log('\n📊 Par niveau :');
  Object.entries(stats.byLevel).forEach(([level, count]) => {
    console.log(`  - ${level}: ${count}`);
  });

  console.log('\n🔗 Endpoints les plus appelés :');
  Object.entries(stats.byEndpoint)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([endpoint, count]) => {
      console.log(`  - ${endpoint}: ${count}`);
    });

  console.log(`\n⏱️ Durée moyenne : ${stats.avgDuration.toFixed(2)} ms`);
  console.log(`\n🚨 Nombre d’erreurs : ${stats.errors.length}`);
})();
