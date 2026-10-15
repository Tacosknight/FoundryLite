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
   * Modèle de salle par défaut : au départ, aucun personnage tant que des joueurs n'ont pas rejoint
   */
  createDefaultRoom(roomId) {
    return {
      id: roomId,
      password: null, // Mot de passe optionnel
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      characters: []
    };
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
      this.triggerAutoSave();
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

    let existingChar = room.characters.find(c => c.socketId === socketId);

    if (existingChar) {
      // Mise à jour du personnage existant
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
   * Supprime le personnage du joueur lors de sa déconnexion
   */
  removePlayerCharacter(roomId, socketId) {
    const room = this.getRoom(roomId);
    if (!room || !Array.isArray(room.characters)) return null;

    const charIndex = room.characters.findIndex(c => c.socketId === socketId);
    if (charIndex !== -1) {
      const [removedChar] = room.characters.splice(charIndex, 1);
      // Réindexer les slots restants
      room.characters.forEach((c, idx) => {
        c.slot = idx;
      });
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
   * Écriture atomique sur le disque dur
   */
  async persist() {
    try {
      const obj = Object.fromEntries(this.rooms.entries());
      await fs.writeFile(this.filePath, JSON.stringify(obj, null, 2), 'utf-8');
      console.log(`[RoomManager] ✅ Sauvegarde automatique effectuée (${this.rooms.size} salles).`);
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
