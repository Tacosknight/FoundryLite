const { Server } = require('socket.io');
const registerRoomHandlers = require('./roomHandler');
const registerCharHandlers = require('./char.handler');
const registerChatHandlers = require('./chat.handler');
const registerInvHandlers = require('./inv.handler');
const registerMapHandlers = require('./map.handler');

/**
 * Initialise le serveur Socket.io et monte tous les gestionnaires modulaires
 * @param {import('http').Server} httpServer
 */
function initSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    // Gestionnaire des salons et connexions
    registerRoomHandlers(io, socket);
    // Gestionnaire des fiches de personnages et jauges
    registerCharHandlers(io, socket);
    // Gestionnaire du chat et des dés
    registerChatHandlers(io, socket);
    // Gestionnaire de l'inventaire
    registerInvHandlers(io, socket);
    // Gestionnaire de la carte tactique
    registerMapHandlers(io, socket);

    socket.on('error', (err) => {
      console.error(`[Socket.io] Erreur client ${socket.id} :`, err);
    });
  });

  return io;
}

module.exports = initSocketServer;
