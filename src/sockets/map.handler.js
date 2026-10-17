const roomManager = require('../state/RoomManager');
const roomService = require('../services/roomService');

/**
 * Vérifie si le socket appelant est le Maître du Jeu (MJ/GM)
 * @param {import('socket.io').Socket} socket 
 * @param {string} roomId 
 * @param {string} [roleHint] 
 * @returns {boolean}
 */
function isUserMJ(socket, roomId, roleHint) {
  if (roleHint === 'mj' || roleHint === 'gm') return true;
  if (socket.data?.user?.role === 'mj' || socket.data?.user?.role === 'gm') return true;
  const room = roomService.getRoom(roomId);
  const user = room?.users?.find((u) => u.socketId === socket.id);
  return user?.role === 'mj' || user?.role === 'gm';
}

/**
 * Récupère le personnage associé au joueur appelant
 * @param {import('socket.io').Socket} socket 
 * @param {string} roomId 
 */
function getPlayerCharacter(socket, roomId) {
  const room = roomManager.getRoom(roomId);
  if (!room || !Array.isArray(room.characters)) return null;
  return room.characters.find((c) => c.socketId === socket.id) || null;
}

/**
 * Enregistre les gestionnaires d'événements de la carte tactique
 * @param {import('socket.io').Server} io 
 * @param {import('socket.io').Socket} socket 
 */
function registerMapHandlers(io, socket) {
  /**
   * Récupération de l'état de la carte (map:get_state)
   */
  socket.on('map:get_state', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const mapState = roomManager.getMapState(roomId);
      if (typeof callback === 'function') {
        callback({ success: true, map: mapState });
      }
    } catch (err) {
      console.error('[MapHandler Error] map:get_state :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Changement de l'image de fond de la Battlemap (map:set_background) - Réservé au MJ
   */
  socket.on('map:set_background', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { backgroundUrl, role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        throw new Error('Seul le Maître du Jeu peut changer le fond de la carte.');
      }

      const updatedUrl = roomManager.updateMapBackground(roomId, backgroundUrl || null);

      // Notification globale à tous les clients connectés
      io.to(roomId).emit('map:background_updated', {
        roomId,
        backgroundUrl: updatedUrl
      });

      console.log(`[MapHandler] 🗺️ Fond de carte mis à jour pour "${roomId}" : ${updatedUrl || 'Par défaut'}`);

      if (typeof callback === 'function') {
        callback({ success: true, backgroundUrl: updatedUrl });
      }
    } catch (err) {
      console.error('[MapHandler Error] map:set_background :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Déplacement d'un pion sur la carte (map:move_token)
   * Broadcast aux autres clients avec socket.to(roomId) pour éviter l'écho chez l'émetteur
   */
  socket.on('map:move_token', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { tokenId, x, y, role } = data || {};

      if (!tokenId) {
        throw new Error('Identifiant de pion manquant.');
      }
      if (typeof x !== 'number' || typeof y !== 'number') {
        throw new Error('Coordonnées de pion invalides.');
      }

      const isMJ = isUserMJ(socket, roomId, role);
      const room = roomManager.getRoom(roomId);
      const mapState = roomManager.getMapState(roomId);
      const token = mapState.tokens.find((t) => t.id === tokenId);

      if (!token) {
        throw new Error(`Pion introuvable : ${tokenId}`);
      }

      // Si le client n'est pas MJ, il ne peut déplacer que son propre pion
      if (!isMJ) {
        const myChar = getPlayerCharacter(socket, roomId);
        if (!myChar) {
          throw new Error('Vous devez avoir un personnage actif pour déplacer un pion.');
        }
        const isOwner = token.type === 'player' && (token.slot === myChar.slot || (token.name && token.name.toLowerCase() === myChar.name.toLowerCase()));
        if (!isOwner) {
          throw new Error('Action refusée : vous ne pouvez déplacer que votre propre pion.');
        }
      }

      const updatedToken = roomManager.moveToken(roomId, tokenId, x, y);

      // Diffusion aux autres clients (SAUF l'émetteur) pour une réactivité instantanée
      socket.to(roomId).emit('map:token_moved', {
        roomId,
        tokenId,
        x: updatedToken.x,
        y: updatedToken.y
      });

      if (typeof callback === 'function') {
        callback({ success: true, token: updatedToken });
      }
    } catch (err) {
      console.error('[MapHandler Error] map:move_token :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Ajout d'un pion Monstre / PNJ par le MJ (map:add_token)
   */
  socket.on('map:add_token', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { token: tokenData, role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        throw new Error('Seul le Maître du Jeu peut ajouter des monstres sur la carte.');
      }

      if (!tokenData || !tokenData.name) {
        throw new Error('Données de pion invalides.');
      }

      const newToken = roomManager.addToken(roomId, tokenData);

      io.to(roomId).emit('map:token_added', {
        roomId,
        token: newToken
      });

      console.log(`[MapHandler] 👹 Pion monstre ajouté "${newToken.name}" dans "${roomId}" à (${newToken.x}, ${newToken.y})`);

      if (typeof callback === 'function') {
        callback({ success: true, token: newToken });
      }
    } catch (err) {
      console.error('[MapHandler Error] map:add_token :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Suppression d'un pion par le MJ (map:remove_token)
   */
  socket.on('map:remove_token', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { tokenId, role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        throw new Error('Seul le Maître du Jeu peut retirer des pions de la carte.');
      }

      if (!tokenId) {
        throw new Error('Identifiant de pion manquant.');
      }

      const removed = roomManager.removeToken(roomId, tokenId);

      if (removed) {
        io.to(roomId).emit('map:token_removed', {
          roomId,
          tokenId
        });
        console.log(`[MapHandler] 🗑️ Pion retiré "${tokenId}" dans "${roomId}"`);
      }

      if (typeof callback === 'function') {
        callback({ success: true, tokenId });
      }
    } catch (err) {
      console.error('[MapHandler Error] map:remove_token :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Révélation d'une zone du brouillard de guerre par le MJ (map:reveal_fog)
   */
  socket.on('map:reveal_fog', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { area, role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        throw new Error('Seul le Maître du Jeu peut dissiper le brouillard de guerre.');
      }

      if (!area || typeof area !== 'object') {
        throw new Error('Zone géométrique invalide.');
      }

      const revealedArea = roomManager.revealFog(roomId, area);

      io.to(roomId).emit('map:fog_revealed', {
        roomId,
        area: revealedArea
      });

      if (typeof callback === 'function') {
        callback({ success: true, area: revealedArea });
      }
    } catch (err) {
      console.error('[MapHandler Error] map:reveal_fog :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Réinitialisation complète du brouillard de guerre par le MJ (map:reset_fog)
   */
  socket.on('map:reset_fog', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        throw new Error('Seul le Maître du Jeu peut réinitialiser le brouillard de guerre.');
      }

      roomManager.resetFog(roomId);

      io.to(roomId).emit('map:fog_reset', { roomId });

      console.log(`[MapHandler] 🌫️ Brouillard réinitialisé dans "${roomId}"`);

      if (typeof callback === 'function') {
        callback({ success: true });
      }
    } catch (err) {
      console.error('[MapHandler Error] map:reset_fog :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Mise à jour des paramètres de carte (grille, aimantation, activation brouillard) (map:update_settings)
   */
  socket.on('map:update_settings', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { settings, role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        throw new Error('Seul le Maître du Jeu peut modifier les réglages de la carte.');
      }

      const updatedMap = roomManager.updateMapSettings(roomId, settings);

      io.to(roomId).emit('map:settings_updated', {
        roomId,
        gridSize: updatedMap.gridSize,
        snapToGrid: updatedMap.snapToGrid,
        fogEnabled: updatedMap.fogEnabled
      });

      if (typeof callback === 'function') {
        callback({ success: true, map: updatedMap });
      }
    } catch (err) {
      console.error('[MapHandler Error] map:update_settings :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Invocation / Placement d'un pion joueur par le MJ (map:spawn_player_token)
   */
  socket.on('map:spawn_player_token', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { slot, x, y, role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        throw new Error('Seul le Maître du Jeu peut invoquer des pions de joueurs.');
      }

      const token = roomManager.spawnPlayerToken(roomId, slot, x, y);

      io.to(roomId).emit('map:token_added', {
        roomId,
        token
      });

      console.log(`[MapHandler] 🧙 Pion joueur invoqué : "${token.name}" (Slot #${slot}) à (${token.x}, ${token.y})`);

      if (typeof callback === 'function') {
        callback({ success: true, token });
      }
    } catch (err) {
      console.error('[MapHandler Error] map:spawn_player_token :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Invocation groupée de tous les joueurs sur la carte (map:spawn_all_players)
   */
  socket.on('map:spawn_all_players', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { startX, startY, role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        throw new Error('Seul le Maître du Jeu peut invoquer les pions de joueurs.');
      }

      const spawnedTokens = roomManager.spawnAllPlayerTokens(roomId, startX, startY);

      spawnedTokens.forEach((token) => {
        io.to(roomId).emit('map:token_added', {
          roomId,
          token
        });
      });

      console.log(`[MapHandler] 🧙 Tous les pions joueurs invoqués (${spawnedTokens.length})`);

      if (typeof callback === 'function') {
        callback({ success: true, tokens: spawnedTokens });
      }
    } catch (err) {
      console.error('[MapHandler Error] map:spawn_all_players :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Passage au tour de jeu suivant (turn:next) - Réservé au MJ
   */
  socket.on('turn:next', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        throw new Error('Seul le Maître du Jeu peut faire avancer les tours de jeu.');
      }

      const currentTurn = roomManager.nextTurn(roomId);

      if (currentTurn) {
        io.to(roomId).emit('turn:changed', {
          roomId,
          currentTurn
        });

        io.to(roomId).emit('chat:broadcast', {
          sender: 'Maître du Jeu',
          text: `⚔️ C'est au tour de ${currentTurn.name} d'agir !`,
          timestamp: new Date().toISOString(),
          color: '#f59e0b',
          isMJ: true
        });
      }

      if (typeof callback === 'function') {
        callback({ success: true, currentTurn });
      }
    } catch (err) {
      console.error('[MapHandler Error] turn:next :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Définition directe du tour sur un joueur précis (turn:set) - Réservé au MJ
   */
  socket.on('turn:set', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { slot, role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        throw new Error('Seul le Maître du Jeu peut désigner le tour d\'un joueur.');
      }

      const currentTurn = roomManager.setTurn(roomId, slot);

      io.to(roomId).emit('turn:changed', {
        roomId,
        currentTurn
      });

      io.to(roomId).emit('chat:broadcast', {
        sender: 'Maître du Jeu',
        text: `⚔️ C'est au tour de ${currentTurn.name} d'agir !`,
        timestamp: new Date().toISOString(),
        color: '#f59e0b',
        isMJ: true
      });

      if (typeof callback === 'function') {
        callback({ success: true, currentTurn });
      }
    } catch (err) {
      console.error('[MapHandler Error] turn:set :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Synchronisation en direct de la réglette ou du gabarit AoE (map:measure)
   */
  socket.on('map:measure', (data) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      socket.to(roomId).emit('map:measured', {
        ...data,
        socketId: socket.id
      });
    } catch (err) {
      console.error('[MapHandler Error] map:measure :', err.message);
    }
  });

  /**
   * Effacement de la réglette / du gabarit AoE (map:clear_measure)
   */
  socket.on('map:clear_measure', (data) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      socket.to(roomId).emit('map:measure_cleared', {
        socketId: socket.id
      });
    } catch (err) {
      console.error('[MapHandler Error] map:clear_measure :', err.message);
    }
  });

  /**
   * Ajout d'un segment de mur manuel (map:add_wall) - Réservé au MJ
   */
  socket.on('map:add_wall', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { wall, role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        throw new Error('Seul le Maître du Jeu peut ériger des murs sur la carte.');
      }
      if (!wall || typeof wall.x1 !== 'number' || typeof wall.x2 !== 'number') {
        throw new Error('Coordonnées de mur invalides.');
      }

      const newWall = roomManager.addWall(roomId, wall);

      io.to(roomId).emit('map:wall_added', {
        roomId,
        wall: newWall
      });

      if (typeof callback === 'function') {
        callback({ success: true, wall: newWall });
      }
    } catch (err) {
      console.error('[MapHandler Error] map:add_wall :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Suppression d'un segment de mur (map:remove_wall) - Réservé au MJ
   */
  socket.on('map:remove_wall', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { wallId, role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        throw new Error('Seul le Maître du Jeu peut démolir des murs sur la carte.');
      }
      if (!wallId) {
        throw new Error('Identifiant de mur manquant.');
      }

      const removed = roomManager.removeWall(roomId, wallId);

      if (removed) {
        io.to(roomId).emit('map:wall_removed', {
          roomId,
          wallId
        });
      }

      if (typeof callback === 'function') {
        callback({ success: true, wallId });
      }
    } catch (err) {
      console.error('[MapHandler Error] map:remove_wall :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Effacement de tous les murs (map:clear_walls) - Réservé au MJ
   */
  socket.on('map:clear_walls', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        throw new Error('Seul le Maître du Jeu peut réinitialiser les murs.');
      }

      roomManager.clearWalls(roomId);

      io.to(roomId).emit('map:walls_cleared', { roomId });

      if (typeof callback === 'function') {
        callback({ success: true });
      }
    } catch (err) {
      console.error('[MapHandler Error] map:clear_walls :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });
}

module.exports = registerMapHandlers;
