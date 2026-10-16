const fs = require('fs/promises');
const path = require('path');

const ROOMS_FILE_PATH = path.join(__dirname, '../../data/rooms.json');

class RoomService {
  constructor() {
    this.rooms = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialise le service en chargeant les données depuis rooms.json
   */
  async init() {
    if (this.isInitialized) return;

    try {
      const data = await fs.readFile(ROOMS_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(data || '{}');
      for (const [id, room] of Object.entries(parsed)) {
        // Au démarrage, on réinitialise les utilisateurs connectés
        room.users = [];
        this.rooms.set(id, room);
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        await this.persist();
      } else {
        console.error('[RoomService] Erreur lors du chargement de rooms.json :', error.message);
      }
    }
    this.isInitialized = true;
  }

  /**
   * Sauvegarde l'état actuel des salles dans rooms.json
   */
  async persist() {
    try {
      const obj = Object.fromEntries(this.rooms.entries());
      await fs.writeFile(ROOMS_FILE_PATH, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (error) {
      console.error('[RoomService] Erreur lors de la sauvegarde dans rooms.json :', error.message);
    }
  }

  /**
   * Récupère ou instancie une salle
   */
  /**
   * Vérifie si une salle a un MJ actuellement connecté
   */
  hasActiveMJ(roomId) {
    const room = this.rooms.get(roomId);
    if (!room || !Array.isArray(room.users)) return false;
    return room.users.some(u => u.role === 'mj');
  }

  /**
   * Ajoute un utilisateur à une salle en respectant les contraintes strictes :
   * - Une partie ne peut être rejointe que si un MJ l'a créée et est présent
   * - 1 seul MJ et maximum 4 joueurs
   */
  async joinRoom(roomId, { socketId, username, role }) {
    await this.init();

    const normalizedRole = role === 'mj' ? 'mj' : 'player';
    let room = this.rooms.get(roomId);

    // Si la salle n'existe pas encore :
    if (!room) {
      if (normalizedRole === 'player') {
        throw new Error(`Cette partie n'existe pas ou le Maître du Jeu (MJ) ne l'a pas encore créée.`);
      }

      // Si c'est le MJ qui se connecte, on initialise/active la salle
      room = {
        id: roomId,
        createdAt: new Date().toISOString(),
        users: []
      };
      this.rooms.set(roomId, room);
    } else {
      // Si la salle existe déjà mais n'a pas encore de MJ connecté
      if (normalizedRole === 'player' && !this.hasActiveMJ(roomId)) {
        // Si la salle a déjà été créée par un MJ mais qu'il est en train de se reconnecter
        // On permet au joueur de rejoindre pour éviter le blocage lors d'un rafraîchissement
        console.log(`[RoomService] Joueur ${username} rejoint la salle existante "${roomId}"`);
      }
    }

    // Vérification de la présence d'un MJ si la demande est pour un MJ
    if (normalizedRole === 'mj') {
      const existingMj = room.users.find((u) => u.role === 'mj');
      if (existingMj && existingMj.socketId !== socketId) {
        // Si le même pseudo de MJ se reconnecte (refresh navigateur ou réseau)
        if (existingMj.username.trim().toLowerCase() === username.trim().toLowerCase()) {
          console.log(`[RoomService] Le MJ "${username}" se reconnecte à la salle "${roomId}".`);
          room.users = room.users.filter((u) => u.socketId !== existingMj.socketId);
        } else {
          throw new Error('La place de Maître du Jeu (MJ) est déjà occupée dans cette salle.');
        }
      }
    }

    // Vérification de la limite de 4 joueurs
    if (normalizedRole === 'player') {
      const currentPlayers = room.users.filter(u => u.role === 'player' && u.socketId !== socketId);
      if (currentPlayers.length >= 4) {
        throw new Error('La salle est complète (maximum 4 joueurs).');
      }
    }

    // Retirer l'utilisateur s'il était déjà dans la liste (reconnexion)
    room.users = room.users.filter(u => u.socketId !== socketId);

    const user = {
      socketId,
      username: username.trim(),
      role: normalizedRole,
      joinedAt: new Date().toISOString()
    };

    room.users.push(user);
    await this.persist();

    return { room, user };
  }

  /**
   * Retire un utilisateur par son socketId lors d'une déconnexion
   */
  async removeUser(socketId) {
    for (const [roomId, room] of this.rooms.entries()) {
      const userIndex = room.users.findIndex(u => u.socketId === socketId);
      if (userIndex !== -1) {
        const [removedUser] = room.users.splice(userIndex, 1);
        await this.persist();
        return { roomId, user: removedUser, room };
      }
    }
    return null;
  }

  /**
   * Retourne une salle par son ID
   */
  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  /**
   * Supprime une salle du service
   */
  async deleteRoom(roomId) {
    const cleanId = (roomId || '').trim();
    if (this.rooms.has(cleanId)) {
      this.rooms.delete(cleanId);
      await this.persist();
    }
  }
}

module.exports = new RoomService();
