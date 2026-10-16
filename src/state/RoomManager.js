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
  createDefaultMap() {
    return {
      backgroundUrl: null,
      gridSize: 0,
      snapToGrid: false,
      fogEnabled: true,
      tokens: [],
      revealedAreas: [],
      currentTurn: null
    };
  }

  /**
   * Modèle de salle par défaut : au départ, aucun personnage tant que des joueurs n'ont pas rejoint
   */
  createDefaultRoom(roomId) {
    return {
      id: roomId,
      password: null, // Mot de passe optionnel
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      characters: [],
      map: this.createDefaultMap(),
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
          if (typeof room.map.gridSize !== 'number') room.map.gridSize = 50;
          if (typeof room.map.snapToGrid !== 'boolean') room.map.snapToGrid = true;
          if (typeof room.map.fogEnabled !== 'boolean') room.map.fogEnabled = true;
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
    return this.rooms.get(cleanId);
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
    return room.map;
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
      maxHp: Number(tokenData.maxHp) || 10
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
      x: Math.round(Number(area.x)),
      y: Math.round(Number(area.y)),
      w: Math.round(Number(area.w || 0)),
      h: Math.round(Number(area.h || 0)),
      r: Math.round(Number(area.r || 0))
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
      token.icon = char.classIcon || char.raceIcon || '👤';
      token.hp = char.hp;
      token.maxHp = char.maxHp;
    } else {
      token = {
        id: tokenId,
        type: 'player',
        slot: char.slot,
        name: char.name,
        color: char.color || '#ef4444',
        icon: char.classIcon || char.raceIcon || '👤',
        x: Number(x),
        y: Number(y),
        size: 40,
        hp: char.hp,
        maxHp: char.maxHp
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

    room.map.currentTurn = {
      slot: char.slot,
      name: char.name,
      icon: char.classIcon || char.raceIcon || '👤',
      color: char.color || '#ef4444',
      timestamp: new Date().toISOString()
    };

    room.updatedAt = new Date().toISOString();
    this.triggerAutoSave();
    return room.map.currentTurn;
  }

  /**
   * Passe au tour du joueur suivant de manière cyclique
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

    let nextIndex = 0;
    if (room.map.currentTurn && typeof room.map.currentTurn.slot === 'number') {
      const currentIndex = createdChars.findIndex((c) => c.slot === room.map.currentTurn.slot);
      if (currentIndex !== -1) {
        nextIndex = (currentIndex + 1) % createdChars.length;
      }
    }

    const nextChar = createdChars[nextIndex];
    return this.setTurn(roomId, nextChar.slot);
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
