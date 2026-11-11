'use strict';
require('dotenv').config();
const path = require('node:path');
const { createServer } = require('./src/createServer');
async function main() {
  const port = Number(process.env.PORT || 3000);
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || `http://localhost:${port}`).split(',').map(s => s.trim());
  const instance = await createServer({
    dataDirectory: process.env.DATA_DIRECTORY || path.join(__dirname, 'data'),
    allowedOrigins,
    secureCookies: process.env.SECURE_COOKIES === 'true'
  });
  instance.server.listen(port, () => console.log(`Foundry Lite : http://localhost:${port}`));
  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    try { await instance.close(); process.exitCode = 0; }
    catch (error) { console.error('Échec de la sauvegarde à l’arrêt :', error.message); process.exitCode = 1; }
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
if (require.main === module) main().catch(error => { console.error('Démarrage refusé :', error.message); process.exitCode = 1; });
module.exports = { main };
