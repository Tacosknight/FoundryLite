const fs = require('fs/promises');
const path = require('path');

const ROOMS_FILE_PATH = path.join(__dirname, '../../data/rooms.json');
const DEFAULT_DEBOUNCE_DELAY_MS = 1000;

/**
 * 4 fiches de personnages par défaut
 */
const DEFAULT_CHARACTERS = [
  { slot: 0, name: 'Valeros', class: 'Guerrier', hp: 28, maxHp: 30, energy: 10, maxEnergy: 10 },
  { slot: 1, name: 'Kyra', class: 'Prêtresse', hp: 22, maxHp: 24, energy: 15, maxEnergy: 15 },
  { slot: 2, name: 'Merisiel', class: 'Voleuse', hp: 18, maxHp: 20, energy: 12, maxEnergy: 12 },
  { slot: 3, name: 'Ezren', class: 'Magicien', hp: 14, maxHp: 16, energy: 20, maxEnergy: 20 }
];

/**
 * Catalogue des 11 altérations d'état et bénédictions tactiques
 */
const RPG_CONDITIONS = {
  blinded: { id: 'blinded', name: 'Aveuglé', icon: '[x_x]', color: '#64748b', desc: 'Vision réduite à 0 case. Obscurité totale.' },
  prone: { id: 'prone', name: 'À terre', icon: '[v]', color: '#78716c', desc: 'Vitesse de déplacement divisée par deux.' },
  restrained: { id: 'restrained', name: 'Entravé', icon: '[#]', color: '#a8a29e', desc: 'Vitesse de déplacement bloquée (0).' },
  invisible: { id: 'invisible', name: 'Invisible', icon: '[?]', color: '#38bdf8', desc: 'Invisible même avec ligne de vue directe.' },
  burning: { id: 'burning', name: 'Brûlé', icon: '[♨]', color: '#f97316', desc: 'Flammes ardentes périodiques.' },
  poisoned: { id: 'poisoned', name: 'Empoisonné', icon: '[☣]', color: '#22c55e', desc: 'Vapeurs et toxines affaiblissantes.' },
  cursed: { id: 'cursed', name: 'Maudit', icon: '[☠]', color: '#a855f7', desc: 'Affliction et runes nécrotiques.' },
  blessed: { id: 'blessed', name: 'Béni', icon: '[✦]', color: '#eab308', desc: 'Grâce et éclat divin protecteur.' },
  asleep: { id: 'asleep', name: 'Endormi', icon: '[Zz]', color: '#6366f1', desc: 'Sommeil magique profond. Incapable d\'agir.' },
  charmed: { id: 'charmed', name: 'Amoureux', icon: '[<3]', color: '#ec4899', desc: 'Envoûté et pacifié par le charme.' },
  confused: { id: 'confused', name: 'Confus', icon: '[~?]', color: '#e11d48', desc: 'Vertige et désorientation mentale.' }
};

class RoomManager {
  constructor(filePath = ROOMS_FILE_PATH, debounceDelay = DEFAULT_DEBOUNCE_DELAY_MS) {
    this.filePath = filePath;
    this.debounceDelay = debounceDelay;
    this.rooms = new Map();
    this.debounceTimer = null;
    this.isInitialized = false;
  }

  /**
   * Modèle de carte tactique par défaut
   */
  createDefaultMap(name = 'Scène Principale', backgroundUrl = null) {
    return {
      name,
      backgroundUrl,
      gridSize: 0,
      snapToGrid: false,
      fogEnabled: true,
      lightingMode: 'day', // 'day' ou 'night'
      lights: [],          // Sources de lumière fixes [{ id, x, y, radius, color, type, label, enabled }]
      tokens: [],
      revealedAreas: [],
      walls: [],
      zones: [],          // Terrains difficiles et zones de danger [{ id, name, type, subType, shape, x, y, w, h, r, color, effect }]
      traps: [],          // Pièges et découvertes dissimulées [{ id, name, type, subType, x, y, r, dc, damage, condition, revealed, triggered, disarmed }]
      teleporters: [],    // Téléporteurs et transitions [{ id, name, type, x, y, r, targetSceneId, targetX, targetY, active }]
      drawings: [],       // Dessins permanents à la craie [{ id, author, color, width, points: [{x, y}], createdAt }]
      props: [],          // Objets et éléments interactifs Bac à Sable [{ id, name, icon, imageUrl, x, y, size, description, secretNotes, revealedDoc, isDocRevealed, linkedDoorId, stateLabel, interactionRadius }]
      currentTurn: null,
      turnSystem: {
        round: 1,
        turnOrder: [],
        currentIndex: 0,
        active: false
      }
    };
  }

  /**
   * Modèle de salle par défaut : au départ, aucun personnage tant que des joueurs n'ont pas rejoint
   */
  createDefaultRoom(roomId) {
    const defaultSceneId = `scene_${Date.now()}_1`;
    const defaultScene = {
      id: defaultSceneId,
      ...this.createDefaultMap('Rez-de-chaussée')
    };

    return {
      id: roomId,
      password: null, // Mot de passe optionnel
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      characters: [],
      activeSceneId: defaultSceneId,
      scenes: [defaultScene],
      map: defaultScene, // Pointeur direct vers la scène active
      investigation: {
        clues: [],
        links: []
      },
      isSaved: false
    };
  }

  /**
   * Supprime une salle en mémoire et sur le disque si non sauvegardée
   */
  async deleteRoom(roomId) {
    const cleanId = (roomId || '').trim();
    if (this.rooms.has(cleanId)) {
      this.rooms.delete(cleanId);
      await this.persist();
      console.log(`[RoomManager] 🗑️ Salle "${cleanId}" supprimée et données nettoyées.`);
    }
  }

  /**
   * Marque une salle comme sauvegardée définitivement
   */
  async saveRoom(roomId) {
    const room = this.getRoom(roomId);
    if (room) {
      room.isSaved = true;
      room.updatedAt = new Date().toISOString();
      await this.persist();
      console.log(`[RoomManager] 💾 Salle "${roomId}" sauvegardée avec succès.`);
      return room;
    }
    return null;
  }

  /**
   * Charge les données depuis le fichier JSON au démarrage
   */
  async init() {
    if (this.isInitialized) return;

    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(data || '{}');

      for (const [id, room] of Object.entries(parsed)) {
        if (!room.characters || !Array.isArray(room.characters)) {
          room.characters = [];
        }
        if (!room.map || typeof room.map !== 'object') {
          room.map = this.createDefaultMap();
        } else {
          if (!Array.isArray(room.map.tokens)) room.map.tokens = [];
          if (!Array.isArray(room.map.revealedAreas)) room.map.revealedAreas = [];
          if (!Array.isArray(room.map.walls)) room.map.walls = [];
          if (!Array.isArray(room.map.zones)) room.map.zones = [];
          if (!Array.isArray(room.map.traps)) room.map.traps = [];
          if (!Array.isArray(room.map.teleporters)) room.map.teleporters = [];
          if (!Array.isArray(room.map.drawings)) room.map.drawings = [];
          if (!Array.isArray(room.map.props)) room.map.props = [];
          if (typeof room.map.gridSize !== 'number') room.map.gridSize = 50;
          if (typeof room.map.snapToGrid !== 'boolean') room.map.snapToGrid = true;
        }

        if (!room.scenes || !Array.isArray(room.scenes) || room.scenes.length === 0) {
          const defaultSceneId = 'scene_default';
          const scene = {
            id: defaultSceneId,
            name: 'Rez-de-chaussée',
            ...(room.map || this.createDefaultMap())
          };
          if (!Array.isArray(scene.teleporters)) scene.teleporters = [];
          if (!Array.isArray(scene.drawings)) scene.drawings = [];
          if (!Array.isArray(scene.props)) scene.props = [];
          room.scenes = [scene];
          room.activeSceneId = defaultSceneId;
          room.map = scene;
        } else {
          room.scenes.forEach((sc, idx) => {
            if (!sc.id) sc.id = `scene_${idx + 1}`;
            if (!sc.name) sc.name = `Scène ${idx + 1}`;
            if (!Array.isArray(sc.tokens)) sc.tokens = [];
            if (!Array.isArray(sc.revealedAreas)) sc.revealedAreas = [];
            if (!Array.isArray(sc.walls)) sc.walls = [];
            if (!Array.isArray(sc.lights)) sc.lights = [];
            if (!Array.isArray(sc.zones)) sc.zones = [];
            if (!Array.isArray(sc.traps)) sc.traps = [];
            if (!Array.isArray(sc.teleporters)) sc.teleporters = [];
            if (!Array.isArray(sc.drawings)) sc.drawings = [];
            if (!Array.isArray(sc.props)) sc.props = [];
            if (typeof sc.gridSize !== 'number') sc.gridSize = 0;
            if (typeof sc.snapToGrid !== 'boolean') sc.snapToGrid = false;
            if (typeof sc.fogEnabled !== 'boolean') sc.fogEnabled = true;
            if (!sc.lightingMode) sc.lightingMode = 'day';
          });
          if (!room.activeSceneId || !room.scenes.some((s) => s.id === room.activeSceneId)) {
            room.activeSceneId = room.scenes[0].id;
          }
          room.map = room.scenes.find((s) => s.id === room.activeSceneId);
        }

        room.isSaved = true;
        this.rooms.set(id, room);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('[RoomManager] Erreur lecture fichier rooms.json :', error.message);
      }
    }

    this.isInitialized = true;
  }

  /**
   * Récupère une salle en mémoire ou l'initialise
   */
  getRoom(roomId = 'table-ronde') {
    const cleanId = (roomId || 'table-ronde').trim();
    if (!this.rooms.has(cleanId)) {
      this.rooms.set(cleanId, this.createDefaultRoom(cleanId));
    }
    const room = this.rooms.get(cleanId);
    if (!room.scenes || !Array.isArray(room.scenes) || room.scenes.length === 0) {
      const defaultSceneId = 'scene_default';
      const scene = {
        id: defaultSceneId,
        name: 'Rez-de-chaussée',
        ...(room.map || this.createDefaultMap())
      };
      if (!Array.isArray(scene.teleporters)) scene.teleporters = [];
      room.scenes = [scene];
      room.activeSceneId = defaultSceneId;
      room.map = scene;
    } else {
      const activeScene = room.scenes.find((s) => s.id === room.activeSceneId) || room.scenes[0];
      room.activeSceneId = activeScene.id;
      room.map = activeScene;
      if (!Array.isArray(activeScene.teleporters)) activeScene.teleporters = [];
    }
    return room;
  }

  /**
   * Récupère la liste des personnages d'une salle
   */
  getCharacters(roomId = 'table-ronde') {
    const room = this.getRoom(roomId);
    return room.characters;
  }

  /**
   * Crée ou met à jour le personnage d'un joueur suite à sa personnalisation (char:create)
   * @param {string} roomId 
   * @param {string} socketId 
   * @param {Object} characterData { name, raceId, classId, title, attributes, color }
   */
  createOrUpdatePlayerCharacter(roomId, socketId, { name, raceId, classId, title, attributes, color }) {
    const { calculateCharacterStats } = require('../data/rpgRules');
    const room = this.getRoom(roomId);
    if (!room.characters) room.characters = [];

    const stats = calculateCharacterStats(raceId, classId);
    const cleanName = (name || '').trim();
    if (!cleanName) {
      throw new Error('Le nom du héros ne peut pas être vide.');
    }

    const defaultAttributes = { force: 8, dexterite: 8, intelligence: 8, charisme: 8 };
    const charAttributes = attributes && typeof attributes === 'object' ? {
      force: Number(attributes.force) || 8,
      dexterite: Number(attributes.dexterite) || 8,
      intelligence: Number(attributes.intelligence) || 8,
      charisme: Number(attributes.charisme) || 8
    } : defaultAttributes;

    const charTitle = title ? String(title).trim() : '';

    // Nettoyage et sécurisation de la couleur :
    // Le Jaune (#eab308, #f59e0b, #facc15, #fbbf24, etc.) est strictement réservé au Maître du Jeu 👑.
    let charColor = color && typeof color === 'string' ? color.trim().toLowerCase() : '#ef4444';
    const FORBIDDEN_PLAYER_COLORS = ['#eab308', '#facc15', '#f59e0b', '#fbbf24', '#d97706', 'yellow', 'gold'];
    if (FORBIDDEN_PLAYER_COLORS.includes(charColor) || charColor.startsWith('#fa') || charColor.startsWith('#ea')) {
      charColor = '#ef4444'; // Repli sur Cramoisi si tentative de choisir jaune
    }

    // Sécurité couleur unique : vérifier si un autre héros de la salle utilise déjà cette couleur
    const colorTakenByOther = room.characters.some(c => 
      c.color && 
      c.color.toLowerCase() === charColor.toLowerCase() && 
      c.socketId !== socketId && 
      (!c.name || c.name.toLowerCase() !== cleanName.toLowerCase())
    );
    if (colorTakenByOther) {
      throw new Error(`Cette couleur est déjà portée par un autre compagnon de table. Veuillez en choisir une autre.`);
    }

    // Recherche si un personnage existe déjà par socketId ou par son nom (sauvegarde précédente)
    let existingChar = room.characters.find(c => c.socketId === socketId || (c.name && c.name.toLowerCase() === cleanName.toLowerCase()));

    if (existingChar) {
      // Mise à jour du personnage existant et association au socket actuel
      existingChar.socketId = socketId;
      existingChar.name = cleanName;
      existingChar.title = charTitle;
      existingChar.color = charColor;
      existingChar.attributes = charAttributes;
      existingChar.race = stats.race;
      existingChar.raceId = stats.raceId;
      existingChar.raceIcon = stats.raceIcon;
      existingChar.class = stats.class;
      existingChar.classId = stats.classId;
      existingChar.classIcon = stats.classIcon;
      existingChar.role = stats.role;
      existingChar.hp = stats.maxHp;
      existingChar.maxHp = stats.maxHp;
      existingChar.energy = stats.maxEnergy;
      existingChar.maxEnergy = stats.maxEnergy;
      existingChar.passive = stats.passive;
      existingChar.created = true;
    } else {
      if (room.characters.length >= 4) {
        throw new Error('La table a déjà atteint le maximum de 4 personnages.');
      }
      const slot = room.characters.length;
      existingChar = {
        slot,
        socketId,
        name: cleanName,
        title: charTitle,
        color: charColor,
        attributes: charAttributes,
        race: stats.race,
        raceId: stats.raceId,
        raceIcon: stats.raceIcon,
        class: stats.class,
        classId: stats.classId,
        classIcon: stats.classIcon,
        role: stats.role,
        hp: stats.maxHp,
        maxHp: stats.maxHp,
        energy: stats.maxEnergy,
        maxEnergy: stats.maxEnergy,
        passive: stats.passive,
        inventory: [],
        created: true
      };
      room.characters.push(existingChar);
    }

    room.updatedAt = new Date().toISOString();
    this.syncPlayerTokens(roomId);
    this.triggerAutoSave();
    return existingChar;
  }

  /**
   * Ajoute ou assigne un personnage à un joueur rejoignant la salle (max 4)
   * @param {string} roomId 
   * @param {string} username 
   * @param {string} socketId 
   */
  addPlayerCharacter(roomId, username, socketId) {
    const room = this.getRoom(roomId);
    if (!room.characters) room.characters = [];

    // Vérifier si ce joueur a déjà un slot associé
    const existing = room.characters.find(c => c.socketId === socketId);
    if (existing) return existing;

    if (room.characters.length >= 4) {
      throw new Error('La table a déjà atteint le maximum de 4 personnages joueurs.');
    }

    const slot = room.characters.length;
    const defaultTemplate = DEFAULT_CHARACTERS[slot] || {
      name: username,
      class: 'Aventurier',
      hp: 20,
      maxHp: 20,
      energy: 10,
      maxEnergy: 10
    };

    const newChar = {
      slot,
      socketId,
      name: username || defaultTemplate.name,
      race: 'Humain',
      raceId: 'humain',
      raceIcon: '👤',
      class: defaultTemplate.class,
      classId: 'guerrier',
      classIcon: '🛡️',
      role: 'Aventurier',
      hp: defaultTemplate.hp,
      maxHp: defaultTemplate.maxHp,
      energy: defaultTemplate.energy,
      maxEnergy: defaultTemplate.maxEnergy,
      passive: {
        name: 'Volonté Indomptable',
        description: 'Équilibré en toutes circonstances (+2 PV Max, +2 Énergie Max).'
      },
      created: false
    };

    room.characters.push(newChar);
    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();
    return newChar;
  }

  /**
   * Supprime le personnage du joueur lors de sa déconnexion,
   * SAUF si la salle est sauvegardée (auquel cas les données du héros sont conservées).
   */
  removePlayerCharacter(roomId, socketId) {
    const room = this.getRoom(roomId);
    if (!room || !Array.isArray(room.characters)) return null;

    if (room.isSaved) {
      // Dans une salle sauvegardée, on détache simplement le socketId pour permettre au joueur de revenir plus tard
      const char = room.characters.find(c => c.socketId === socketId);
      if (char) {
        char.socketId = null;
        this.triggerAutoSave();
        return char;
      }
      return null;
    }

    const charIndex = room.characters.findIndex(c => c.socketId === socketId);
    if (charIndex !== -1) {
      const [removedChar] = room.characters.splice(charIndex, 1);
      // Réindexer les slots restants
      room.characters.forEach((c, idx) => {
        c.slot = idx;
      });
      this.syncPlayerTokens(roomId);
      room.updatedAt = new Date().toISOString();
      this.triggerAutoSave();
      return removedChar;
    }
    return null;
  }

  /**
   * Met à jour les PV et/ou l'Énergie d'un slot de personnage
   * @param {string} roomId Identifiant de la salle
   * @param {number|string} slot Index du personnage (0 à 3)
   * @param {Object} delta { hpChange: number, energyChange: number }
   * @returns {Object} Le personnage mis à jour
   */
  updateCharacterVitals(roomId, slot, { hpChange = 0, energyChange = 0 } = {}) {
    const room = this.getRoom(roomId);
    const slotIndex = parseInt(slot, 10);

    if (isNaN(slotIndex) || slotIndex < 0 || slotIndex >= room.characters.length) {
      throw new Error(`Slot de personnage invalide : ${slot}. Doit être compris entre 0 et 3.`);
    }

    const char = room.characters[slotIndex];

    // Variation des PV (borné entre 0 et maxHp)
    if (typeof hpChange === 'number' && !isNaN(hpChange)) {
      char.hp = Math.max(0, Math.min(char.maxHp, char.hp + hpChange));
    }

    // Variation de l'Énergie (borné entre 0 et maxEnergy)
    if (typeof energyChange === 'number' && !isNaN(energyChange)) {
      char.energy = Math.max(0, Math.min(char.maxEnergy, char.energy + energyChange));
    }

    room.updatedAt = new Date().toISOString();

    // Déclenche la sauvegarde différée (debounce)
    this.triggerAutoSave();

    return char;
  }

  /**
   * Édition complète du personnage (réservée au MJ : nom, classe, PV max/actuels, Énergie max/actuelle)
   * @param {string} roomId
   * @param {number|string} slot
   * @param {Object} fields
   */
  updateCharacterFull(roomId, slot, fields = {}) {
    const room = this.getRoom(roomId);
    const slotIndex = parseInt(slot, 10);

    if (isNaN(slotIndex) || slotIndex < 0 || slotIndex >= room.characters.length) {
      throw new Error(`Slot invalide : ${slot}`);
    }

    const char = room.characters[slotIndex];

    if (typeof fields.name === 'string' && fields.name.trim()) {
      char.name = fields.name.trim();
    }
    if (typeof fields.class === 'string' && fields.class.trim()) {
      char.class = fields.class.trim();
    }

    // PV max et ajustement des PV actuels
    if (typeof fields.maxHp === 'number' && !isNaN(fields.maxHp) && fields.maxHp > 0) {
      char.maxHp = fields.maxHp;
    }
    if (typeof fields.hp === 'number' && !isNaN(fields.hp)) {
      char.hp = Math.max(0, Math.min(char.maxHp, fields.hp));
    } else {
      char.hp = Math.min(char.hp, char.maxHp);
    }

    // Énergie max et ajustement de l'énergie actuelle
    if (typeof fields.maxEnergy === 'number' && !isNaN(fields.maxEnergy) && fields.maxEnergy >= 0) {
      char.maxEnergy = fields.maxEnergy;
    }
    if (typeof fields.energy === 'number' && !isNaN(fields.energy)) {
      char.energy = Math.max(0, Math.min(char.maxEnergy, fields.energy));
    } else {
      char.energy = Math.min(char.energy, char.maxEnergy);
    }

    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();

    return char;
  }

  /**
   * Ajoute un objet à l'inventaire d'un personnage
   * @param {string} roomId
   * @param {number|string} slot
   * @param {Object} item { name, desc, qty, imgUrl }
   * @returns {{ character: Object, item: Object }}
   */
  addItemToInventory(roomId, slot, item = {}) {
    const room = this.getRoom(roomId);
    const slotIndex = parseInt(slot, 10);

    if (isNaN(slotIndex) || slotIndex < 0 || slotIndex >= room.characters.length) {
      throw new Error(`Slot de personnage invalide : ${slot}`);
    }

    const char = room.characters[slotIndex];
    if (!Array.isArray(char.inventory)) {
      char.inventory = [];
    }

    const newItem = {
      id: item.id || `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: String(item.name || 'Objet Sans Nom').trim(),
      desc: String(item.desc || '').trim(),
      qty: Math.max(1, parseInt(item.qty, 10) || 1),
      imgUrl: item.imgUrl ? String(item.imgUrl).trim() : null,
      type: item.type || 'item',
      icon: item.icon || '📦',
      createdAt: new Date().toISOString()
    };

    char.inventory.push(newItem);
    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();

    return { character: char, item: newItem };
  }

  /**
   * Supprime un objet de l'inventaire d'un personnage
   * @param {string} roomId
   * @param {number|string} slot
   * @param {string} itemId
   * @returns {{ character: Object, removedItemId: string }}
   */
  removeItemFromInventory(roomId, slot, itemId) {
    const room = this.getRoom(roomId);
    const slotIndex = parseInt(slot, 10);

    if (isNaN(slotIndex) || slotIndex < 0 || slotIndex >= room.characters.length) {
      throw new Error(`Slot de personnage invalide : ${slot}`);
    }

    const char = room.characters[slotIndex];
    if (!Array.isArray(char.inventory)) {
      char.inventory = [];
    }

    char.inventory = char.inventory.filter((i) => String(i.id) !== String(itemId));
    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();

    return { character: char, removedItemId: itemId };
  }

  /**
   * Modifie la quantité d'un objet (incrément / décrément)
   * Supprime l'objet si la quantité tombe à 0 ou moins.
   * @param {string} roomId
   * @param {number|string} slot
   * @param {string} itemId
   * @param {number} delta (ex: +1 ou -1)
   * @returns {{ character: Object, item: Object|null, removed: boolean }}
   */
  updateItemQuantity(roomId, slot, itemId, delta = 0) {
    const room = this.getRoom(roomId);
    const slotIndex = parseInt(slot, 10);

    if (isNaN(slotIndex) || slotIndex < 0 || slotIndex >= room.characters.length) {
      throw new Error(`Slot de personnage invalide : ${slot}`);
    }

    const char = room.characters[slotIndex];
    if (!Array.isArray(char.inventory)) {
      char.inventory = [];
    }

    const itemIndex = char.inventory.findIndex((i) => String(i.id) === String(itemId));
    if (itemIndex === -1) {
      throw new Error(`Objet introuvable dans l'inventaire : ${itemId}`);
    }

    const item = char.inventory[itemIndex];
    const newQty = (parseInt(item.qty, 10) || 1) + parseInt(delta, 10);

    let removed = false;
    if (newQty <= 0) {
      char.inventory.splice(itemIndex, 1);
      removed = true;
    } else {
      item.qty = newQty;
    }

    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();

    return { character: char, item: removed ? null : item, removed };
  }

  /**
   * Synchronise les pions des joueurs avec les personnages enregistrés
   * @param {string} roomId 
   */
  syncPlayerTokens(roomId) {
    const room = this.getRoom(roomId);
    if (!room) return [];
    if (!room.map) room.map = this.createDefaultMap();

    const currentChars = (room.characters || []).filter(c => c && c.created);
    const existingTokens = room.map.tokens || [];

    // Conserver les monstres
    const monsterTokens = existingTokens.filter(t => t.type === 'monster');
    const playerTokens = [];

    existingTokens.filter(t => t.type === 'player').forEach((token) => {
      const char = currentChars.find(c => c.slot === token.slot || (c.name && token.name && c.name.toLowerCase() === token.name.toLowerCase()));
      if (char) {
        token.name = char.name;
        token.color = char.color || token.color;
        token.icon = char.classIcon || char.raceIcon || token.icon;
        token.slot = char.slot;
        token.hp = char.hp;
        token.maxHp = char.maxHp;
        playerTokens.push(token);
      } else {
        playerTokens.push(token);
      }
    });

    room.map.tokens = [...playerTokens, ...monsterTokens];
    return room.map.tokens;
  }

  /**
   * Récupère l'état complet de la carte pour une salle
   * @param {string} roomId 
   */
  getMapState(roomId) {
    const room = this.getRoom(roomId);
    if (!room.map) room.map = this.createDefaultMap();
    this.syncPlayerTokens(roomId);

    const mapState = { ...room.map };
    mapState.activeSceneId = room.activeSceneId;
    if (!Array.isArray(mapState.teleporters)) mapState.teleporters = [];
    mapState.scenes = (room.scenes || []).map((s) => ({
      id: s.id,
      name: s.name,
      backgroundUrl: s.backgroundUrl,
      lightingMode: s.lightingMode,
      fogEnabled: s.fogEnabled,
      tokenCount: (s.tokens || []).length,
      wallCount: (s.walls || []).length,
      teleporterCount: (s.teleporters || []).length
    }));
    return mapState;
  }

  /**
   * Met à jour l'image de fond de la carte
   * @param {string} roomId 
   * @param {string|null} backgroundUrl 
   */
  updateMapBackground(roomId, backgroundUrl) {
    const room = this.getRoom(roomId);
    if (!room.map) room.map = this.createDefaultMap();
    room.map.backgroundUrl = backgroundUrl;
    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();
    return room.map.backgroundUrl;
  }

  /**
   * Déplace un pion sur la carte
   * @param {string} roomId 
   * @param {string} tokenId 
   * @param {number} x 
   * @param {number} y 
   */
  moveToken(roomId, tokenId, x, y) {
    const room = this.getRoom(roomId);
    if (!room.map) room.map = this.createDefaultMap();
    const token = room.map.tokens.find(t => t.id === tokenId);
    if (!token) {
      throw new Error(`Pion introuvable sur la carte (ID: ${tokenId})`);
    }
    token.x = Number(x);
    token.y = Number(y);
    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();
    return token;
  }

  /**
   * Ajoute un pion (Monstre ou PNJ) sur la carte
   * @param {string} roomId 
   * @param {Object} tokenData 
   */
  addToken(roomId, tokenData) {
    const room = this.getRoom(roomId);
    if (!room.map) room.map = this.createDefaultMap();
    const id = `token_monster_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newToken = {
      id,
      type: 'monster',
      name: tokenData.name || 'Monstre',
      icon: tokenData.icon || '👹',
      color: tokenData.color || '#dc2626',
      x: Number(tokenData.x) || 200,
      y: Number(tokenData.y) || 200,
      size: Number(tokenData.size) || 40,
      hp: Number(tokenData.hp) || 10,
      maxHp: Number(tokenData.maxHp) || 10,
      conditions: Array.isArray(tokenData.conditions) ? tokenData.conditions : []
    };
    room.map.tokens.push(newToken);
    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();
    return newToken;
  }

  /**
   * Supprime un pion de la carte
   * @param {string} roomId 
   * @param {string} tokenId 
   */
  removeToken(roomId, tokenId) {
    const room = this.getRoom(roomId);
    if (!room.map) room.map = this.createDefaultMap();
    const index = room.map.tokens.findIndex(t => t.id === tokenId);
    if (index !== -1) {
      const [removed] = room.map.tokens.splice(index, 1);
      room.updatedAt = new Date().toISOString();
      this.triggerAutoSave();
      return removed;
    }
    return null;
  }

  /**
   * Retourne le catalogue des altérations d'état disponibles
   */
  getConditionsList() {
    return Object.values(RPG_CONDITIONS);
  }

  /**
   * Applique ou actualise une altération d'état sur un pion (durée par défaut : 3 tours)
   * @param {string} roomId 
   * @param {string} tokenId 
   * @param {string} conditionId 
   * @param {number} duration 
   */
  setTokenCondition(roomId, tokenId, conditionId, duration = 3) {
    const room = this.getRoom(roomId);
    if (!room.map) room.map = this.createDefaultMap();
    if (!Array.isArray(room.map.tokens)) room.map.tokens = [];
    const token = room.map.tokens.find((t) => t.id === tokenId);
    if (!token) throw new Error(`Pion introuvable sur la carte (ID: ${tokenId})`);

    if (!Array.isArray(token.conditions)) token.conditions = [];
    const def = RPG_CONDITIONS[conditionId] || { id: conditionId, name: conditionId, icon: '[?]', color: '#f59e0b', desc: '' };

    const condObj = {
      id: def.id,
      name: def.name,
      icon: def.icon,
      color: def.color,
      desc: def.desc || '',
      duration: Math.max(1, Number(duration) || 3)
    };

    const existingIdx = token.conditions.findIndex((c) => c.id === conditionId);
    if (existingIdx !== -1) {
      token.conditions[existingIdx] = condObj;
    } else {
      token.conditions.push(condObj);
    }

    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();
    return { token, condition: condObj };
  }

  /**
   * Supprime une altération d'état d'un pion
   * @param {string} roomId 
   * @param {string} tokenId 
   * @param {string} conditionId 
   */
  removeTokenCondition(roomId, tokenId, conditionId) {
    const room = this.getRoom(roomId);
    if (!room.map || !Array.isArray(room.map.tokens)) throw new Error('Pions introuvables.');
    const token = room.map.tokens.find((t) => t.id === tokenId);
    if (!token) throw new Error(`Pion introuvable sur la carte (ID: ${tokenId})`);

    if (!Array.isArray(token.conditions)) token.conditions = [];
    const idx = token.conditions.findIndex((c) => c.id === conditionId);
    let removed = null;
    if (idx !== -1) {
      [removed] = token.conditions.splice(idx, 1);
      room.updatedAt = new Date().toISOString();
      this.triggerAutoSave();
    }
    return { token, removed };
  }

  /**
   * Supprime toutes les altérations d'état d'un pion (Purification / Guérison complète)
   * @param {string} roomId 
   * @param {string} tokenId 
   */
  clearTokenConditions(roomId, tokenId) {
    const room = this.getRoom(roomId);
    if (!room.map || !Array.isArray(room.map.tokens)) throw new Error('Pions introuvables.');
    const token = room.map.tokens.find((t) => t.id === tokenId);
    if (!token) throw new Error(`Pion introuvable sur la carte (ID: ${tokenId})`);

    const count = (token.conditions || []).length;
    token.conditions = [];
    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();
    return { token, clearedCount: count };
  }

  /**
   * Décrémente la durée des états d'un pion. Si la durée tombe à 0, l'état expire (guéri automatiquement après 3 tours).
   * @param {string} roomId 
   * @param {string} tokenId 
   */
  decrementTokenConditions(roomId, tokenId) {
    const room = this.getRoom(roomId);
    if (!room.map || !Array.isArray(room.map.tokens)) return { token: null, expired: [] };
    const token = room.map.tokens.find((t) => t.id === tokenId);
    if (!token || !Array.isArray(token.conditions) || token.conditions.length === 0) {
      return { token, expired: [] };
    }

    const expired = [];
    const remaining = [];

    token.conditions.forEach((c) => {
      const dur = (c.duration || 3) - 1;
      if (dur <= 0) {
        expired.push({ ...c, tokenName: token.name, tokenId: token.id });
      } else {
        remaining.push({ ...c, duration: dur });
      }
    });

    token.conditions = remaining;
    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();
    return { token, expired };
  }

  /**
   * Révèle une zone du brouillard de guerre
   * @param {string} roomId 
   * @param {Object} area { type: 'rect'|'circle', x, y, w, h, r }
   */
  revealFog(roomId, area) {
    const room = this.getRoom(roomId);
    if (!room.map) room.map = this.createDefaultMap();
    if (!Array.isArray(room.map.revealedAreas)) room.map.revealedAreas = [];
    const newArea = {
      id: `fog_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      type: area.type || 'rect',
      x: Math.round(Number(area.x || 0)),
      y: Math.round(Number(area.y || 0)),
      w: Math.round(Number(area.w || 0)),
      h: Math.round(Number(area.h || 0)),
      r: Math.round(Number(area.r || 0)),
      points: Array.isArray(area.points)
        ? area.points.map((pt) => ({ x: Math.round(Number(pt.x)), y: Math.round(Number(pt.y)) }))
        : null
    };
    room.map.revealedAreas.push(newArea);
    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();
    return newArea;
  }

  /**
   * Réinitialise le brouillard de guerre (tout redevient obscur)
   * @param {string} roomId 
   */
  resetFog(roomId) {
    const room = this.getRoom(roomId);
    if (!room.map) room.map = this.createDefaultMap();
    room.map.revealedAreas = [];
    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();
    return true;
  }

  /**
   * Ajoute un segment de mur rectiligne sur la carte (Réservé au MJ)
   * @param {string} roomId 
   * @param {Object} wallData { x1, y1, x2, y2, blocksMovement, blocksLight }
   */
  addWall(roomId, wallData) {
    const room = this.getRoom(roomId);
    if (!room.map) room.map = this.createDefaultMap();
    if (!Array.isArray(room.map.walls)) room.map.walls = [];

    const id = `wall_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const isDoor = wallData.wallType === 'door';
    const isChasm = !isDoor && (wallData.wallType === 'chasm' || wallData.blocksLight === false);
    const isOpen = Boolean(wallData.isOpen);
    const isLocked = Boolean(wallData.isLocked);

    const newWall = {
      id,
      x1: Math.round(Number(wallData.x1)),
      y1: Math.round(Number(wallData.y1)),
      x2: Math.round(Number(wallData.x2)),
      y2: Math.round(Number(wallData.y2)),
      wallType: isDoor ? 'door' : (isChasm ? 'chasm' : 'wall'),
      isOpen: isDoor ? isOpen : false,
      isLocked: isDoor ? isLocked : false,
      blocksMovement: isDoor ? !isOpen : (wallData.blocksMovement !== false),
      blocksLight: isDoor ? !isOpen : (!isChasm && wallData.blocksLight !== false)
    };

    room.map.walls.push(newWall);
    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();
    return newWall;
  }

  /**
   * Bascule l'état ouvert/fermé d'une porte
   * @param {string} roomId 
   * @param {string} doorId 
   * @param {string} [role] 
   * @param {number} [playerSlot] 
   * @param {string} [playerName] 
   */
  toggleDoor(roomId, doorId, role, playerSlot, playerName) {
    const room = this.getRoom(roomId);
    if (!room.map || !Array.isArray(room.map.walls)) {
      throw new Error('Carte ou murs introuvables.');
    }

    const door = room.map.walls.find((w) => w.id === doorId && w.wallType === 'door');
    if (!door) {
      throw new Error('Porte introuvable.');
    }

    const isMJ = role === 'mj' || role === 'gm';

    if (!isMJ) {
      // 1. Vérification de la distance du pion joueur à la porte
      const tokens = room.map.tokens || [];
      const pToken = tokens.find((t) => t.type === 'player' && (
        (typeof playerSlot === 'number' && t.slot === playerSlot) ||
        (playerName && t.name && t.name.toLowerCase() === playerName.toLowerCase())
      ));

      if (pToken) {
        const dx = door.x2 - door.x1;
        const dy = door.y2 - door.y1;
        const l2 = dx * dx + dy * dy;
        let dist = 9999;
        if (l2 === 0) {
          dist = Math.hypot(pToken.x - door.x1, pToken.y - door.y1);
        } else {
          let t = ((pToken.x - door.x1) * dx + (pToken.y - door.y1) * dy) / l2;
          t = Math.max(0, Math.min(1, t));
          dist = Math.hypot(pToken.x - (door.x1 + t * dx), pToken.y - (door.y1 + t * dy));
        }

        // Portée maximale de manipulation : 120 pixels (~2.4 mètres)
        if (dist > 120) {
          throw new Error('Vous êtes trop éloigné pour manipuler cette porte. Rapprochez-vous.');
        }
      }

      // 2. Vérification du verrouillage à clé
      if (door.isLocked) {
        return {
          success: false,
          locked: true,
          door,
          message: 'Cette porte est verrouillée à clé !'
        };
      }
    }

    // Bascule de l'état ouvert/fermé
    door.isOpen = !door.isOpen;
    door.blocksMovement = !door.isOpen;
    door.blocksLight = !door.isOpen;

    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();

    return {
      success: true,
      door,
      action: door.isOpen ? 'opened' : 'closed'
    };
  }

  /**
   * Verrouille ou déverrouille une porte à clé (Réservé au MJ)
   * @param {string} roomId 
   * @param {string} doorId 
   */
  toggleDoorLock(roomId, doorId) {
    const room = this.getRoom(roomId);
    if (!room.map || !Array.isArray(room.map.walls)) {
      throw new Error('Carte ou murs introuvables.');
    }

    const door = room.map.walls.find((w) => w.id === doorId && w.wallType === 'door');
    if (!door) {
      throw new Error('Porte introuvable.');
    }

    door.isLocked = !door.isLocked;
    // Si la porte est verrouillée à clé, elle se referme immédiatement
    if (door.isLocked) {
      door.isOpen = false;
      door.blocksMovement = true;
      door.blocksLight = true;
    }

    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();

    return {
      success: true,
      door,
      isLocked: door.isLocked
    };
  }

  /**
   * Définit le mode d'éclairage ambiant de la carte ('day' ou 'night')
   * @param {string} roomId 
   * @param {'day'|'night'} mode 
   */
  setLightingMode(roomId, mode) {
    const room = this.getRoom(roomId);
    if (!room.map) room.map = this.createDefaultMap();
    room.map.lightingMode = mode === 'night' ? 'night' : 'day';
    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();
    return room.map.lightingMode;
  }

  /**
   * Ajoute une source de lumière fixe sur la carte (brasero, chandelier, etc.)
   * @param {string} roomId 
   * @param {Object} lightData 
   */
  addLight(roomId, lightData) {
    const room = this.getRoom(roomId);
    if (!room.map) room.map = this.createDefaultMap();
    if (!Array.isArray(room.map.lights)) room.map.lights = [];

    const newLight = {
      id: `light_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      x: Math.round(Number(lightData.x)),
      y: Math.round(Number(lightData.y)),
      radius: Math.round(Number(lightData.radius) || 400), // 12 mètres par défaut
      color: lightData.color || '#f59e0b',
      type: lightData.type || 'brazier',
      label: lightData.label || 'Brasero',
      enabled: lightData.enabled !== false
    };

    room.map.lights.push(newLight);
    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();
    return newLight;
  }

  /**
   * Supprime une source de lumière fixe
   * @param {string} roomId 
   * @param {string} lightId 
   */
  removeLight(roomId, lightId) {
    const room = this.getRoom(roomId);
    if (!room.map || !Array.isArray(room.map.lights)) return null;

    const idx = room.map.lights.findIndex((l) => l.id === lightId);
    if (idx !== -1) {
      const [removed] = room.map.lights.splice(idx, 1);
      room.updatedAt = new Date().toISOString();
      this.triggerAutoSave();
      return removed;
    }
    return null;
  }

  /**
   * Efface toutes les sources de lumière fixes
   * @param {string} roomId 
   */
  clearLights(roomId) {
    const room = this.getRoom(roomId);
    if (!room.map) room.map = this.createDefaultMap();
    room.map.lights = [];
    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();
    return true;
  }

  /**
   * Allume ou éteint la torche portée par un pion
   * @param {string} roomId 
   * @param {string} tokenId 
   */
  toggleTokenTorch(roomId, tokenId) {
    const room = this.getRoom(roomId);
    if (!room.map || !Array.isArray(room.map.tokens)) {
      throw new Error('Pions introuvables.');
    }

    const token = room.map.tokens.find((t) => t.id === tokenId);
    if (!token) {
      throw new Error('Pion introuvable.');
    }

    token.hasTorch = !token.hasTorch;
    token.torchRadius = token.hasTorch ? 400 : 0; // 12 mètres

    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();

    return {
      token,
      hasTorch: token.hasTorch
    };
  }

  /**
   * Supprime un mur de la carte
   * @param {string} roomId 
   * @param {string} wallId 
   */
  removeWall(roomId, wallId) {
    const room = this.getRoom(roomId);
    if (!room.map) room.map = this.createDefaultMap();
    if (!Array.isArray(room.map.walls)) room.map.walls = [];

    const index = room.map.walls.findIndex((w) => w.id === wallId);
    if (index !== -1) {
      const [removed] = room.map.walls.splice(index, 1);
      room.updatedAt = new Date().toISOString();
      this.triggerAutoSave();
      return removed;
    }
    return null;
  }

  /**
   * Efface tous les murs de la carte
   * @param {string} roomId 
   */
  clearWalls(roomId) {
    const room = this.getRoom(roomId);
    if (!room.map) room.map = this.createDefaultMap();
    room.map.walls = [];
    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();
    return true;
  }

  /**
   * Ajoute une surface ralentissante ou zone de danger permanent (Réservé au MJ)
   * @param {string} roomId 
   * @param {Object} zoneData 
   */
  addZone(roomId, zoneData) {
    const room = this.getRoom(roomId);
    if (!room.map) room.map = this.createDefaultMap();
    if (!Array.isArray(room.map.zones)) room.map.zones = [];

    const id = `zone_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const subType = zoneData.subType || 'swamp';
    const type = (['fire', 'poison', 'acid'].includes(subType)) ? 'hazard' : 'difficult';

    // Propriétés par défaut selon le type
    const defaultLabels = {
      swamp: 'Marais Boueux',
      water: 'Eau Profonde',
      rubble: 'Gravats & Pierres',
      web: 'Toiles d\'Araignée',
      fire: 'Nappe de Flammes',
      poison: 'Nappe de Poison',
      acid: 'Flaque d\'Acide'
    };

    const defaultColors = {
      swamp: '#4d7c0f',
      water: '#0284c7',
      rubble: '#78716c',
      web: '#e2e8f0',
      fire: '#ea580c',
      poison: '#16a34a',
      acid: '#84cc16'
    };

    const defaultEffects = {
      swamp: { slowPct: 50 },
      water: { slowPct: 50 },
      rubble: { slowPct: 50 },
      web: { slowPct: 50 },
      fire: { damage: 4, condition: 'burning', dc: 12 },
      poison: { damage: 3, condition: 'poisoned', dc: 13 },
      acid: { damage: 5, dc: 12 }
    };

    const newZone = {
      id,
      name: zoneData.label || zoneData.name || defaultLabels[subType] || 'Zone Spéciale',
      label: zoneData.label || zoneData.name || defaultLabels[subType] || 'Zone Spéciale',
      type,
      subType,
      shape: zoneData.shape === 'circle' ? 'circle' : 'rect',
      x: Math.round(Number(zoneData.x || 0)),
      y: Math.round(Number(zoneData.y || 0)),
      w: Math.round(Number(zoneData.w || 100)),
      h: Math.round(Number(zoneData.h || 100)),
      r: Math.round(Number(zoneData.r || 50)),
      color: zoneData.color || defaultColors[subType] || '#f59e0b',
      effect: zoneData.effect || defaultEffects[subType] || { slowPct: 50 }
    };

    room.map.zones.push(newZone);
    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();
    return newZone;
  }

  /**
   * Supprime une zone d'effet ou terrain difficile
   * @param {string} roomId 
   * @param {string} zoneId 
   */
  removeZone(roomId, zoneId) {
    const room = this.getRoom(roomId);
    if (!room.map || !Array.isArray(room.map.zones)) return null;

    const idx = room.map.zones.findIndex((z) => z.id === zoneId);
    if (idx !== -1) {
      const [removed] = room.map.zones.splice(idx, 1);
      room.updatedAt = new Date().toISOString();
      this.triggerAutoSave();
      return removed;
    }
    return null;
  }

  /**
   * Efface toutes les zones d'effet et terrains de la carte
   * @param {string} roomId 
   */
  clearZones(roomId) {
    const room = this.getRoom(roomId);
    if (!room.map) room.map = this.createDefaultMap();
    room.map.zones = [];
    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();
    return true;
  }

  /**
   * Ajoute un piège ou passage secret dissimulé sur la carte (Réservé au MJ)
   * @param {string} roomId 
   * @param {Object} trapData 
   */
  addTrap(roomId, trapData) {
    const room = this.getRoom(roomId);
    if (!room.map) room.map = this.createDefaultMap();
    if (!Array.isArray(room.map.traps)) room.map.traps = [];

    const id = `trap_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const subType = trapData.subType || 'pit';

    const defaultConfigs = {
      pit: { name: 'Fosse Dissimulée', dc: 12, damage: 5, condition: 'prone' },
      snare: { name: 'Piège à Mâchoires', dc: 13, damage: 6, condition: 'restrained' },
      poison_dart: { name: 'Fléchettes Empoisonnées', dc: 14, damage: 4, condition: 'poisoned' },
      secret_passage: { name: 'Passage Secret', dc: 13, damage: 0, condition: null }
    };

    const cfg = defaultConfigs[subType] || defaultConfigs.pit;

    const newTrap = {
      id,
      name: trapData.label || trapData.name || cfg.name,
      label: trapData.label || trapData.name || cfg.name,
      subType,
      type: subType === 'secret_passage' ? 'secret_passage' : 'trap',
      x: Math.round(Number(trapData.x || 0)),
      y: Math.round(Number(trapData.y || 0)),
      r: Math.round(Number(trapData.r || 25)), // rayon de détection/déclenchement (1 case)
      dc: Number(trapData.dc) || cfg.dc,      // Seuil de Perception Passive (DD)
      damage: typeof trapData.damage === 'number' ? trapData.damage : cfg.damage,
      condition: trapData.condition !== undefined ? trapData.condition : cfg.condition,
      revealed: Boolean(trapData.revealed),
      triggered: Boolean(trapData.triggered),
      disarmed: Boolean(trapData.disarmed)
    };

    room.map.traps.push(newTrap);
    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();
    return newTrap;
  }

  /**
   * Supprime un piège ou passage secret
   * @param {string} roomId 
   * @param {string} trapId 
   */
  removeTrap(roomId, trapId) {
    const room = this.getRoom(roomId);
    if (!room.map || !Array.isArray(room.map.traps)) return null;

    const idx = room.map.traps.findIndex((t) => t.id === trapId);
    if (idx !== -1) {
      const [removed] = room.map.traps.splice(idx, 1);
      room.updatedAt = new Date().toISOString();
      this.triggerAutoSave();
      return removed;
    }
    return null;
  }

  /**
   * Efface tous les pièges de la carte
   * @param {string} roomId 
   */
  clearTraps(roomId) {
    const room = this.getRoom(roomId);
    if (!room.map) room.map = this.createDefaultMap();
    room.map.traps = [];
    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();
    return true;
  }

  /**
   * Déclenche un piège lorsqu'un pion marche sur sa case (Arrêt forcé et dégâts/conditions)
   * @param {string} roomId 
   * @param {string} trapId 
   * @param {string} tokenId 
   */
  triggerTrap(roomId, trapId, tokenId) {
    const room = this.getRoom(roomId);
    if (!room.map || !Array.isArray(room.map.traps)) throw new Error('Pièges introuvables.');

    const trap = room.map.traps.find((t) => t.id === trapId);
    if (!trap) throw new Error('Piège introuvable.');

    trap.triggered = true;
    trap.revealed = true;

    let affectedToken = null;
    let appliedCondition = null;

    if (tokenId && Array.isArray(room.map.tokens)) {
      affectedToken = room.map.tokens.find((tok) => tok.id === tokenId);
      if (affectedToken) {
        // Application des dégâts
        if (trap.damage > 0) {
          affectedToken.hp = Math.max(0, (affectedToken.hp || 10) - trap.damage);
          if (affectedToken.type === 'player' && Array.isArray(room.characters)) {
            const char = room.characters.find(
              (c) => c && (c.slot === affectedToken.slot || (c.name && affectedToken.name && c.name.toLowerCase() === affectedToken.name.toLowerCase()))
            );
            if (char) char.hp = affectedToken.hp;
          }
        }

        // Application de l'altération d'état
        if (trap.condition) {
          const res = this.setTokenCondition(roomId, affectedToken.id, trap.condition, 3);
          appliedCondition = res.condition;
        }
      }
    }

    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();

    return {
      trap,
      token: affectedToken,
      damage: trap.damage,
      condition: appliedCondition
    };
  }

  /**
   * Révèle un piège grâce au score de Perception Passive suffisant d'un aventurier
   * @param {string} roomId 
   * @param {string} trapId 
   * @param {string} characterName 
   * @param {number} score 
   * @param {number} dc 
   */
  revealTrap(roomId, trapId, characterName, score, dc) {
    const room = this.getRoom(roomId);
    if (!room.map || !Array.isArray(room.map.traps)) throw new Error('Pièges introuvables.');

    const trap = room.map.traps.find((t) => t.id === trapId);
    if (!trap) throw new Error('Piège introuvable.');

    trap.revealed = true;
    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();

    return {
      trap,
      characterName: characterName || 'Un aventurier vigilant',
      score: score || trap.dc,
      dc: dc || trap.dc
    };
  }

  /**
   * Désamorce ou réarme un piège
   * @param {string} roomId 
   * @param {string} trapId 
   * @param {boolean} isDisarmed 
   */
  disarmTrap(roomId, trapId, isDisarmed = true) {
    const room = this.getRoom(roomId);
    if (!room.map || !Array.isArray(room.map.traps)) throw new Error('Pièges introuvables.');

    const trap = room.map.traps.find((t) => t.id === trapId);
    if (!trap) throw new Error('Piège introuvable.');

    trap.disarmed = Boolean(isDisarmed);
    trap.revealed = true;
    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();

    return { trap };
  }

  /**
   * Déclenche les dégâts et altérations d'une zone de danger permanent lorsqu'un pion s'y arrête
   * @param {string} roomId 
   * @param {string} zoneId 
   * @param {string} tokenId 
   */
  applyHazardZone(roomId, zoneId, tokenId) {
    const room = this.getRoom(roomId);
    if (!room.map || !Array.isArray(room.map.zones)) throw new Error('Zones introuvables.');

    const zone = room.map.zones.find((z) => z.id === zoneId);
    if (!zone) throw new Error('Zone introuvable.');

    const token = (room.map.tokens || []).find((t) => t.id === tokenId);
    if (!token) throw new Error('Pion introuvable.');

    const dmg = Number(zone.effect?.damage) || 0;
    const condId = zone.effect?.condition || null;

    if (dmg > 0) {
      token.hp = Math.max(0, (token.hp || 10) - dmg);
      if (token.type === 'player' && Array.isArray(room.characters)) {
        const char = room.characters.find(
          (c) => c && (c.slot === token.slot || (c.name && token.name && c.name.toLowerCase() === token.name.toLowerCase()))
        );
        if (char) char.hp = token.hp;
      }
    }

    let appliedCondition = null;
    if (condId) {
      const res = this.setTokenCondition(roomId, token.id, condId, 3);
      appliedCondition = res.condition;
    }

    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();

    return {
      zone,
      token,
      damage: dmg,
      condition: appliedCondition
    };
  }

  /**
   * Récupère la liste des scènes et l'identifiant de la scène active
   * @param {string} roomId 
   */
  getScenes(roomId) {
    const room = this.getRoom(roomId);
    return {
      activeSceneId: room.activeSceneId,
      scenes: (room.scenes || []).map((s) => ({
        id: s.id,
        name: s.name,
        backgroundUrl: s.backgroundUrl,
        lightingMode: s.lightingMode,
        fogEnabled: s.fogEnabled,
        tokenCount: (s.tokens || []).length,
        wallCount: (s.walls || []).length,
        teleporterCount: (s.teleporters || []).length
      }))
    };
  }

  /**
   * Crée une nouvelle scène pour la campagne / donjon multi-niveaux (MJ)
   * @param {string} roomId 
   * @param {Object} sceneData 
   */
  createScene(roomId, { name, backgroundUrl = null, lightingMode = 'day', fogEnabled = true } = {}) {
    const room = this.getRoom(roomId);
    const sceneId = `scene_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newScene = {
      id: sceneId,
      ...this.createDefaultMap(name || `Scène #${(room.scenes || []).length + 1}`, backgroundUrl),
      lightingMode: lightingMode || 'day',
      fogEnabled: fogEnabled !== false
    };

    if (!Array.isArray(room.scenes)) room.scenes = [];
    room.scenes.push(newScene);
    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();
    return newScene;
  }

  /**
   * Bascule la salle vers une autre scène avec transport optionnel et précis des joueurs
   * @param {string} roomId 
   * @param {string} targetSceneId 
   * @param {boolean} transportPlayers 
   * @param {number|null} targetX 
   * @param {number|null} targetY 
   */
  switchScene(roomId, targetSceneId, transportPlayers = true, targetX = null, targetY = null) {
    const room = this.getRoom(roomId);
    const targetScene = (room.scenes || []).find((s) => s.id === targetSceneId);
    if (!targetScene) {
      throw new Error(`Scène introuvable : ${targetSceneId}`);
    }

    const currentScene = (room.scenes || []).find((s) => s.id === room.activeSceneId);
    const transportedTokens = [];

    // Déplacement automatique de tout le groupe d'aventuriers
    if (transportPlayers && currentScene && currentScene.id !== targetScene.id) {
      const playerTokens = (currentScene.tokens || []).filter((t) => t.type === 'player');

      // Retirer les tokens joueurs de l'ancienne scène
      currentScene.tokens = (currentScene.tokens || []).filter((t) => t.type !== 'player');

      // Si des coordonnées d'arrivée sont spécifiées, les disposer avec précision
      const baseX = typeof targetX === 'number' ? Math.round(targetX) : 400;
      const baseY = typeof targetY === 'number' ? Math.round(targetY) : 400;

      playerTokens.forEach((pToken, idx) => {
        // Décalage harmonieux pour ne pas empiler les pions les uns sur les autres
        const offsetX = (idx % 2) * 45;
        const offsetY = Math.floor(idx / 2) * 45;
        pToken.x = baseX + offsetX;
        pToken.y = baseY + offsetY;
        transportedTokens.push(pToken);
      });

      // Les ajouter à la nouvelle scène
      if (!Array.isArray(targetScene.tokens)) targetScene.tokens = [];
      targetScene.tokens = targetScene.tokens.filter((t) => !playerTokens.some((pt) => pt.id === t.id));
      targetScene.tokens.push(...playerTokens);
    }

    room.activeSceneId = targetScene.id;
    room.map = targetScene;
    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();

    return {
      activeSceneId: targetScene.id,
      scene: targetScene,
      transportedTokens
    };
  }

  /**
   * Met à jour les propriétés d'une scène (nom, fond, éclairage, brouillard)
   * @param {string} roomId 
   * @param {string} sceneId 
   * @param {Object} updates 
   */
  updateScene(roomId, sceneId, updates = {}) {
    const room = this.getRoom(roomId);
    const scene = (room.scenes || []).find((s) => s.id === sceneId);
    if (!scene) throw new Error(`Scène introuvable : ${sceneId}`);

    if (updates.name && typeof updates.name === 'string') scene.name = updates.name.trim();
    if (updates.backgroundUrl !== undefined) scene.backgroundUrl = updates.backgroundUrl;
    if (updates.lightingMode) scene.lightingMode = updates.lightingMode;
    if (typeof updates.fogEnabled === 'boolean') scene.fogEnabled = updates.fogEnabled;
    if (typeof updates.gridSize === 'number') scene.gridSize = updates.gridSize;
    if (typeof updates.snapToGrid === 'boolean') scene.snapToGrid = updates.snapToGrid;

    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();
    return scene;
  }

  /**
   * Supprime une scène
   * @param {string} roomId 
   * @param {string} sceneId 
   */
  deleteScene(roomId, sceneId) {
    const room = this.getRoom(roomId);
    if (!Array.isArray(room.scenes) || room.scenes.length <= 1) {
      throw new Error('Impossible de supprimer la seule scène existante.');
    }

    const idx = room.scenes.findIndex((s) => s.id === sceneId);
    if (idx === -1) throw new Error(`Scène introuvable : ${sceneId}`);

    const [deleted] = room.scenes.splice(idx, 1);

    let newActiveScene = null;
    if (room.activeSceneId === sceneId) {
      newActiveScene = room.scenes[0];
      room.activeSceneId = newActiveScene.id;
      room.map = newActiveScene;
    }

    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();

    return {
      deletedSceneId: sceneId,
      newActiveScene
    };
  }

  /**
   * Ajoute un téléporteur / point de passage vers une autre scène (MJ)
   * @param {string} roomId 
   * @param {Object} teleporterData 
   */
  addTeleporter(roomId, teleporterData) {
    const room = this.getRoom(roomId);
    const scene = room.map;
    if (!Array.isArray(scene.teleporters)) scene.teleporters = [];

    const id = `teleport_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const type = teleporterData.type || 'stairs_down'; // 'stairs_down' | 'stairs_up' | 'portal' | 'ladder'
    const defaultLabels = {
      stairs_down: 'Escalier Descendant',
      stairs_up: 'Escalier Montant',
      portal: 'Portail Arcanique',
      ladder: 'Échelle / Trappe'
    };

    const newTeleporter = {
      id,
      name: teleporterData.name || defaultLabels[type] || 'Point de Transition',
      type,
      x: Math.round(Number(teleporterData.x || 0)),
      y: Math.round(Number(teleporterData.y || 0)),
      r: Math.round(Number(teleporterData.r || 35)),
      targetSceneId: teleporterData.targetSceneId || null,
      targetX: typeof teleporterData.targetX === 'number' ? Math.round(teleporterData.targetX) : 400,
      targetY: typeof teleporterData.targetY === 'number' ? Math.round(teleporterData.targetY) : 400,
      active: teleporterData.active !== false
    };

    scene.teleporters.push(newTeleporter);
    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();
    return newTeleporter;
  }

  /**
   * Supprime un téléporteur de la scène active
   * @param {string} roomId 
   * @param {string} teleporterId 
   */
  removeTeleporter(roomId, teleporterId) {
    const room = this.getRoom(roomId);
    const scene = room.map;
    if (!Array.isArray(scene.teleporters)) return null;

    const idx = scene.teleporters.findIndex((tp) => tp.id === teleporterId);
    if (idx !== -1) {
      const [removed] = scene.teleporters.splice(idx, 1);
      room.updatedAt = new Date().toISOString();
      this.triggerAutoSave();
      return removed;
    }
    return null;
  }

  /**
   * Déclenche un téléporteur lorsqu'un pion marche dessus :
   * Téléporte automatiquement tout le groupe d'aventuriers vers la scène liée à l'emplacement précis
   * @param {string} roomId 
   * @param {string} teleporterId 
   * @param {string} tokenId 
   */
  triggerTeleporter(roomId, teleporterId, tokenId) {
    const room = this.getRoom(roomId);
    const scene = room.map;
    if (!Array.isArray(scene.teleporters)) throw new Error('Téléporteurs introuvables.');

    const teleporter = scene.teleporters.find((tp) => tp.id === teleporterId);
    if (!teleporter) throw new Error('Téléporteur introuvable.');

    if (!teleporter.active) {
      return { triggered: false, reason: 'inactive' };
    }

    if (!teleporter.targetSceneId) {
      return { triggered: false, reason: 'no_destination' };
    }

    // Basculer toute la salle vers la scène cible avec repositionnement précis
    const switchRes = this.switchScene(roomId, teleporter.targetSceneId, true, teleporter.targetX, teleporter.targetY);

    return {
      triggered: true,
      teleporter,
      ...switchRes
    };
  }

  /**
   * Met à jour les réglages de la carte (grille, aimantation, activation du brouillard)
   * @param {string} roomId 
   * @param {Object} settings 
   */
  updateMapSettings(roomId, settings = {}) {
    const room = this.getRoom(roomId);
    if (!room.map) room.map = this.createDefaultMap();
    if (typeof settings.gridSize === 'number') room.map.gridSize = settings.gridSize;
    if (typeof settings.snapToGrid === 'boolean') room.map.snapToGrid = settings.snapToGrid;
    if (typeof settings.fogEnabled === 'boolean') room.map.fogEnabled = settings.fogEnabled;
    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();
    return room.map;
  }

  /**
   * Fait spawn ou repositionne le jeton d'un joueur par le MJ
   * @param {string} roomId 
   * @param {number|string} slot 
   * @param {number} x 
   * @param {number} y 
   */
  spawnPlayerToken(roomId, slot, x = 200, y = 200) {
    const room = this.getRoom(roomId);
    if (!room.map) room.map = this.createDefaultMap();
    const slotNum = Number(slot);
    const char = (room.characters || []).find((c) => c && c.slot === slotNum);
    if (!char) {
      throw new Error(`Aucun personnage trouvé au slot #${slotNum}`);
    }

    const tokenId = `token_player_${char.slot}`;
    let token = room.map.tokens.find((t) => t.id === tokenId || (t.type === 'player' && t.slot === char.slot));

    if (token) {
      token.x = Number(x);
      token.y = Number(y);
      token.name = char.name;
      token.color = char.color || '#ef4444';
      token.icon = char.classIcon || char.raceIcon || '[P]';
      token.hp = char.hp;
      token.maxHp = char.maxHp;
      if (!Array.isArray(token.conditions)) token.conditions = [];
    } else {
      token = {
        id: tokenId,
        type: 'player',
        slot: char.slot,
        name: char.name,
        color: char.color || '#ef4444',
        icon: char.classIcon || char.raceIcon || '[P]',
        x: Number(x),
        y: Number(y),
        size: 40,
        hp: char.hp,
        maxHp: char.maxHp,
        conditions: []
      };
      room.map.tokens.push(token);
    }

    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();
    return token;
  }

  /**
   * Invoque tous les héros connectés/forgés sur la carte
   * @param {string} roomId 
   * @param {number} startX 
   * @param {number} startY 
   */
  spawnAllPlayerTokens(roomId, startX = 200, startY = 200) {
    const room = this.getRoom(roomId);
    if (!room.map) room.map = this.createDefaultMap();
    const createdChars = (room.characters || []).filter((c) => c && c.created);
    const spawned = [];

    createdChars.forEach((char, idx) => {
      const x = Number(startX) + idx * 60;
      const y = Number(startY);
      const token = this.spawnPlayerToken(roomId, char.slot, x, y);
      spawned.push(token);
    });

    return spawned;
  }

  /**
   * Lance une nouvelle manche d'initiative autonome :
   * Chaque joueur lance un d20, puis l'ordre du tour est déterminé par ordre décroissant des scores de d20.
   * @param {string} roomId 
   */
  startNewRound(roomId) {
    const room = this.getRoom(roomId);
    if (!room.map) room.map = this.createDefaultMap();

    const createdChars = (room.characters || []).filter((c) => c && c.created);
    if (createdChars.length === 0) {
      room.map.currentTurn = null;
      if (room.map.turnSystem) {
        room.map.turnSystem.turnOrder = [];
        room.map.turnSystem.currentIndex = 0;
      }
      return null;
    }

    // Décrémenter les altérations d'état du joueur dont le tour s'achevait
    const prevTurn = room.map.currentTurn;
    const expiredConditions = [];
    const updatedTokens = [];

    if (prevTurn) {
      const prevToken = (room.map.tokens || []).find(
        (t) => t.type === 'player' && (t.slot === prevTurn.slot || (t.name && prevTurn.name && t.name.toLowerCase() === prevTurn.name.toLowerCase()))
      );
      if (prevToken) {
        const decRes = this.decrementTokenConditions(roomId, prevToken.id);
        if (decRes.expired.length > 0) expiredConditions.push(...decRes.expired);
        if (decRes.token) updatedTokens.push(decRes.token);
      }
    }

    // Décrémenter les altérations des monstres à chaque fin de manche
    (room.map.tokens || []).forEach((t) => {
      if (t.type === 'monster' && Array.isArray(t.conditions) && t.conditions.length > 0) {
        const decRes = this.decrementTokenConditions(roomId, t.id);
        if (decRes.expired.length > 0) expiredConditions.push(...decRes.expired);
        if (decRes.token) updatedTokens.push(decRes.token);
      }
    });

    // 1. Chaque joueur lance un d20 d'initiative
    const orderWithRolls = createdChars.map((char) => {
      const roll = Math.floor(Math.random() * 20) + 1;
      const token = (room.map.tokens || []).find(
        (t) => t.type === 'player' && (t.slot === char.slot || (t.name && char.name && t.name.toLowerCase() === char.name.toLowerCase()))
      );
      return {
        slot: char.slot,
        name: char.name,
        icon: char.classIcon || char.raceIcon || '',
        color: char.color || '#ef4444',
        roll,
        startX: token ? token.x : 0,
        startY: token ? token.y : 0
      };
    });

    // 2. Tri par score de d20 décroissant (ordre d'initiative)
    orderWithRolls.sort((a, b) => {
      if (b.roll !== a.roll) return b.roll - a.roll;
      return a.slot - b.slot;
    });

    const currentRound = (room.map.turnSystem?.round || 0) + 1;

    room.map.turnSystem = {
      round: currentRound,
      turnOrder: orderWithRolls,
      currentIndex: 0,
      active: true
    };

    const firstPlayer = orderWithRolls[0];
    const firstToken = (room.map.tokens || []).find(
      (t) => t.type === 'player' && (t.slot === firstPlayer.slot || (t.name && firstPlayer.name && t.name.toLowerCase() === firstPlayer.name.toLowerCase()))
    );

    room.map.currentTurn = {
      slot: firstPlayer.slot,
      name: firstPlayer.name,
      icon: firstPlayer.icon,
      color: firstPlayer.color,
      roll: firstPlayer.roll,
      round: currentRound,
      orderIndex: 0,
      totalPlayers: orderWithRolls.length,
      startX: firstToken ? firstToken.x : firstPlayer.startX,
      startY: firstToken ? firstToken.y : firstPlayer.startY,
      timestamp: new Date().toISOString()
    };

    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();

    return {
      round: currentRound,
      turnOrder: orderWithRolls,
      currentTurn: room.map.currentTurn,
      isNewRound: true,
      expiredConditions,
      updatedTokens
    };
  }

  /**
   * Définit le tour de jeu actif sur un joueur spécifique
   * @param {string} roomId 
   * @param {number|string} slot 
   */
  setTurn(roomId, slot) {
    const room = this.getRoom(roomId);
    if (!room.map) room.map = this.createDefaultMap();
    const slotNum = Number(slot);
    const char = (room.characters || []).find((c) => c && c.slot === slotNum);
    if (!char) {
      throw new Error(`Personnage introuvable pour le slot #${slotNum}`);
    }

    const token = (room.map.tokens || []).find(
      (t) => t.type === 'player' && (t.slot === char.slot || (t.name && char.name && t.name.toLowerCase() === char.name.toLowerCase()))
    );

    if (!room.map.turnSystem) {
      room.map.turnSystem = { round: 1, turnOrder: [], currentIndex: 0, active: true };
    }

    const orderIndex = room.map.turnSystem.turnOrder.findIndex((p) => p.slot === slotNum);
    if (orderIndex !== -1) {
      room.map.turnSystem.currentIndex = orderIndex;
    }

    room.map.currentTurn = {
      slot: char.slot,
      name: char.name,
      icon: char.classIcon || char.raceIcon || '[P]',
      color: char.color || '#ef4444',
      roll: orderIndex !== -1 ? room.map.turnSystem.turnOrder[orderIndex].roll : 10,
      round: room.map.turnSystem.round || 1,
      orderIndex: orderIndex !== -1 ? orderIndex : 0,
      totalPlayers: room.map.turnSystem.turnOrder.length || 1,
      startX: token ? token.x : 0,
      startY: token ? token.y : 0,
      timestamp: new Date().toISOString()
    };

    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();

    return {
      round: room.map.turnSystem.round,
      turnOrder: room.map.turnSystem.turnOrder,
      currentTurn: room.map.currentTurn,
      isNewRound: false
    };
  }

  /**
   * Fait avancer le tour de jeu au joueur suivant dans l'ordre d'initiative.
   * Si tous les joueurs ont joué une fois (fin du tour d'ensemble), relance automatiquement
   * un d20 d'initiative pour chacun et démarre la manche suivante.
   * @param {string} roomId 
   */
  nextTurn(roomId) {
    const room = this.getRoom(roomId);
    if (!room.map) room.map = this.createDefaultMap();

    const createdChars = (room.characters || []).filter((c) => c && c.created);
    if (createdChars.length === 0) {
      room.map.currentTurn = null;
      return null;
    }

    // Décrémenter les altérations d'état du joueur qui vient de terminer son tour
    const prevTurn = room.map.currentTurn;
    const expiredConditions = [];
    const updatedTokens = [];

    if (prevTurn) {
      const prevToken = (room.map.tokens || []).find(
        (t) => t.type === 'player' && (t.slot === prevTurn.slot || (t.name && prevTurn.name && t.name.toLowerCase() === prevTurn.name.toLowerCase()))
      );
      if (prevToken) {
        const decRes = this.decrementTokenConditions(roomId, prevToken.id);
        if (decRes.expired.length > 0) expiredConditions.push(...decRes.expired);
        if (decRes.token) updatedTokens.push(decRes.token);
      }
    }

    let turnSystem = room.map.turnSystem;
    if (!turnSystem || !Array.isArray(turnSystem.turnOrder) || turnSystem.turnOrder.length === 0) {
      const roundRes = this.startNewRound(roomId);
      if (roundRes) {
        roundRes.expiredConditions = expiredConditions.concat(roundRes.expiredConditions || []);
        roundRes.updatedTokens = updatedTokens.concat(roundRes.updatedTokens || []);
      }
      return roundRes;
    }

    // Filtrer les joueurs qui existent encore dans la salle
    turnSystem.turnOrder = turnSystem.turnOrder.filter((p) =>
      createdChars.some((c) => c.slot === p.slot)
    );

    if (turnSystem.turnOrder.length === 0) {
      const roundRes = this.startNewRound(roomId);
      if (roundRes) {
        roundRes.expiredConditions = expiredConditions.concat(roundRes.expiredConditions || []);
        roundRes.updatedTokens = updatedTokens.concat(roundRes.updatedTokens || []);
      }
      return roundRes;
    }

    // Si on a atteint la fin du tour d'ensemble -> Lancement autonome de la nouvelle manche !
    if (turnSystem.currentIndex + 1 >= turnSystem.turnOrder.length) {
      const roundRes = this.startNewRound(roomId);
      if (roundRes) {
        roundRes.expiredConditions = expiredConditions.concat(roundRes.expiredConditions || []);
        roundRes.updatedTokens = updatedTokens.concat(roundRes.updatedTokens || []);
      }
      return roundRes;
    }

    // Sinon, passer au joueur suivant dans la manche en cours
    turnSystem.currentIndex++;
    const nextPlayer = turnSystem.turnOrder[turnSystem.currentIndex];
    const nextToken = (room.map.tokens || []).find(
      (t) => t.type === 'player' && (t.slot === nextPlayer.slot || (t.name && nextPlayer.name && t.name.toLowerCase() === nextPlayer.name.toLowerCase()))
    );

    room.map.currentTurn = {
      slot: nextPlayer.slot,
      name: nextPlayer.name,
      icon: nextPlayer.icon,
      color: nextPlayer.color,
      roll: nextPlayer.roll,
      round: turnSystem.round,
      orderIndex: turnSystem.currentIndex,
      totalPlayers: turnSystem.turnOrder.length,
      startX: nextToken ? nextToken.x : 0,
      startY: nextToken ? nextToken.y : 0,
      timestamp: new Date().toISOString()
    };

    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();

    return {
      round: turnSystem.round,
      turnOrder: turnSystem.turnOrder,
      currentTurn: room.map.currentTurn,
      isNewRound: false,
      expiredConditions,
      updatedTokens
    };
  }

  // ------------------------------------------------------------
  // GESTION DU CARNET D'ENQUÊTE & TABLEAUX DE LIENS PARTAGÉS
  // ------------------------------------------------------------

  /**
   * Récupère ou initialise l'état du carnet d'enquête d'une salle
   * @param {string} roomId 
   */
  getInvestigation(roomId) {
    const room = this.getRoom(roomId);
    if (!room) return null;
    if (!room.investigation) {
      room.investigation = {
        clues: [],
        links: []
      };
    }
    if (!Array.isArray(room.investigation.clues)) room.investigation.clues = [];
    if (!Array.isArray(room.investigation.links)) room.investigation.links = [];
    return room.investigation;
  }

  /**
   * Ajoute un indice, note, portrait ou document sur le tableau d'enquête
   */
  addClue(roomId, clueData = {}) {
    const inv = this.getInvestigation(roomId);
    if (!inv) return null;

    const clue = {
      id: `clue_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: clueData.type || 'clue', // 'clue', 'npc', 'document', 'sealed'
      title: (clueData.title || 'Indice sans titre').trim(),
      content: (clueData.content || '').trim(),
      author: clueData.author || 'Aventurier',
      authorRole: clueData.authorRole || 'joueur',
      color: clueData.color || '#fef3c7',
      x: typeof clueData.x === 'number' ? clueData.x : 100 + Math.floor(Math.random() * 450),
      y: typeof clueData.y === 'number' ? clueData.y : 100 + Math.floor(Math.random() * 320),
      image: clueData.image || null,
      status: clueData.status || 'neutral', // 'neutral', 'suspect', 'ally', 'dead', 'missing', 'evidence'
      isSealed: Boolean(clueData.isSealed),
      sealedBy: clueData.sealedBy || null,
      unsealedBy: null,
      unsealedAt: null,
      deductions: [], // [{ id, text, author, authorRole, createdAt }]
      createdAt: new Date().toISOString()
    };

    inv.clues.push(clue);
    this.persist();
    return clue;
  }

  /**
   * Met à jour les propriétés d'un indice
   */
  updateClue(roomId, clueId, updates = {}) {
    const inv = this.getInvestigation(roomId);
    if (!inv) return null;

    const clue = inv.clues.find((c) => c.id === clueId);
    if (!clue) return null;

    const allowed = ['title', 'content', 'status', 'color', 'image'];
    allowed.forEach((field) => {
      if (updates[field] !== undefined) clue[field] = updates[field];
    });

    clue.updatedAt = new Date().toISOString();
    this.persist();
    return clue;
  }

  /**
   * Déplace les coordonnées d'un indice sur le panneau
   */
  moveClue(roomId, clueId, x, y) {
    const inv = this.getInvestigation(roomId);
    if (!inv) return null;

    const clue = inv.clues.find((c) => c.id === clueId);
    if (!clue) return null;

    clue.x = Math.round(x);
    clue.y = Math.round(y);
    this.persist();
    return clue;
  }

  /**
   * Supprime un indice ainsi que tous les liens qui y sont rattachés
   */
  deleteClue(roomId, clueId) {
    const inv = this.getInvestigation(roomId);
    if (!inv) return false;

    inv.clues = inv.clues.filter((c) => c.id !== clueId);
    inv.links = inv.links.filter((l) => l.fromId !== clueId && l.toId !== clueId);
    this.persist();
    return true;
  }

  /**
   * Ouvre une lettre scellée et brise le cachet de cire
   */
  unsealClue(roomId, clueId, unsealedBy = 'Aventurier') {
    const inv = this.getInvestigation(roomId);
    if (!inv) return null;

    const clue = inv.clues.find((c) => c.id === clueId);
    if (!clue) return null;

    clue.isSealed = false;
    clue.unsealedBy = unsealedBy;
    clue.unsealedAt = new Date().toISOString();
    this.persist();
    return clue;
  }

  /**
   * Ajoute une hypothèse / déduction collective sur un indice
   */
  addClueDeduction(roomId, clueId, deductionData = {}) {
    const inv = this.getInvestigation(roomId);
    if (!inv) return null;

    const clue = inv.clues.find((c) => c.id === clueId);
    if (!clue) return null;

    if (!Array.isArray(clue.deductions)) clue.deductions = [];

    const deduction = {
      id: `ded_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      text: (deductionData.text || '').trim(),
      author: deductionData.author || 'Inconnu',
      authorRole: deductionData.authorRole || 'joueur',
      createdAt: new Date().toISOString()
    };

    clue.deductions.push(deduction);
    this.persist();
    return { clue, deduction };
  }

  /**
   * Crée une ficelle / lien reliant deux indices
   */
  addInvestigationLink(roomId, linkData = {}) {
    const inv = this.getInvestigation(roomId);
    if (!inv) return null;

    const { fromId, toId, label, color } = linkData;
    if (!fromId || !toId || fromId === toId) return null;

    // Vérifier si les deux indices existent
    const c1 = inv.clues.some((c) => c.id === fromId);
    const c2 = inv.clues.some((c) => c.id === toId);
    if (!c1 || !c2) return null;

    // Éviter les doublons
    const exists = inv.links.some(
      (l) => (l.fromId === fromId && l.toId === toId) ||
             (l.fromId === toId && l.toId === fromId)
    );
    if (exists) return null;

    const link = {
      id: `link_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      fromId,
      toId,
      label: (label || '').trim(),
      color: color || '#ef4444', // Rouge fil de détective
      createdAt: new Date().toISOString()
    };

    inv.links.push(link);
    this.persist();
    return link;
  }

  /**
   * Supprime / coupe un lien de ficelle
   */
  deleteInvestigationLink(roomId, linkId) {
    const inv = this.getInvestigation(roomId);
    if (!inv) return false;

    inv.links = inv.links.filter((l) => l.id !== linkId);
    this.persist();
    return true;
  }

  /**
   * Nettoie l'intégralité du tableau d'enquête (MJ)
   */
  clearInvestigation(roomId) {
    const inv = this.getInvestigation(roomId);
    if (!inv) return false;

    inv.clues = [];
    inv.links = [];
    this.persist();
    return true;
  }

  /**
   * Ajoute un trace de craie permanent a la scene active
   */
  addDrawing(roomId, strokeData) {
    const room = this.getRoom(roomId);
    if (!room) return null;

    const scene = room.map || room.scenes?.find((s) => s.id === room.activeSceneId);
    if (!scene) return null;

    if (!Array.isArray(scene.drawings)) {
      scene.drawings = [];
    }

    const drawing = {
      id: strokeData.id || `draw_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      author: strokeData.author || 'Anonyme',
      color: strokeData.color || '#f8fafc',
      width: Number(strokeData.width) || 6,
      points: Array.isArray(strokeData.points) ? strokeData.points.slice(0, 500) : [],
      createdAt: strokeData.createdAt || Date.now()
    };

    scene.drawings.push(drawing);
    // Limite de 800 traces permanents par scene pour preserver la memoire
    if (scene.drawings.length > 800) {
      scene.drawings = scene.drawings.slice(-800);
    }

    this.triggerAutoSave();
    return drawing;
  }

  /**
   * Supprime un trace de craie permanent specifique
   */
  deleteDrawing(roomId, drawingId) {
    const room = this.getRoom(roomId);
    if (!room) return false;

    const scene = room.map || room.scenes?.find((s) => s.id === room.activeSceneId);
    if (!scene || !Array.isArray(scene.drawings)) return false;

    const initialLen = scene.drawings.length;
    scene.drawings = scene.drawings.filter((d) => d.id !== drawingId);

    if (scene.drawings.length !== initialLen) {
      this.triggerAutoSave();
      return true;
    }
    return false;
  }

  /**
   * Efface les traces de craie permanents (par auteur ou tous)
   */
  clearDrawings(roomId, { author, all = false }) {
    const room = this.getRoom(roomId);
    if (!room) return false;

    const scene = room.map || room.scenes?.find((s) => s.id === room.activeSceneId);
    if (!scene || !Array.isArray(scene.drawings)) return false;

    if (all) {
      scene.drawings = [];
    } else if (author) {
      scene.drawings = scene.drawings.filter((d) => d.author !== author);
    } else {
      return false;
    }

    this.triggerAutoSave();
    return true;
  }

  // ============================================================
  // OBJETS & ELEMENTS INTERACTIFS BAC A SABLE (FEATURE 3)
  // ============================================================

  /**
   * Recupere les objets interactifs de la scene active
   */
  getProps(roomId) {
    const room = this.getRoom(roomId);
    if (!room) return [];
    const scene = room.map || room.scenes?.find((s) => s.id === room.activeSceneId);
    return Array.isArray(scene?.props) ? scene.props : [];
  }

  /**
   * Ajoute un objet interactif personnalisable a la scene active
   */
  addProp(roomId, propData = {}) {
    const room = this.getRoom(roomId);
    if (!room) return null;

    const scene = room.map || room.scenes?.find((s) => s.id === room.activeSceneId);
    if (!scene) return null;

    if (!Array.isArray(scene.props)) {
      scene.props = [];
    }

    const prop = {
      id: propData.id || `prop_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: (propData.name || 'Objet Interactif').trim(),
      icon: propData.icon || '[■]',
      imageUrl: propData.imageUrl || null,
      x: Math.round(Number(propData.x) || 200),
      y: Math.round(Number(propData.y) || 200),
      size: Math.max(20, Math.min(200, Number(propData.size) || 44)),
      description: (propData.description || '').trim(),
      secretNotes: (propData.secretNotes || '').trim(),
      revealedDoc: (propData.revealedDoc || '').trim(),
      isDocRevealed: Boolean(propData.isDocRevealed),
      linkedDoorId: propData.linkedDoorId || null,
      stateLabel: (propData.stateLabel || 'Intact').trim(),
      interactionRadius: Math.max(40, Number(propData.interactionRadius) || 120), // Rayon d'interaction ~2m
      createdAt: propData.createdAt || Date.now()
    };

    scene.props.push(prop);
    this.triggerAutoSave();
    return prop;
  }

  /**
   * Met a jour les parametres d'un objet interactif
   */
  updateProp(roomId, propId, updates = {}) {
    const room = this.getRoom(roomId);
    if (!room) return null;

    const scene = room.map || room.scenes?.find((s) => s.id === room.activeSceneId);
    if (!scene || !Array.isArray(scene.props)) return null;

    const prop = scene.props.find((p) => p.id === propId);
    if (!prop) return null;

    const allowed = [
      'name', 'icon', 'imageUrl', 'x', 'y', 'size',
      'description', 'secretNotes', 'revealedDoc',
      'isDocRevealed', 'linkedDoorId', 'stateLabel',
      'interactionRadius'
    ];

    allowed.forEach((field) => {
      if (updates[field] !== undefined) {
        if (field === 'x' || field === 'y') {
          prop[field] = Math.round(Number(updates[field]));
        } else if (field === 'size' || field === 'interactionRadius') {
          prop[field] = Number(updates[field]);
        } else if (field === 'isDocRevealed') {
          prop[field] = Boolean(updates[field]);
        } else {
          prop[field] = updates[field];
        }
      }
    });

    prop.updatedAt = Date.now();
    this.triggerAutoSave();
    return prop;
  }

  /**
   * Supprime un objet interactif
   */
  removeProp(roomId, propId) {
    const room = this.getRoom(roomId);
    if (!room) return false;

    const scene = room.map || room.scenes?.find((s) => s.id === room.activeSceneId);
    if (!scene || !Array.isArray(scene.props)) return false;

    const initialLen = scene.props.length;
    scene.props = scene.props.filter((p) => p.id !== propId);

    if (scene.props.length !== initialLen) {
      this.triggerAutoSave();
      return true;
    }
    return false;
  }

  /**
   * Exporte automatiquement la description ou le document revele d'un objet vers le carnet d'enquete
   */
  exportPropToInvestigation(roomId, propId, authorName = 'Aventurier') {
    const room = this.getRoom(roomId);
    if (!room) return null;

    const scene = room.map || room.scenes?.find((s) => s.id === room.activeSceneId);
    if (!scene || !Array.isArray(scene.props)) return null;

    const prop = scene.props.find((p) => p.id === propId);
    if (!prop) return null;

    const title = prop.name || 'Indice decouvert';
    const content = prop.revealedDoc
      ? `${prop.description ? prop.description + '\n\n---\n\n' : ''}${prop.revealedDoc}`
      : (prop.description || 'Element examine sur le terrain.');

    const clueData = {
      title: `[Objet] ${title}`,
      content,
      type: prop.revealedDoc ? 'document' : 'note',
      image: prop.imageUrl || null,
      author: authorName,
      status: 'evidence',
      color: '#fef3c7'
    };

    return this.addInvestigationClue(roomId, clueData);
  }

  /**
   * Sauvegarde automatique avec Debounce vers data/rooms.json
   */
  triggerAutoSave() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      await this.persist();
      this.debounceTimer = null;
    }, this.debounceDelay);
  }

  /**
   * Écriture atomique sur le disque dur uniquement pour les salles sauvegardées
   */
  async persist() {
    try {
      const dirPath = path.dirname(this.filePath);
      await fs.mkdir(dirPath, { recursive: true });
      // Seules les salles sauvegardées ou actives avec isSaved !== false sont conservées sur le disque
      const savedEntries = Array.from(this.rooms.entries()).filter(([_, room]) => room.isSaved);
      const obj = Object.fromEntries(savedEntries);
      await fs.writeFile(this.filePath, JSON.stringify(obj, null, 2), 'utf-8');
      console.log(`[RoomManager] ✅ Fichier rooms.json synchronisé (${savedEntries.length} salles enregistrées).`);
    } catch (error) {
      console.error('[RoomManager Error] Échec de sauvegarde dans rooms.json :', error.message);
    }
  }

  /**
   * Forcer la sauvegarde immédiate (utile à l'arrêt du serveur)
   */
  async flush() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    await this.persist();
  }
}

const instance = new RoomManager();
module.exports = instance;
module.exports.RoomManager = RoomManager;
module.exports.RPG_CONDITIONS = RPG_CONDITIONS;
