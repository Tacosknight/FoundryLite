const roomService = require('../services/roomService');
const roomManager = require('../state/RoomManager');

/**
 * Gestionnaire des événements Socket.io pour les salons
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
function registerRoomHandlers(io, socket) {
  // Événement pour rejoindre un salon
  socket.on('room:join', async (data, callback) => {
    try {
      const { roomId, username, role } = data || {};

      if (!roomId || typeof roomId !== 'string' || !roomId.trim()) {
        throw new Error('Identifiant de salle (roomId) invalide ou manquant.');
      }

      if (!username || typeof username !== 'string' || !username.trim()) {
        throw new Error('Pseudo (username) invalide ou manquant.');
      }

      const cleanRoomId = roomId.trim();
      const cleanUsername = username.trim();

      // Enregistrement via le service
      const { room, user } = await roomService.joinRoom(cleanRoomId, {
        socketId: socket.id,
        username: cleanUsername,
        role
      });

      // Rejoindre le channel Socket.io
      socket.join(cleanRoomId);

      // Associer la salle au socket pour le nettoyage au disconnect
      socket.data.roomId = cleanRoomId;
      socket.data.user = user;

      console.log(`[Socket] ${user.username} (${user.role}) a rejoint la salle "${cleanRoomId}"`);

      // Si c'est le MJ qui rejoint, s'assurer qu'aucun personnage fantôme non créé n'est présent
      if (user.role === 'mj') {
        const roomObj = roomManager.getRoom(cleanRoomId);
        if (roomObj && Array.isArray(roomObj.characters)) {
          // Conserver uniquement les vrais héros forgés par les joueurs
          roomObj.characters = roomObj.characters.filter((c) => c && c.created);
          roomObj.characters.forEach((c, idx) => { c.slot = idx; });
          roomManager.triggerAutoSave();
        }
      }

      // Récupérer le personnage existant du joueur s'il en a déjà un forgé
      const roomObj = roomManager.getRoom(cleanRoomId);
      const playerCharacter = (roomObj.characters || []).find(c => c.socketId === socket.id) || null;

      // Récupérer la liste à jour de tous les personnages de la salle
      const characters = roomManager.getCharacters(cleanRoomId);

      // Notification à tous les clients de la salle avec la liste à jour des personnages
      io.to(cleanRoomId).emit('room:user_joined', {
        user,
        room,
        characters
      });

      // Émettre également l'événement de mise à jour des fiches pour actualiser l'affichage
      io.to(cleanRoomId).emit('char:sync_all', {
        roomId: cleanRoomId,
        characters
      });

      // Réponse directe au client via accusé de réception (callback)
      if (typeof callback === 'function') {
        callback({
          success: true,
          room,
          user,
          character: playerCharacter,
          characters
        });
      }
    } catch (error) {
      console.error(`[Socket Error] Échec de room:join sur ${socket.id} :`, error.message);
      if (typeof callback === 'function') {
        callback({
          success: false,
          error: error.message
        });
      }
    }
  });

  // Gestion de la déconnexion
  socket.on('disconnect', async () => {
    try {
      const result = await roomService.removeUser(socket.id);
      if (result) {
        const { roomId, user, room } = result;
        console.log(`[Socket] ${user.username} a quitté la salle "${roomId}" (déconnexion)`);

        // Retirer le personnage du joueur déconnecté
        if (user.role === 'player') {
          roomManager.removePlayerCharacter(roomId, socket.id);
        }

        const characters = roomManager.getCharacters(roomId);

        io.to(roomId).emit('room:user_left', {
          user,
          room,
          characters
        });

        io.to(roomId).emit('char:sync_all', {
          roomId,
          characters
        });
      }
    } catch (error) {
      console.error(`[Socket Error] Erreur déconnexion pour ${socket.id} :`, error.message);
    }
  });
}

module.exports = registerRoomHandlers;
