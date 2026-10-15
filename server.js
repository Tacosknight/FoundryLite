require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');

const initSocketServer = require('./src/sockets');
const uploadRoutes = require('./src/routes/uploadRoutes');
const roomService = require('./src/services/roomService');
const roomManager = require('./src/state/RoomManager');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

// ==========================================
// Middlewares Express
// ==========================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir les fichiers statiques du dossier /public (inclut /public/uploads)
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// Routes API
// ==========================================
app.use('/api', uploadRoutes);

// Route de vérification de santé (Health Check)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// Gestion globale des erreurs Express
// ==========================================
app.use((err, req, res, next) => {
  console.error('[Express Error]', err.stack || err.message);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Erreur interne du serveur.'
  });
});

// ==========================================
// Initialisation Socket.io & Démarrage
// ==========================================
initSocketServer(server);

// Initialiser les services de persistance puis démarrer le serveur HTTP
Promise.all([roomService.init(), roomManager.init()])
  .then(() => {
    server.listen(PORT, () => {
      console.log(`===============================================`);
      console.log(`🚀 Serveur VTT démarré sur http://localhost:${PORT}`);
      console.log(`📁 Fichiers statiques servis depuis /public`);
      console.log(`⚡ Socket.io prêt pour les connexions temps réel`);
      console.log(`===============================================`);
    });
  })
  .catch((err) => {
    console.error('Erreur critique lors de l\'initialisation du serveur :', err);
    process.exit(1);
  });

// Sauvegarde immédiate lors d'un arrêt propre du serveur
const shutdown = async () => {
  console.log('\nArrêt du serveur... Sauvegarde de l\'état.');
  await roomManager.flush();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
