
// server.js
const app = require('./src/app');
const config = require('./src/config');

const PORT = config.port || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Serveur CinéReserve démarré sur le port ${PORT}`);
});