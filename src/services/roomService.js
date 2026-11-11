'use strict';
const { hash, secret } = require('./sessionService');

class RoomService {
  constructor(roomManager) { this.manager = roomManager; this.rooms = new Map(); }
  async init() {}
  getRoom(id) { return this.rooms.get(id) || null; }
  hasActiveMJ(id) { return Boolean(this.rooms.get(id)?.users.some(u => u.role === 'mj')); }
  membership(roomId, identityId) { return this.manager.rooms.get(roomId)?.access?.members?.[identityId] || null; }
  async create(roomId, identityId) {
    if (!/^[\p{L}\p{N}_ -]{1,80}$/u.test(roomId)) throw new Error('Nom de campagne invalide (80 caractères maximum).');
    if (this.manager.rooms.has(roomId)) throw new Error('Cette campagne existe déjà. Une invitation ou un rattachement local est nécessaire.');
    const room = this.manager.createRoom(roomId);
    room.access = { ownerId: identityId, members: { [identityId]: { role: 'mj' } }, invitations: {} };
    room.isSaved = true;
    await this.manager.persist();
    return room;
  }
  async invite(roomId, identityId, characterId) {
    if (this.membership(roomId, identityId)?.role !== 'mj') throw new Error('Action réservée au MJ.');
    const room = this.manager.rooms.get(roomId);
    if (characterId && !room.characters.some(c => c.id === characterId)) throw new Error('Personnage introuvable.');
    const code = secret();
    room.access.invitations[hash(code)] = { expiresAt: Date.now() + 86400000, characterId: characterId || null };
    await this.manager.persist();
    return code;
  }
  async accept(roomId, identityId, code) {
    const room = this.manager.rooms.get(roomId);
    const invite = typeof code === 'string' && room?.access?.invitations?.[hash(code)];
    if (!invite || invite.expiresAt <= Date.now()) throw new Error('Invitation invalide ou expirée.');
    if (!room.access.members[identityId] && Object.values(room.access.members).filter(m => m.role === 'player').length >= 4) throw new Error('La campagne comporte déjà quatre joueurs.');
    if (!room.access.members[identityId]) room.access.members[identityId] = { role: 'player' };
    if (invite.characterId) {
      const char = room.characters.find(c => c.id === invite.characterId);
      if (char) char.ownerId = identityId;
    }
    delete room.access.invitations[hash(code)];
    await this.manager.persist();
  }
  async joinRoom(roomId, { socketId, identityId, username }) {
    const member = this.membership(roomId, identityId);
    if (!member) throw new Error('Une invitation est nécessaire pour rejoindre cette campagne.');
    let room = this.rooms.get(roomId);
    if (!room) { room = { id: roomId, users: [] }; this.rooms.set(roomId, room); }
    const user = { socketId, identityId, username, role: member.role, joinedAt: new Date().toISOString() };
    room.users = room.users.filter(u => u.socketId !== socketId);
    room.users.push(user);
    return { room, user };
  }
  async removeUser(socketId) {
    for (const [roomId, room] of this.rooms) {
      const idx = room.users.findIndex(u => u.socketId === socketId);
      if (idx >= 0) { const [user] = room.users.splice(idx, 1); return { roomId, room, user }; }
    }
    return null;
  }
  async deleteRoom(id) { this.rooms.delete(id); }
}
module.exports = { RoomService };
