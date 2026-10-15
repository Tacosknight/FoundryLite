const roomManager = require('../state/RoomManager');
const roomService = require('../services/roomService');

/**
 * Paquetages de départ stricts par Classe :
 * 2 objets physiques + 1 sort ou compétence de classe
 */
const CLASS_STARTING_PACKAGES = {
  guerrier: [
    { name: 'Épée longue d\'acier trempé', type: 'item', icon: '🗡️' },
    { name: 'Potion de soin mineure', type: 'item', icon: '🧪' },
    { name: 'Second Souffle', type: 'spell', icon: '🛡️' }
  ],
  mage: [
    { name: 'Bâton de sorcier gravé', type: 'item', icon: '🪄' },
    { name: 'Fiole de mana concentrée', type: 'item', icon: '🧪' },
    { name: 'Boule de Feu', type: 'spell', icon: '🔥' }
  ],
  voleur: [
    { name: 'Dagues jumelles effilées', type: 'item', icon: '🗡️' },
    { name: 'Outils de crochetage complexes', type: 'item', icon: '🗝️' },
    { name: 'Attaque Sournoise', type: 'spell', icon: '👤' }
  ],
  clerc: [
    { name: 'Masse d\'armes sanctifiée', type: 'item', icon: '🔨' },
    { name: 'Symbole sacré en argent pur', type: 'item', icon: '✨' },
    { name: 'Prière de Guérison', type: 'spell', icon: '☀️' }
  ],
  rodeur: [
    { name: 'Arc long en if & carquois', type: 'item', icon: '🏹' },
    { name: 'Piège à loup en fer forgé', type: 'item', icon: '⛓️' },
    { name: 'Tir Précis Mortel', type: 'spell', icon: '🎯' }
  ],
  paladin: [
    { name: 'Espadon de justice éclatant', type: 'item', icon: '⚔️' },
    { name: 'Flasque d\'eau lustrale', type: 'item', icon: '🧪' },
    { name: 'Châtiment Radiant', type: 'spell', icon: '⚡' }
  ]
};

/**
 * Enregistre les écouteurs d'événements Socket.io pour la gestion des personnages
 * @param {import('socket.io').Server} io - Instance du serveur Socket.io
 * @param {import('socket.io').Socket} socket - Socket du client connecté
 */
function registerCharHandlers(io, socket) {
  /**
   * Création et personnalisation d'un personnage joueur (char:create)
   * data: { roomId: string, name: string, raceId: string, classId: string, title?: string, attributes?: object }
   */
  socket.on('char:create', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { name, raceId, classId, title, attributes, color } = data || {};

      if (!name || typeof name !== 'string' || !name.trim()) {
        throw new Error('Veuillez donner un nom à votre personnage.');
      }
      if (!raceId) {
        throw new Error('Veuillez sélectionner une race.');
      }
      if (!classId) {
        throw new Error('Veuillez sélectionner une classe.');
      }

      // Vérification des attributs : l'ensemble des 20 points doivent être dépensés
      if (attributes && typeof attributes === 'object') {
        const f = Math.max(8, Math.min(18, Number(attributes.force) || 8));
        const d = Math.max(8, Math.min(18, Number(attributes.dexterite) || 8));
        const i = Math.max(8, Math.min(18, Number(attributes.intelligence) || 8));
        const c = Math.max(8, Math.min(18, Number(attributes.charisme) || 8));
        const totalSpent = (f - 8) + (d - 8) + (i - 8) + (c - 8);
        if (totalSpent < 20) {
          throw new Error(`Tous les 20 points d'attributs doivent être dépensés avant de forger votre héros (dépensés : ${totalSpent}/20).`);
        }
      }

      // Calcul des stats réelles et enregistrement côté serveur
      const character = roomManager.createOrUpdatePlayerCharacter(roomId, socket.id, {
        name: name.trim(),
        raceId: raceId.trim(),
        classId: classId.trim(),
        title: title ? String(title).trim() : '',
        attributes: attributes || null,
        color: color || null
      });

      // Attribution automatique du paquetage de départ strict selon la classe choisie
      const cleanClassId = String(classId).toLowerCase().trim();
      const startingPackage = CLASS_STARTING_PACKAGES[cleanClassId] || [];
      character.inventory = startingPackage.map((item, idx) => ({
        id: `start_${cleanClassId}_${Date.now()}_${idx}`,
        name: item.name,
        type: item.type || 'item',
        icon: item.icon || '📦',
        qty: item.qty || 1,
        desc: item.type === 'spell' ? 'Capacité innée de classe' : 'Équipement de départ',
        imgUrl: null
      }));
      roomManager.triggerAutoSave();

      const allCharacters = roomManager.getCharacters(roomId);

      // Notification globale de mise à jour des fiches
      io.to(roomId).emit('char:sync_all', {
        roomId,
        characters: allCharacters
      });

      console.log(`[CharCreate] Personnage créé pour ${socket.id} : ${character.name} "${character.title || ''}" (${character.race} ${character.class})`);

      if (typeof callback === 'function') {
        callback({
          success: true,
          character,
          characters: allCharacters
        });
      }
    } catch (error) {
      console.error(`[CharCreate Error] ${error.message}`);
      if (typeof callback === 'function') {
        callback({ success: false, error: error.message });
      }
    }
  });

  /**
   * Renommage d'un personnage déjà forgé (char:rename)
   * data: { roomId: string, name: string }
   * Met à jour le nom du personnage, propage les fiches et remplace les anciens noms dans le chat
   */
  socket.on('char:rename', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const newName = (data?.name || '').trim();

      if (!newName) {
        throw new Error('Veuillez renseigner un nouveau nom pour votre héros.');
      }

      const roomObj = roomManager.getRoom(roomId);
      const character = roomObj?.characters?.find((c) => c.socketId === socket.id);

      if (!character) {
        throw new Error('Aucun personnage associé à votre session.');
      }

      const oldName = character.name;
      character.name = newName;
      roomObj.updatedAt = new Date().toISOString();
      roomManager.triggerAutoSave();

      const allCharacters = roomManager.getCharacters(roomId);

      // 1. Notification de synchronisation des fiches de personnages
      io.to(roomId).emit('char:sync_all', {
        roomId,
        characters: allCharacters
      });

      // 2. Notification de mise à jour des anciens messages de la taverne
      io.to(roomId).emit('chat:rename_sender', {
        roomId,
        oldName,
        newName,
        socketId: socket.id,
        color: character.color
      });

      console.log(`[CharRename] ${socket.id} s'est renommé : "${oldName}" -> "${newName}"`);

      if (typeof callback === 'function') {
        callback({
          success: true,
          character,
          oldName,
          newName,
          characters: allCharacters
        });
      }
    } catch (error) {
      console.error(`[CharRename Error] ${error.message}`);
      if (typeof callback === 'function') {
        callback({ success: false, error: error.message });
      }
    }
  });

  /**
   * Génération aléatoire d'attributs par le serveur :
   * Tous les 20 points sont dépensés aléatoirement (Base 8, Max 15, Points restants = 0).
   */
  socket.on('char:roll_stats', (callback) => {
    try {
      const stats = {
        force: 8,
        dexterite: 8,
        intelligence: 8,
        charisme: 8
      };
      const keys = ['force', 'dexterite', 'intelligence', 'charisme'];
      let pointsToDistribute = 20;

      while (pointsToDistribute > 0) {
        // Sélection des caractéristiques qui n'ont pas encore atteint le cap de 15
        const availableKeys = keys.filter((k) => stats[k] < 15);
        if (availableKeys.length === 0) break;
        const chosenKey = availableKeys[Math.floor(Math.random() * availableKeys.length)];
        stats[chosenKey]++;
        pointsToDistribute--;
      }

      console.log(`[CharRollStats] Répartition aléatoire des 20 points pour ${socket.id} : FOR=${stats.force}, DEX=${stats.dexterite}, INT=${stats.intelligence}, CHA=${stats.charisme} (Points restants: 0/20)`);

      if (typeof callback === 'function') {
        callback({ success: true, stats });
      }
    } catch (error) {
      console.error(`[CharRollStats Error] ${error.message}`);
      if (typeof callback === 'function') {
        callback({ success: false, error: error.message });
      }
    }
  });

  /**
   * Récupération de l'état initial des personnages
   */
  socket.on('char:get_all', (data, callback) => {
    try {
      const roomId = data?.roomId || 'table-ronde';
      const characters = roomManager.getCharacters(roomId);
      if (typeof callback === 'function') {
        callback({ success: true, characters });
      }
    } catch (error) {
      if (typeof callback === 'function') {
        callback({ success: false, error: error.message });
      }
    }
  });

  /**
   * Modification des PV ou de l'Énergie d'un slot de personnage (Réservé au MJ)
   * data: { roomId: string, slot: number, hpChange?: number, energyChange?: number, role?: string }
   */
  socket.on('char:update_vitals', (data, callback) => {
    try {
      const { roomId = 'table-ronde', slot, hpChange = 0, energyChange = 0, role: clientRole } = data || {};

      // Vérification permission MJ (socket.data, rôle transmis, ou session utilisateur en base)
      const room = roomService.rooms.get(roomId);
      const user = room?.users?.find((u) => u.socketId === socket.id);
      const isMJ = socket.data?.user?.role === 'mj' || clientRole === 'mj' || user?.role === 'mj';

      if (!isMJ) {
        throw new Error('Action non autorisée : seul le Maître du Jeu peut modifier les valeurs des personnages.');
      }

      // Mise à jour de l'état dans le RoomManager (avec debounce de sauvegarde intégré)
      const updatedCharacter = roomManager.updateCharacterVitals(roomId, slot, {
        hpChange: Number(hpChange),
        energyChange: Number(energyChange)
      });

      const payload = {
        roomId,
        slot: Number(slot),
        character: updatedCharacter
      };

      // Émission à tous les clients connectés (canal spécifique de la salle + broadcast global de secours)
      io.to(roomId).emit('char:vitals_updated', payload);
      io.emit('char:vitals_updated', payload);

      // Accusé de réception optionnel pour l'émetteur
      if (typeof callback === 'function') {
        callback({ success: true, character: updatedCharacter });
      }
    } catch (error) {
      console.error(`[CharHandler Error] Échec update_vitals (${socket.id}) :`, error.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: error.message });
      }
    }
  });

  /**
   * Édition complète du personnage (réservée au MJ : nom, classe, PV max/actuels, Énergie max/actuelle)
   * data: { roomId: string, slot: number, fields: { name, class, hp, maxHp, energy, maxEnergy }, role?: string }
   */
  socket.on('char:update_full', (data, callback) => {
    try {
      const { roomId = 'table-ronde', slot, fields, role: clientRole } = data || {};

      // Vérification permission MJ (socket.data, rôle transmis, ou session utilisateur en base)
      const room = roomService.rooms.get(roomId);
      const user = room?.users?.find((u) => u.socketId === socket.id);
      const isMJ = socket.data?.user?.role === 'mj' || clientRole === 'mj' || user?.role === 'mj';

      if (!isMJ) {
        throw new Error('Action non autorisée : seul le Maître du Jeu peut modifier les fiches de personnages.');
      }

      const updatedCharacter = roomManager.updateCharacterFull(roomId, slot, fields);

      const payload = {
        roomId,
        slot: Number(slot),
        character: updatedCharacter
      };

      // Émission instantanée à tous les clients connectés (canal spécifique + broadcast global)
      io.to(roomId).emit('char:vitals_updated', payload);
      io.emit('char:vitals_updated', payload);

      console.log(`[MJ Edit] Slot ${slot} (${updatedCharacter.name}) mis à jour par le MJ.`);

      if (typeof callback === 'function') {
        callback({ success: true, character: updatedCharacter });
      }
    } catch (error) {
      console.error(`[CharHandler Error] Échec update_full (${socket.id}) :`, error.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: error.message });
      }
    }
  });
}

module.exports = registerCharHandlers;
