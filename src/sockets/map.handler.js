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

      // Si le client n'est pas MJ, il ne peut déplacer que son propre pion et uniquement pendant son tour
      if (!isMJ) {
        const myChar = getPlayerCharacter(socket, roomId);
        if (!myChar) {
          throw new Error('Vous devez avoir un personnage actif pour déplacer un pion.');
        }
        const isOwner = token.type === 'player' && (token.slot === myChar.slot || (token.name && token.name.toLowerCase() === myChar.name.toLowerCase()));
        if (!isOwner) {
          throw new Error('Action refusée : vous ne pouvez déplacer que votre propre pion.');
        }

        // Vérification de tour actif
        const currentTurn = mapState.currentTurn;
        if (currentTurn && typeof currentTurn.slot === 'number' && currentTurn.slot !== myChar.slot) {
          throw new Error(`Ce n'est pas votre tour d'agir ! (Tour actif : ${currentTurn.name || 'autre joueur'})`);
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
   * Révélation automatique de brouillard de guerre lors de l'exploration par un joueur (map:explore_fog)
   * Le brouillard exploré est commun à toute la table.
   */
  socket.on('map:explore_fog', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { area } = data || {};

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
      console.error('[MapHandler Error] map:explore_fog :', err.message);
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

      const result = roomManager.nextTurn(roomId);

      if (result && result.currentTurn) {
        io.to(roomId).emit('turn:changed', {
          roomId,
          currentTurn: result.currentTurn,
          round: result.round,
          turnOrder: result.turnOrder,
          isNewRound: result.isNewRound
        });

        if (result.isNewRound) {
          const recapLines = (result.turnOrder || []).map((p) => `• ${p.name} : ${p.roll} (d20)`).join('\n');
          io.to(roomId).emit('chat:broadcast', {
            sender: 'Arbitre d\'Initiative',
            text: `[Manche ${result.round} - Initiative d20]\n${recapLines}\nOrdre établi ! C'est au tour de ${result.currentTurn.name} d'agir.`,
            timestamp: new Date().toISOString(),
            color: '#f59e0b',
            isMJ: true
          });
        } else {
          io.to(roomId).emit('chat:broadcast', {
            sender: 'Maître du Jeu',
            text: `C'est au tour de ${result.currentTurn.name} d'agir !`,
            timestamp: new Date().toISOString(),
            color: '#f59e0b',
            isMJ: true
          });
        }

        if (Array.isArray(result.expiredConditions) && result.expiredConditions.length > 0) {
          result.expiredConditions.forEach((c) => {
            io.to(roomId).emit('chat:broadcast', {
              sender: 'Guérison Naturelle',
              text: `${c.tokenName || 'Un combattant'} s'est libéré de l'effet [${c.name}].`,
              timestamp: new Date().toISOString(),
              color: '#10b981',
              isMJ: false
            });
          });
        }

        if (Array.isArray(result.updatedTokens) && result.updatedTokens.length > 0) {
          result.updatedTokens.forEach((tok) => {
            io.to(roomId).emit('token:conditions_updated', {
              roomId,
              tokenId: tok.id,
              token: tok,
              action: 'tick'
            });
          });
        }
      }

      if (typeof callback === 'function') {
        callback({ success: true, result });
      }
    } catch (err) {
      console.error('[MapHandler Error] turn:next :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Lancement / Relance manuelle de la manche d'initiative d20 autonome (turn:roll_initiative)
   */
  socket.on('turn:roll_initiative', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        throw new Error('Seul le Maître du Jeu peut ordonner le tirage d\'initiative.');
      }

      const result = roomManager.startNewRound(roomId);

      if (result && result.currentTurn) {
        io.to(roomId).emit('turn:changed', {
          roomId,
          currentTurn: result.currentTurn,
          round: result.round,
          turnOrder: result.turnOrder,
          isNewRound: true
        });

        const recapLines = (result.turnOrder || []).map((p) => `• ${p.name} : ${p.roll} (d20)`).join('\n');
        io.to(roomId).emit('chat:broadcast', {
          sender: 'Arbitre d\'Initiative',
          text: `[Manche ${result.round} - Initiative d20]\n${recapLines}\nOrdre établi ! C'est au tour de ${result.currentTurn.name} d'agir.`,
          timestamp: new Date().toISOString(),
          color: '#f59e0b',
          isMJ: true
        });

        if (Array.isArray(result.expiredConditions) && result.expiredConditions.length > 0) {
          result.expiredConditions.forEach((c) => {
            io.to(roomId).emit('chat:broadcast', {
              sender: 'Guérison Naturelle',
              text: `${c.tokenName || 'Un combattant'} s'est libéré de l'effet [${c.name}].`,
              timestamp: new Date().toISOString(),
              color: '#10b981',
              isMJ: false
            });
          });
        }

        if (Array.isArray(result.updatedTokens) && result.updatedTokens.length > 0) {
          result.updatedTokens.forEach((tok) => {
            io.to(roomId).emit('token:conditions_updated', {
              roomId,
              tokenId: tok.id,
              token: tok,
              action: 'tick'
            });
          });
        }
      }

      if (typeof callback === 'function') {
        callback({ success: true, result });
      }
    } catch (err) {
      console.error('[MapHandler Error] turn:roll_initiative :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Fin de tour volontaire (bouton Fin de Tour) ou automatique (Course / Dash au-delà de la zone bleue)
   */
  socket.on('turn:finish', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { reason, dist, role } = data || {};
      const isMJ = isUserMJ(socket, roomId, role);

      const room = roomManager.getRoom(roomId);
      const myChar = getPlayerCharacter(socket, roomId);

      // Si c'est un joueur, vérifier que c'est bien son tour
      if (!isMJ) {
        if (!myChar) {
          throw new Error('Vous devez avoir un personnage actif.');
        }
        if (room.map?.currentTurn?.slot !== myChar.slot) {
          throw new Error('Ce n\'est pas votre tour de jeu.');
        }
      }

      const activeName = (myChar && myChar.name) || room.map?.currentTurn?.name || 'Aventurier';

      // Message d'ambiance si c'est une action de course / dash
      if (reason === 'dash') {
        const distStr = typeof dist === 'number' ? ` (${dist.toFixed(1)} m)` : '';
        io.to(roomId).emit('chat:broadcast', {
          sender: 'Arbitre de Tour',
          text: `Course (Dash) effectuée par ${activeName}${distStr} ! Son tour prend fin automatiquement.`,
          timestamp: new Date().toISOString(),
          color: '#eab308',
          isMJ: true
        });
      }

      // Passage automatique au tour suivant
      const result = roomManager.nextTurn(roomId);

      if (result && result.currentTurn) {
        io.to(roomId).emit('turn:changed', {
          roomId,
          currentTurn: result.currentTurn,
          round: result.round,
          turnOrder: result.turnOrder,
          isNewRound: result.isNewRound
        });

        if (result.isNewRound) {
          const recapLines = (result.turnOrder || []).map((p) => `• ${p.name} : ${p.roll} (d20)`).join('\n');
          io.to(roomId).emit('chat:broadcast', {
            sender: 'Arbitre d\'Initiative',
            text: `[Manche ${result.round} - Initiative d20]\n${recapLines}\nOrdre établi ! C'est au tour de ${result.currentTurn.name} d'agir.`,
            timestamp: new Date().toISOString(),
            color: '#f59e0b',
            isMJ: true
          });
        } else if (reason !== 'dash') {
          io.to(roomId).emit('chat:broadcast', {
            sender: 'Arbitre de Tour',
            text: `${activeName} a conclu son tour. C'est au tour de ${result.currentTurn.name} d'agir !`,
            timestamp: new Date().toISOString(),
            color: '#f59e0b',
            isMJ: true
          });
        }

        if (Array.isArray(result.expiredConditions) && result.expiredConditions.length > 0) {
          result.expiredConditions.forEach((c) => {
            io.to(roomId).emit('chat:broadcast', {
              sender: 'Guérison Naturelle',
              text: `${c.tokenName || 'Un combattant'} s'est libéré de l'effet [${c.name}].`,
              timestamp: new Date().toISOString(),
              color: '#10b981',
              isMJ: false
            });
          });
        }

        if (Array.isArray(result.updatedTokens) && result.updatedTokens.length > 0) {
          result.updatedTokens.forEach((tok) => {
            io.to(roomId).emit('token:conditions_updated', {
              roomId,
              tokenId: tok.id,
              token: tok,
              action: 'tick'
            });
          });
        }
      }

      if (typeof callback === 'function') {
        callback({ success: true, result });
      }
    } catch (err) {
      console.error('[MapHandler Error] turn:finish :', err.message);
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

      const result = roomManager.setTurn(roomId, slot);

      io.to(roomId).emit('turn:changed', {
        roomId,
        currentTurn: result.currentTurn,
        round: result.round,
        turnOrder: result.turnOrder,
        isNewRound: false
      });

      io.to(roomId).emit('chat:broadcast', {
        sender: 'Maître du Jeu',
        text: `C'est au tour de ${result.currentTurn.name} d'agir !`,
        timestamp: new Date().toISOString(),
        color: '#f59e0b',
        isMJ: true
      });

      if (typeof callback === 'function') {
        callback({ success: true, result });
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

  /**
   * Bascule l'état d'une porte (ouvrir / fermer) (map:toggle_door)
   */
  socket.on('map:toggle_door', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { doorId, role } = data || {};
      const myChar = getPlayerCharacter(socket, roomId);
      const isMJ = isUserMJ(socket, roomId, role);

      const result = roomManager.toggleDoor(
        roomId,
        doorId,
        isMJ ? 'mj' : 'player',
        myChar?.slot,
        myChar?.name
      );

      const actorName = isMJ ? 'Le Maître du Jeu' : (myChar?.name || 'Un aventurier');

      if (!result.success && result.locked) {
        io.to(roomId).emit('chat:broadcast', {
          sender: 'Mécanisme de Porte',
          text: `${actorName} tente d'ouvrir une porte, mais elle est verrouillée à clé !`,
          timestamp: new Date().toISOString(),
          color: '#ef4444',
          isMJ: false
        });

        if (typeof callback === 'function') {
          callback({ success: false, locked: true, message: result.message });
        }
        return;
      }

      io.to(roomId).emit('map:door_updated', {
        roomId,
        door: result.door,
        action: result.action
      });

      const actionText = result.action === 'opened' ? 'a ouvert une porte.' : 'a refermé une porte.';
      io.to(roomId).emit('chat:broadcast', {
        sender: 'Mécanisme de Porte',
        text: `${actorName} ${actionText}`,
        timestamp: new Date().toISOString(),
        color: '#f59e0b',
        isMJ: false
      });

      if (typeof callback === 'function') {
        callback({ success: true, door: result.door, action: result.action });
      }
    } catch (err) {
      console.error('[MapHandler Error] map:toggle_door :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Verrouillage / déverrouillage d'une porte à clé (map:lock_door) - Réservé au MJ
   */
  socket.on('map:lock_door', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { doorId, role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        throw new Error('Seul le Maître du Jeu peut verrouiller des portes.');
      }

      const result = roomManager.toggleDoorLock(roomId, doorId);

      io.to(roomId).emit('map:door_updated', {
        roomId,
        door: result.door,
        isLocked: result.isLocked
      });

      const lockText = result.isLocked
        ? 'Le Maître du Jeu a verrouillé une porte à clé.'
        : 'Le Maître du Jeu a déverrouillé une porte.';
      io.to(roomId).emit('chat:broadcast', {
        sender: 'Mécanisme de Porte',
        text: lockText,
        timestamp: new Date().toISOString(),
        color: '#d97706',
        isMJ: true
      });

      if (typeof callback === 'function') {
        callback({ success: true, door: result.door, isLocked: result.isLocked });
      }
    } catch (err) {
      console.error('[MapHandler Error] map:lock_door :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Bascule du mode d'éclairage ambiant (Jour / Nuit) (map:set_lighting_mode) - Réservé au MJ
   */
  socket.on('map:set_lighting_mode', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { mode, role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        throw new Error('Seul le Maître du Jeu peut modifier l\'éclairage de la carte.');
      }

      const newMode = roomManager.setLightingMode(roomId, mode);

      io.to(roomId).emit('map:lighting_updated', {
        roomId,
        lightingMode: newMode
      });

      const modeLabel = newMode === 'night' ? 'Nuit Obscure' : 'Plein Jour';
      io.to(roomId).emit('chat:broadcast', {
        sender: 'Ambiance du Donjon',
        text: `Le Maître du Jeu a instauré le mode [${modeLabel}] sur la carte.`,
        timestamp: new Date().toISOString(),
        color: newMode === 'night' ? '#818cf8' : '#f59e0b',
        isMJ: true
      });

      if (typeof callback === 'function') {
        callback({ success: true, lightingMode: newMode });
      }
    } catch (err) {
      console.error('[MapHandler Error] map:set_lighting_mode :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Ajout d'une source de lumière fixe (brasero, chandelier...) (map:add_light) - Réservé au MJ
   */
  socket.on('map:add_light', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { light, role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        throw new Error('Seul le Maître du Jeu peut placer des sources de lumière fixes.');
      }

      const newLight = roomManager.addLight(roomId, light);

      io.to(roomId).emit('map:light_added', {
        roomId,
        light: newLight
      });

      if (typeof callback === 'function') {
        callback({ success: true, light: newLight });
      }
    } catch (err) {
      console.error('[MapHandler Error] map:add_light :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Suppression d'une source de lumière fixe (map:remove_light) - Réservé au MJ
   */
  socket.on('map:remove_light', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { lightId, role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        throw new Error('Seul le Maître du Jeu peut retirer des sources lumineuses.');
      }

      const removed = roomManager.removeLight(roomId, lightId);

      if (removed) {
        io.to(roomId).emit('map:light_removed', {
          roomId,
          lightId
        });
      }

      if (typeof callback === 'function') {
        callback({ success: true, lightId });
      }
    } catch (err) {
      console.error('[MapHandler Error] map:remove_light :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Suppression de toutes les sources de lumière fixes (map:clear_lights) - Réservé au MJ
   */
  socket.on('map:clear_lights', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        throw new Error('Seul le Maître du Jeu peut supprimer les lumières.');
      }

      roomManager.clearLights(roomId);

      io.to(roomId).emit('map:lights_cleared', { roomId });

      if (typeof callback === 'function') {
        callback({ success: true });
      }
    } catch (err) {
      console.error('[MapHandler Error] map:clear_lights :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Allumer ou éteindre la torche d'un pion (map:toggle_torch)
   */
  socket.on('map:toggle_torch', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { tokenId, role } = data || {};
      const isMJ = isUserMJ(socket, roomId, role);

      const result = roomManager.toggleTokenTorch(roomId, tokenId);

      io.to(roomId).emit('map:torch_toggled', {
        roomId,
        tokenId,
        hasTorch: result.hasTorch,
        torchRadius: result.token.torchRadius
      });

      const tokenName = result.token.name || 'Un aventurier';
      const torchStateText = result.hasTorch
        ? `${tokenName} a allumé une torche (rayon 12 mètres pour le groupe).`
        : `${tokenName} a éteint sa torche.`;

      io.to(roomId).emit('chat:broadcast', {
        sender: 'Lumière & Feu',
        text: torchStateText,
        timestamp: new Date().toISOString(),
        color: '#f59e0b',
        isMJ: false
      });

      if (typeof callback === 'function') {
        callback({ success: true, hasTorch: result.hasTorch });
      }
    } catch (err) {
      console.error('[MapHandler Error] map:toggle_torch :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Applique ou actualise une altération d'état sur un pion (token:set_condition)
   */
  socket.on('token:set_condition', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { tokenId, conditionId, duration, role } = data || {};
      const isMJ = isUserMJ(socket, roomId, role);
      const myChar = getPlayerCharacter(socket, roomId);
      const room = roomManager.getRoom(roomId);
      const token = (room.map?.tokens || []).find((t) => t.id === tokenId);
      if (!token) throw new Error('Pion introuvable sur la carte.');

      if (!isMJ) {
        if (!myChar || (token.type === 'player' && token.slot !== myChar.slot)) {
          throw new Error('Seul le Maître du Jeu peut appliquer des altérations sur d\'autres pions.');
        }
      }

      const result = roomManager.setTokenCondition(roomId, tokenId, conditionId, duration || 3);

      io.to(roomId).emit('token:conditions_updated', {
        roomId,
        tokenId,
        token: result.token,
        condition: result.condition,
        action: 'set'
      });

      io.to(roomId).emit('chat:broadcast', {
        sender: 'Altération d\'État',
        text: `${result.token.name || 'Un combattant'} est désormais sous l'effet [${result.condition.name}] (${result.condition.duration} tours).`,
        timestamp: new Date().toISOString(),
        color: result.condition.color || '#f59e0b',
        isMJ: isMJ
      });

      if (typeof callback === 'function') {
        callback({ success: true, token: result.token, condition: result.condition });
      }
    } catch (err) {
      console.error('[MapHandler Error] token:set_condition :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Supprime une altération d'état d'un pion (token:remove_condition)
   */
  socket.on('token:remove_condition', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { tokenId, conditionId, role } = data || {};
      const isMJ = isUserMJ(socket, roomId, role);
      const myChar = getPlayerCharacter(socket, roomId);
      const room = roomManager.getRoom(roomId);
      const token = (room.map?.tokens || []).find((t) => t.id === tokenId);
      if (!token) throw new Error('Pion introuvable sur la carte.');

      if (!isMJ) {
        if (!myChar || (token.type === 'player' && token.slot !== myChar.slot)) {
          throw new Error('Seul le Maître du Jeu peut soigner les altérations d\'autres pions.');
        }
      }

      const result = roomManager.removeTokenCondition(roomId, tokenId, conditionId);

      io.to(roomId).emit('token:conditions_updated', {
        roomId,
        tokenId,
        token: result.token,
        removedCondition: result.removed,
        action: 'removed'
      });

      if (result.removed) {
        io.to(roomId).emit('chat:broadcast', {
          sender: 'Guérison',
          text: `${result.token.name || 'Un combattant'} n'est plus affecté par [${result.removed.name}].`,
          timestamp: new Date().toISOString(),
          color: '#10b981',
          isMJ: isMJ
        });
      }

      if (typeof callback === 'function') {
        callback({ success: true, token: result.token, removed: result.removed });
      }
    } catch (err) {
      console.error('[MapHandler Error] token:remove_condition :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Purifie toutes les altérations d'état d'un pion (token:clear_conditions)
   */
  socket.on('token:clear_conditions', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { tokenId, role } = data || {};
      const isMJ = isUserMJ(socket, roomId, role);
      const myChar = getPlayerCharacter(socket, roomId);
      const room = roomManager.getRoom(roomId);
      const token = (room.map?.tokens || []).find((t) => t.id === tokenId);
      if (!token) throw new Error('Pion introuvable sur la carte.');

      if (!isMJ) {
        if (!myChar || (token.type === 'player' && token.slot !== myChar.slot)) {
          throw new Error('Seul le Maître du Jeu peut purifier d\'autres pions.');
        }
      }

      const result = roomManager.clearTokenConditions(roomId, tokenId);

      io.to(roomId).emit('token:conditions_updated', {
        roomId,
        tokenId,
        token: result.token,
        clearedCount: result.clearedCount,
        action: 'cleared'
      });

      io.to(roomId).emit('chat:broadcast', {
        sender: 'Purification',
        text: `Toutes les altérations d'état affectant ${result.token.name || 'le combattant'} ont été dissipées.`,
        timestamp: new Date().toISOString(),
        color: '#38bdf8',
        isMJ: isMJ
      });

      if (typeof callback === 'function') {
        callback({ success: true, token: result.token, clearedCount: result.clearedCount });
      }
    } catch (err) {
      console.error('[MapHandler Error] token:clear_conditions :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Obtention du catalogue des altérations d'état disponibles (token:get_conditions_catalogue)
   */
  socket.on('token:get_conditions_catalogue', (data, callback) => {
    try {
      const cb = typeof data === 'function' ? data : callback;
      const list = roomManager.getConditionsList();
      if (typeof cb === 'function') {
        cb({ success: true, conditions: list });
      }
    } catch (err) {
      console.error('[MapHandler Error] token:get_conditions_catalogue :', err.message);
      const cb = typeof data === 'function' ? data : callback;
      if (typeof cb === 'function') {
        cb({ success: false, error: err.message });
      }
    }
  });

  /**
   * Ajout d'une zone d'effet ou terrain difficile (map:add_zone) - Réservé au MJ
   */
  socket.on('map:add_zone', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { zone, role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        throw new Error('Seul le Maître du Jeu peut tracer des zones et terrains.');
      }
      if (!zone) {
        throw new Error('Données de zone invalides.');
      }

      const newZone = roomManager.addZone(roomId, zone);

      io.to(roomId).emit('map:zone_added', {
        roomId,
        zone: newZone
      });

      const zoneTypeLabel = newZone.type === 'hazard' ? 'Zone de Danger' : 'Terrain Difficile';
      io.to(roomId).emit('chat:broadcast', {
        sender: 'Architecture Tactique',
        text: `Nouveau ${zoneTypeLabel} matérialisé : [${newZone.name}].`,
        timestamp: new Date().toISOString(),
        color: newZone.color || '#f59e0b',
        isMJ: true
      });

      if (typeof callback === 'function') {
        callback({ success: true, zone: newZone });
      }
    } catch (err) {
      console.error('[MapHandler Error] map:add_zone :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Suppression d'une zone d'effet (map:remove_zone) - Réservé au MJ
   */
  socket.on('map:remove_zone', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { zoneId, role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        throw new Error('Seul le Maître du Jeu peut supprimer des zones.');
      }

      const removed = roomManager.removeZone(roomId, zoneId);

      if (removed) {
        io.to(roomId).emit('map:zone_removed', {
          roomId,
          zoneId
        });
      }

      if (typeof callback === 'function') {
        callback({ success: true, zoneId });
      }
    } catch (err) {
      console.error('[MapHandler Error] map:remove_zone :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Effacement de toutes les zones (map:clear_zones) - Réservé au MJ
   */
  socket.on('map:clear_zones', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        throw new Error('Seul le Maître du Jeu peut réinitialiser les zones.');
      }

      roomManager.clearZones(roomId);

      io.to(roomId).emit('map:zones_cleared', { roomId });

      if (typeof callback === 'function') {
        callback({ success: true });
      }
    } catch (err) {
      console.error('[MapHandler Error] map:clear_zones :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Ajout d'un piège ou passage secret dissimulé (map:add_trap) - Réservé au MJ
   */
  socket.on('map:add_trap', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { trap, role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        throw new Error('Seul le Maître du Jeu peut poser des pièges.');
      }
      if (!trap) {
        throw new Error('Données de piège invalides.');
      }

      const newTrap = roomManager.addTrap(roomId, trap);

      io.to(roomId).emit('map:trap_added', {
        roomId,
        trap: newTrap
      });

      if (typeof callback === 'function') {
        callback({ success: true, trap: newTrap });
      }
    } catch (err) {
      console.error('[MapHandler Error] map:add_trap :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Suppression d'un piège (map:remove_trap) - Réservé au MJ
   */
  socket.on('map:remove_trap', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { trapId, role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        throw new Error('Seul le Maître du Jeu peut supprimer des pièges.');
      }

      const removed = roomManager.removeTrap(roomId, trapId);

      if (removed) {
        io.to(roomId).emit('map:trap_removed', {
          roomId,
          trapId
        });
      }

      if (typeof callback === 'function') {
        callback({ success: true, trapId });
      }
    } catch (err) {
      console.error('[MapHandler Error] map:remove_trap :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Effacement de tous les pièges (map:clear_traps) - Réservé au MJ
   */
  socket.on('map:clear_traps', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        throw new Error('Seul le Maître du Jeu peut réinitialiser les pièges.');
      }

      roomManager.clearTraps(roomId);

      io.to(roomId).emit('map:traps_cleared', { roomId });

      if (typeof callback === 'function') {
        callback({ success: true });
      }
    } catch (err) {
      console.error('[MapHandler Error] map:clear_traps :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Déclenchement d'un piège (map:trigger_trap) :
   * Arrêt forcé du mouvement, dégâts immédiats et application d'altération d'état
   */
  socket.on('map:trigger_trap', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { trapId, tokenId } = data || {};

      if (!trapId) throw new Error('Identifiant de piège manquant.');

      const result = roomManager.triggerTrap(roomId, trapId, tokenId);

      // Notification globale de déclenchement du piège
      io.to(roomId).emit('map:trap_triggered', {
        roomId,
        trapId,
        trap: result.trap,
        token: result.token,
        damage: result.damage,
        condition: result.condition
      });

      // Synchronisation des PV et conditions si un pion a été touché
      if (result.token) {
        io.to(roomId).emit('map:token_moved', {
          roomId,
          tokenId: result.token.id,
          x: result.token.x,
          y: result.token.y,
          token: result.token
        });

        if (result.condition) {
          io.to(roomId).emit('token:conditions_updated', {
            roomId,
            tokenId: result.token.id,
            token: result.token,
            condition: result.condition,
            action: 'set'
          });
        }
      }

      // Annonce dramatique dans le journal de taverne
      const victimName = result.token?.name || 'Un combattant';
      const condText = result.condition ? ` Altération subie : [${result.condition.name}].` : '';
      const dmgText = result.damage > 0 ? ` Subit ${result.damage} dégâts !` : '';

      io.to(roomId).emit('chat:broadcast', {
        sender: 'Piège Déclenché',
        text: `CLAC ! ${victimName} a marché sur [${result.trap.name}] ! Mouvement stoppé net !${dmgText}${condText}`,
        timestamp: new Date().toISOString(),
        color: '#ef4444',
        isMJ: true
      });

      if (typeof callback === 'function') {
        callback({ success: true, result });
      }
    } catch (err) {
      console.error('[MapHandler Error] map:trigger_trap :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Révélation d'un piège par Perception Passive (map:reveal_trap)
   */
  socket.on('map:reveal_trap', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { trapId, characterName, score, dc } = data || {};

      if (!trapId) throw new Error('Identifiant de piège manquant.');

      const result = roomManager.revealTrap(roomId, trapId, characterName, score, dc);

      io.to(roomId).emit('map:trap_revealed', {
        roomId,
        trapId,
        trap: result.trap,
        characterName: result.characterName,
        score: result.score,
        dc: result.dc
      });

      io.to(roomId).emit('chat:broadcast', {
        sender: 'Perception Passive',
        text: `[Vigilance] ${result.characterName} a décelé un mécanisme caché : [${result.trap.name}] (Perception ${result.score} >= DD ${result.dc}) !`,
        timestamp: new Date().toISOString(),
        color: '#eab308',
        isMJ: false
      });

      if (typeof callback === 'function') {
        callback({ success: true, result });
      }
    } catch (err) {
      console.error('[MapHandler Error] map:reveal_trap :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Désamorçage ou réarmement d'un piège (map:disarm_trap)
   */
  socket.on('map:disarm_trap', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { trapId, isDisarmed } = data || {};

      if (!trapId) throw new Error('Identifiant de piège manquant.');

      const result = roomManager.disarmTrap(roomId, trapId, isDisarmed !== false);

      io.to(roomId).emit('map:trap_disarmed', {
        roomId,
        trapId,
        trap: result.trap
      });

      const stateLabel = result.trap.disarmed ? 'désamorcé et neutralisé' : 'réarmé';
      io.to(roomId).emit('chat:broadcast', {
        sender: 'Mécanismes & Pièges',
        text: `Le piège [${result.trap.name}] a été ${stateLabel}.`,
        timestamp: new Date().toISOString(),
        color: result.trap.disarmed ? '#10b981' : '#f59e0b',
        isMJ: false
      });

      if (typeof callback === 'function') {
        callback({ success: true, trap: result.trap });
      }
    } catch (err) {
      console.error('[MapHandler Error] map:disarm_trap :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Déclenchement d'une zone de danger permanent lorsqu'un pion s'y arrête (map:hazard_damage)
   */
  socket.on('map:hazard_damage', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { zoneId, tokenId } = data || {};

      if (!zoneId || !tokenId) throw new Error('Identifiant de zone ou pion manquant.');

      const result = roomManager.applyHazardZone(roomId, zoneId, tokenId);

      io.to(roomId).emit('map:hazard_triggered', {
        roomId,
        zoneId,
        tokenId,
        zone: result.zone,
        token: result.token,
        damage: result.damage,
        condition: result.condition
      });

      if (result.condition) {
        io.to(roomId).emit('token:conditions_updated', {
          roomId,
          tokenId: result.token.id,
          token: result.token,
          condition: result.condition,
          action: 'set'
        });
      }

      const victimName = result.token.name || 'Un combattant';
      const condText = result.condition ? ` et subit l'altération [${result.condition.name}].` : '.';
      const dmgText = result.damage > 0 ? ` Subit ${result.damage} dégâts` : '';

      io.to(roomId).emit('chat:broadcast', {
        sender: 'Zone de Danger',
        text: `[Danger Actif] ${victimName} s'est arrêté dans [${result.zone.name}] !${dmgText}${condText}`,
        timestamp: new Date().toISOString(),
        color: result.zone.color || '#ea580c',
        isMJ: true
      });

      if (typeof callback === 'function') {
        callback({ success: true, result });
      }
    } catch (err) {
      console.error('[MapHandler Error] map:hazard_damage :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Récupération des scènes existantes (scene:list)
   */
  socket.on('scene:list', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const result = roomManager.getScenes(roomId);
      if (typeof callback === 'function') {
        callback({ success: true, ...result });
      }
    } catch (err) {
      console.error('[MapHandler Error] scene:list :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Création d'une nouvelle scène de jeu (scene:create) - Réservé au MJ
   */
  socket.on('scene:create', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { scene, role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        throw new Error('Action réservée au Maître du Jeu.');
      }

      const newScene = roomManager.createScene(roomId, scene || {});
      const room = roomManager.getRoom(roomId);

      io.to(roomId).emit('scene:created', {
        scene: newScene,
        activeSceneId: room.activeSceneId,
        scenes: room.scenes.map((s) => ({
          id: s.id,
          name: s.name,
          backgroundUrl: s.backgroundUrl,
          lightingMode: s.lightingMode,
          fogEnabled: s.fogEnabled,
          tokenCount: (s.tokens || []).length,
          wallCount: (s.walls || []).length,
          teleporterCount: (s.teleporters || []).length
        }))
      });

      io.to(roomId).emit('chat:broadcast', {
        sender: 'Maître du Jeu',
        text: `[Scènes] Nouvelle carte préparée : "${newScene.name}".`,
        timestamp: new Date().toISOString(),
        color: '#f59e0b',
        isMJ: true
      });

      if (typeof callback === 'function') {
        callback({ success: true, scene: newScene });
      }
    } catch (err) {
      console.error('[MapHandler Error] scene:create :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Changement de la scène active pour toute la salle (scene:switch) - Réservé au MJ
   */
  socket.on('scene:switch', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { sceneId, targetSceneId, transportPlayers = true, targetX = null, targetY = null, role } = data || {};
      const finalSceneId = sceneId || targetSceneId;

      if (!isUserMJ(socket, roomId, role)) {
        throw new Error('Action réservée au Maître du Jeu.');
      }

      const res = roomManager.switchScene(roomId, finalSceneId, transportPlayers, targetX, targetY);
      const room = roomManager.getRoom(roomId);

      io.to(roomId).emit('scene:switched', {
        activeSceneId: res.activeSceneId,
        scene: res.scene,
        transportedTokens: res.transportedTokens,
        scenes: room.scenes.map((s) => ({
          id: s.id,
          name: s.name,
          backgroundUrl: s.backgroundUrl,
          lightingMode: s.lightingMode,
          fogEnabled: s.fogEnabled,
          tokenCount: (s.tokens || []).length,
          wallCount: (s.walls || []).length,
          teleporterCount: (s.teleporters || []).length
        }))
      });

      io.to(roomId).emit('chat:broadcast', {
        sender: 'Maître du Jeu',
        text: `[Transition] La table passe à la scène : [${res.scene.name}].`,
        timestamp: new Date().toISOString(),
        color: '#f59e0b',
        isMJ: true
      });

      if (typeof callback === 'function') {
        callback({ success: true, ...res });
      }
    } catch (err) {
      console.error('[MapHandler Error] scene:switch :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Mise à jour des réglages d'une scène (scene:update) - Réservé au MJ
   */
  socket.on('scene:update', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { sceneId, updates, role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        throw new Error('Action réservée au Maître du Jeu.');
      }

      const updatedScene = roomManager.updateScene(roomId, sceneId, updates || {});
      const room = roomManager.getRoom(roomId);

      io.to(roomId).emit('scene:updated', {
        scene: updatedScene,
        activeSceneId: room.activeSceneId,
        scenes: room.scenes.map((s) => ({
          id: s.id,
          name: s.name,
          backgroundUrl: s.backgroundUrl,
          lightingMode: s.lightingMode,
          fogEnabled: s.fogEnabled,
          tokenCount: (s.tokens || []).length,
          wallCount: (s.walls || []).length,
          teleporterCount: (s.teleporters || []).length
        }))
      });

      // Si c'est la scène active qui a été modifiée, re-synchroniser les clients
      if (room.activeSceneId === sceneId) {
        io.to(roomId).emit('map:sync', { map: updatedScene });
      }

      if (typeof callback === 'function') {
        callback({ success: true, scene: updatedScene });
      }
    } catch (err) {
      console.error('[MapHandler Error] scene:update :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Suppression d'une scène (scene:delete) - Réservé au MJ
   */
  socket.on('scene:delete', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { sceneId, role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        throw new Error('Action réservée au Maître du Jeu.');
      }

      const res = roomManager.deleteScene(roomId, sceneId);
      const room = roomManager.getRoom(roomId);

      io.to(roomId).emit('scene:deleted', {
        deletedSceneId: res.deletedSceneId,
        newActiveScene: res.newActiveScene,
        scenes: room.scenes.map((s) => ({
          id: s.id,
          name: s.name,
          backgroundUrl: s.backgroundUrl,
          lightingMode: s.lightingMode,
          fogEnabled: s.fogEnabled,
          tokenCount: (s.tokens || []).length,
          wallCount: (s.walls || []).length,
          teleporterCount: (s.teleporters || []).length
        }))
      });

      if (res.newActiveScene) {
        io.to(roomId).emit('scene:switched', {
          activeSceneId: res.newActiveScene.id,
          scene: res.newActiveScene,
          transportedTokens: [],
          scenes: room.scenes
        });
      }

      if (typeof callback === 'function') {
        callback({ success: true, ...res });
      }
    } catch (err) {
      console.error('[MapHandler Error] scene:delete :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Ajout d'un téléporteur / point de passage (scene:add_teleporter) - Réservé au MJ
   */
  socket.on('scene:add_teleporter', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { teleporter, role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        throw new Error('Action réservée au Maître du Jeu.');
      }

      const newTeleporter = roomManager.addTeleporter(roomId, teleporter || {});
      io.to(roomId).emit('scene:teleporter_added', { teleporter: newTeleporter });

      io.to(roomId).emit('chat:broadcast', {
        sender: 'Maître du Jeu',
        text: `[Transition] Nouveau point de passage installé : "${newTeleporter.name}".`,
        timestamp: new Date().toISOString(),
        color: '#6366f1',
        isMJ: true
      });

      if (typeof callback === 'function') {
        callback({ success: true, teleporter: newTeleporter });
      }
    } catch (err) {
      console.error('[MapHandler Error] scene:add_teleporter :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Suppression d'un téléporteur (scene:remove_teleporter) - Réservé au MJ
   */
  socket.on('scene:remove_teleporter', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { teleporterId, role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        throw new Error('Action réservée au Maître du Jeu.');
      }

      const removed = roomManager.removeTeleporter(roomId, teleporterId);
      if (removed) {
        io.to(roomId).emit('scene:teleporter_removed', { teleporterId });
      }

      if (typeof callback === 'function') {
        callback({ success: true, removed });
      }
    } catch (err) {
      console.error('[MapHandler Error] scene:remove_teleporter :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Déclenchement d'un téléporteur lorsqu'un pion marche dessus (scene:trigger_teleporter)
   * Téléporte tout le groupe vers la scène liée à l'emplacement précis fixé par le MJ
   */
  socket.on('scene:trigger_teleporter', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { teleporterId, tokenId } = data || {};

      const res = roomManager.triggerTeleporter(roomId, teleporterId, tokenId);

      if (res?.triggered) {
        const room = roomManager.getRoom(roomId);
        io.to(roomId).emit('scene:switched', {
          activeSceneId: res.activeSceneId,
          scene: res.scene,
          transportedTokens: res.transportedTokens,
          viaTeleporter: res.teleporter,
          scenes: room.scenes.map((s) => ({
            id: s.id,
            name: s.name,
            backgroundUrl: s.backgroundUrl,
            lightingMode: s.lightingMode,
            fogEnabled: s.fogEnabled,
            tokenCount: (s.tokens || []).length,
            wallCount: (s.walls || []).length,
            teleporterCount: (s.teleporters || []).length
          }))
        });

        io.to(roomId).emit('chat:broadcast', {
          sender: 'Téléportation',
          text: `[Transition de Groupe] Le groupe franchit [${res.teleporter.name}] -> Arrivée dans [${res.scene.name}] !`,
          timestamp: new Date().toISOString(),
          color: '#818cf8',
          isMJ: true
        });
      }

      if (typeof callback === 'function') {
        callback({ success: true, ...res });
      }
    } catch (err) {
      console.error('[MapHandler Error] scene:trigger_teleporter :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  // ------------------------------------------------------------
  // GESTIONNAIRES DU CARNET D'ENQUÊTE & MUR DE DÉTECTIVE
  // ------------------------------------------------------------

  /**
   * Récupère l'état complet du carnet d'enquête (investigation:get)
   */
  socket.on('investigation:get', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const investigation = roomManager.getInvestigation(roomId);
      if (typeof callback === 'function') {
        callback({ success: true, investigation });
      }
    } catch (err) {
      console.error('[MapHandler Error] investigation:get :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Ajoute un nouvel indice, rumeur, portrait ou document (investigation:add_clue)
   */
  socket.on('investigation:add_clue', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { clue } = data || {};

      const newClue = roomManager.addClue(roomId, clue);
      if (newClue) {
        io.to(roomId).emit('investigation:clue_added', { clue: newClue });
        io.to(roomId).emit('chat:broadcast', {
          sender: 'Carnet d\'Enquête',
          text: `[Nouvel Indice] "${newClue.title}" a été épinglé sur le mur d'enquête par ${newClue.author}.`,
          timestamp: new Date().toISOString(),
          color: '#f59e0b',
          isMJ: false
        });
      }

      if (typeof callback === 'function') {
        callback({ success: Boolean(newClue), clue: newClue });
      }
    } catch (err) {
      console.error('[MapHandler Error] investigation:add_clue :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Met à jour les détails d'un indice (investigation:update_clue)
   */
  socket.on('investigation:update_clue', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { clueId, updates } = data || {};

      const updatedClue = roomManager.updateClue(roomId, clueId, updates);
      if (updatedClue) {
        io.to(roomId).emit('investigation:clue_updated', { clue: updatedClue });
      }

      if (typeof callback === 'function') {
        callback({ success: Boolean(updatedClue), clue: updatedClue });
      }
    } catch (err) {
      console.error('[MapHandler Error] investigation:update_clue :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Déplace un indice sur le tableau en temps réel (investigation:move_clue)
   */
  socket.on('investigation:move_clue', (data) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { clueId, x, y } = data || {};
      if (!clueId || typeof x !== 'number' || typeof y !== 'number') return;

      const movedClue = roomManager.moveClue(roomId, clueId, x, y);
      if (movedClue) {
        // Broadcast à tous les autres clients pour fluidité
        socket.to(roomId).emit('investigation:clue_moved', { clueId, x, y });
      }
    } catch (err) {
      console.error('[MapHandler Error] investigation:move_clue :', err.message);
    }
  });

  /**
   * Supprime un indice et ses liens associés (investigation:delete_clue)
   */
  socket.on('investigation:delete_clue', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { clueId } = data || {};

      const success = roomManager.deleteClue(roomId, clueId);
      if (success) {
        io.to(roomId).emit('investigation:clue_deleted', { clueId });
      }

      if (typeof callback === 'function') {
        callback({ success });
      }
    } catch (err) {
      console.error('[MapHandler Error] investigation:delete_clue :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Brise le sceau de cire d'une lettre scellée (investigation:unseal)
   */
  socket.on('investigation:unseal', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { clueId, unsealedBy } = data || {};

      const clue = roomManager.unsealClue(roomId, clueId, unsealedBy || 'Aventurier');
      if (clue) {
        io.to(roomId).emit('investigation:clue_unsealed', { clue });
        io.to(roomId).emit('chat:broadcast', {
          sender: 'Révélation Secrète',
          text: `[Sceau Brisé] Le cachet de cire de "${clue.title}" a été rompu par ${clue.unsealedBy} ! Son contenu est désormais révélé.`,
          timestamp: new Date().toISOString(),
          color: '#ef4444',
          isMJ: false
        });
      }

      if (typeof callback === 'function') {
        callback({ success: Boolean(clue), clue });
      }
    } catch (err) {
      console.error('[MapHandler Error] investigation:unseal :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Ajoute une hypothèse / déduction collective (investigation:add_deduction)
   */
  socket.on('investigation:add_deduction', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { clueId, deduction } = data || {};

      const res = roomManager.addClueDeduction(roomId, clueId, deduction);
      if (res?.deduction) {
        io.to(roomId).emit('investigation:deduction_added', {
          clueId,
          deduction: res.deduction
        });
      }

      if (typeof callback === 'function') {
        callback({ success: Boolean(res?.deduction), deduction: res?.deduction });
      }
    } catch (err) {
      console.error('[MapHandler Error] investigation:add_deduction :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Relie deux indices avec une ficelle rouge (investigation:add_link)
   */
  socket.on('investigation:add_link', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { link } = data || {};

      const newLink = roomManager.addInvestigationLink(roomId, link);
      if (newLink) {
        io.to(roomId).emit('investigation:link_added', { link: newLink });
      }

      if (typeof callback === 'function') {
        callback({ success: Boolean(newLink), link: newLink });
      }
    } catch (err) {
      console.error('[MapHandler Error] investigation:add_link :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Coupe / supprime une ficelle de liaison (investigation:delete_link)
   */
  socket.on('investigation:delete_link', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { linkId } = data || {};

      const success = roomManager.deleteInvestigationLink(roomId, linkId);
      if (success) {
        io.to(roomId).emit('investigation:link_deleted', { linkId });
      }

      if (typeof callback === 'function') {
        callback({ success });
      }
    } catch (err) {
      console.error('[MapHandler Error] investigation:delete_link :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Nettoie tout le tableau d'enquête (investigation:clear_all) - Réservé MJ
   */
  socket.on('investigation:clear_all', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        return callback?.({ success: false, error: 'Seul le Maître du Jeu peut réinitialiser le tableau.' });
      }

      const success = roomManager.clearInvestigation(roomId);
      if (success) {
        io.to(roomId).emit('investigation:cleared');
      }

      if (typeof callback === 'function') {
        callback({ success });
      }
    } catch (err) {
      console.error('[MapHandler Error] investigation:clear_all :', err.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: err.message });
      }
    }
  });

  /**
   * Diffusion et enregistrement des traces de craie libre (draw:stroke)
   */
  socket.on('draw:stroke', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const stroke = data?.stroke;

      if (!stroke || !Array.isArray(stroke.points) || stroke.points.length === 0) {
        if (typeof callback === 'function') callback({ success: false, error: 'Trace invalide' });
        return;
      }

      if (stroke.isEphemeral) {
        // Trace ephemere : diffusion immediate a tous les autres clients dans la salle sans ecriture disque
        socket.to(roomId).emit('draw:stroke', { stroke });
        if (typeof callback === 'function') callback({ success: true, stroke });
      } else {
        // Trace permanent : sauvegarde dans la scene active et diffusion aux autres clients
        const savedStroke = roomManager.addDrawing(roomId, stroke);
        if (savedStroke) {
          socket.to(roomId).emit('draw:stroke', { stroke: savedStroke });
          if (typeof callback === 'function') callback({ success: true, stroke: savedStroke });
        } else {
          if (typeof callback === 'function') callback({ success: false, error: 'Echec enregistrement trace' });
        }
      }
    } catch (err) {
      console.error('[MapHandler Error] draw:stroke :', err.message);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  /**
   * Effacement d'un trace de craie permanent cible (draw:erase)
   */
  socket.on('draw:erase', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { drawingId } = data || {};

      if (!drawingId) {
        if (typeof callback === 'function') callback({ success: false, error: 'Identifiant de trace manquant' });
        return;
      }

      const success = roomManager.deleteDrawing(roomId, drawingId);
      if (success) {
        io.to(roomId).emit('draw:erased', { drawingId });
      }

      if (typeof callback === 'function') callback({ success });
    } catch (err) {
      console.error('[MapHandler Error] draw:erase :', err.message);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  /**
   * Effacement des traces de craie (draw:clear) - par auteur ou global (MJ)
   */
  socket.on('draw:clear', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { author, all, role } = data || {};

      if (all && !isUserMJ(socket, roomId, role)) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Seul le Maitre du Jeu peut effacer l\'ardoise complete.' });
        }
        return;
      }

      const success = roomManager.clearDrawings(roomId, { author, all });
      if (success) {
        io.to(roomId).emit('draw:cleared', { author, all });
      }

      if (typeof callback === 'function') callback({ success });
    } catch (err) {
      console.error('[MapHandler Error] draw:clear :', err.message);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  /**
   * Signal d'attention anime / Ping lumineux (map:ping)
   */
  socket.on('map:ping', (data) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const author = data?.author || (isUserMJ(socket, roomId, data?.role) ? 'Maitre du Jeu' : 'Aventurier');
      const ping = {
        id: `ping_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        x: Number(data?.x) || 0,
        y: Number(data?.y) || 0,
        color: data?.color || '#f59e0b',
        author,
        createdAt: Date.now()
      };

      io.to(roomId).emit('map:ping', { ping });
    } catch (err) {
      console.error('[MapHandler Error] map:ping :', err.message);
    }
  });

  // ============================================================
  // OBJETS & ELEMENTS INTERACTIFS BAC A SABLE (FEATURE 3)
  // ============================================================

  /**
   * Ajout d'un nouvel objet interactif par le MJ
   */
  socket.on('prop:add', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { prop: propData, role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Seul le Maitre du Jeu peut deposer des objets interactifs.' });
        }
        return;
      }

      const prop = roomManager.addProp(roomId, propData);
      if (prop) {
        io.to(roomId).emit('prop:added', { prop });
        if (typeof callback === 'function') callback({ success: true, prop });
      } else {
        if (typeof callback === 'function') callback({ success: false, error: 'Echec de creation de l\'objet.' });
      }
    } catch (err) {
      console.error('[MapHandler Error] prop:add :', err.message);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  /**
   * Mise a jour d'un objet interactif par le MJ
   */
  socket.on('prop:update', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { propId, updates, role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Seul le Maitre du Jeu peut modifier cet objet.' });
        }
        return;
      }

      const prop = roomManager.updateProp(roomId, propId, updates);
      if (prop) {
        io.to(roomId).emit('prop:updated', { prop });
        if (typeof callback === 'function') callback({ success: true, prop });
      } else {
        if (typeof callback === 'function') callback({ success: false, error: 'Objet introuvable.' });
      }
    } catch (err) {
      console.error('[MapHandler Error] prop:update :', err.message);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  /**
   * Deplacement d'un objet interactif
   */
  socket.on('prop:move', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { propId, x, y, role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Seul le Maitre du Jeu peut deplacer des objets.' });
        }
        return;
      }

      const prop = roomManager.updateProp(roomId, propId, { x, y });
      if (prop) {
        io.to(roomId).emit('prop:moved', { propId, x: prop.x, y: prop.y });
        if (typeof callback === 'function') callback({ success: true, prop });
      } else {
        if (typeof callback === 'function') callback({ success: false });
      }
    } catch (err) {
      console.error('[MapHandler Error] prop:move :', err.message);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  /**
   * Suppression d'un objet interactif par le MJ
   */
  socket.on('prop:remove', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { propId, role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Seul le Maitre du Jeu peut supprimer un objet.' });
        }
        return;
      }

      const success = roomManager.removeProp(roomId, propId);
      if (success) {
        io.to(roomId).emit('prop:removed', { propId });
      }
      if (typeof callback === 'function') callback({ success });
    } catch (err) {
      console.error('[MapHandler Error] prop:remove :', err.message);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  /**
   * Declenchement de la porte liee a un objet (ex: levier qui ouvre une herse)
   */
  socket.on('prop:trigger_door', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { propId, role } = data || {};

      if (!isUserMJ(socket, roomId, role)) {
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Action reservee au Maitre du Jeu.' });
        }
        return;
      }

      const room = roomManager.getRoom(roomId);
      const scene = room?.map || room?.scenes?.find((s) => s.id === room.activeSceneId);
      const prop = scene?.props?.find((p) => p.id === propId);

      if (!prop || !prop.linkedDoorId) {
        if (typeof callback === 'function') callback({ success: false, error: 'Aucune porte liee a cet objet.' });
        return;
      }

      const door = (scene.walls || []).find((w) => w.id === prop.linkedDoorId);
      if (!door) {
        if (typeof callback === 'function') callback({ success: false, error: 'Porte liee introuvable sur la carte.' });
        return;
      }

      door.isOpen = !door.isOpen;
      door.blocksLight = !door.isOpen;
      door.blocksMovement = !door.isOpen;
      door.isLocked = false; // Le mécanisme déverrouille aussi la porte
      roomManager.triggerAutoSave();

      io.to(roomId).emit('map:door_toggled', { doorId: door.id, door });
      if (typeof callback === 'function') callback({ success: true, door, isOpen: door.isOpen });
    } catch (err) {
      console.error('[MapHandler Error] prop:trigger_door :', err.message);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  /**
   * Exportation d'un document ou description d'objet vers le carnet d'enquete
   */
  socket.on('prop:export_investigation', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { propId, author } = data || {};

      const clue = roomManager.exportPropToInvestigation(roomId, propId, author || 'Maitre du Jeu');
      if (clue) {
        io.to(roomId).emit('investigation:clue_added', { clue });
        if (typeof callback === 'function') callback({ success: true, clue });
      } else {
        if (typeof callback === 'function') callback({ success: false, error: 'Impossible d\'exporter l\'objet.' });
      }
    } catch (err) {
      console.error('[MapHandler Error] prop:export_investigation :', err.message);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });
}

module.exports = registerMapHandlers;
