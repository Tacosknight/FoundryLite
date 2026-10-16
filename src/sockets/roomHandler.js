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

      // Récupérer le personnage existant du joueur s'il en a déjà un forgé (par socketId ou par nom)
      const roomObj = roomManager.getRoom(cleanRoomId);
      let playerCharacter = null;
      if (roomObj && Array.isArray(roomObj.characters)) {
        playerCharacter = roomObj.characters.find(c => c.socketId === socket.id || (c.name && c.name.toLowerCase() === cleanUsername.toLowerCase())) || null;
        if (playerCharacter) {
          playerCharacter.socketId = socket.id;
          roomManager.triggerAutoSave();
        }
      }

      // Récupérer la liste à jour de tous les personnages de la salle
      const characters = roomManager.getCharacters(cleanRoomId);

      // Notification à tous les clients de la salle avec la liste à jour des personnages
      io.to(cleanRoomId).emit('room:user_joined', {
        user,
        room,
        characters,
        isSaved: Boolean(roomObj?.isSaved)
      });

      // Émettre également l'événement de mise à jour des fiches pour actualiser l'affichage
      io.to(cleanRoomId).emit('char:sync_all', {
        roomId: cleanRoomId,
        characters
      });

      // Réponse directe au client via accusé de réception (callback)
      if (typeof callback === 'function') {
        const mapState = roomManager.getMapState(cleanRoomId);
        callback({
          success: true,
          room,
          user,
          character: playerCharacter,
          characters,
          map: mapState,
          isSaved: Boolean(roomObj?.isSaved)
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

  // Événement de sauvegarde manuelle par le Maître du Jeu (room:save)
  socket.on('room:save', async (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId;
      const isMJ = socket.data?.user?.role === 'mj';

      if (!isMJ) {
        throw new Error('Seul le Maître du Jeu a le privilège de sauvegarder la table.');
      }

      if (!roomId) {
        throw new Error('Identifiant de salle manquant.');
      }

      const savedRoom = await roomManager.saveRoom(roomId);
      io.to(roomId).emit('room:saved', {
        roomId,
        timestamp: new Date().toISOString()
      });

      console.log(`[Socket] 💾 Partie "${roomId}" officiellement sauvegardée par le MJ.`);

      if (typeof callback === 'function') {
        callback({ success: true, room: savedRoom });
      }
    } catch (err) {
      console.error(`[Socket Error] Erreur room:save :`, err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  // Gestion de la déconnexion
  socket.on('disconnect', async () => {
    try {
      const result = await roomService.removeUser(socket.id);
      if (result) {
        const { roomId, user, room } = result;
        console.log(`[Socket] ${user.username} (${user.role}) a quitté la salle "${roomId}"`);

        const roomObj = roomManager.getRoom(roomId);
        const isSaved = Boolean(roomObj && roomObj.isSaved);

        // Si le MJ quitte la partie
        if (user.role === 'mj') {
          console.log(`[Socket] 👑 Le MJ a quitté la salle "${roomId}". isSaved = ${isSaved}`);

          // Informer et déconnecter tous les clients de la salle
          io.to(roomId).emit('room:closed_by_mj', {
            roomId,
            message: isSaved 
              ? 'Le Maître du Jeu a mis fin à la session. La partie est sauvegardée ! Vous pourrez la reprendre avec le même nom de héros.' 
              : 'Le Maître du Jeu a quitté la partie sans sauvegarder. La salle et ses données ont été effacées.'
          });

          // Déconnecter tous les sockets connectés à cette salle
          const socketsInRoom = await io.in(roomId).fetchSockets();
          for (const s of socketsInRoom) {
            if (s.id !== socket.id) {
              s.leave(roomId);
              s.data.roomId = null;
            }
          }

          // Si la partie n'était PAS sauvegardée, détruire toutes ses données
          if (!isSaved) {
            await roomManager.deleteRoom(roomId);
            await roomService.deleteRoom(roomId);
            console.log(`[Socket] 🧹 Nettoyage complet : salle "${roomId}" effacée de la mémoire.`);
          }
          return;
        }

        // Si c'est un joueur qui se déconnecte :
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
