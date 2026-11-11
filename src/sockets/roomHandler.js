'use strict';
function registerRoomHandlers(io, socket, { roomManager, roomService }) {
  socket.on('room:create', async (data, callback) => {
    try {
      const roomId = String(data?.roomId || '').trim();
      await roomService.create(roomId, socket.data.identityId);
      callback?.({ success: true, roomId });
    } catch (error) { callback?.({ success: false, error: error.message }); }
  });
  socket.on('room:join', async (data, callback) => {
    try {
      const roomId = String(data?.roomId || '').trim();
      const username = String(data?.username || '').trim();
      if (!username || username.length > 80) throw new Error('Pseudo invalide.');
      if (data.invitationCode) await roomService.accept(roomId, socket.data.identityId, data.invitationCode);
      if (!roomService.membership(roomId, socket.data.identityId)) throw new Error('Invitation requise, ou campagne historique à rattacher localement.');
      if (socket.data.roomId) { await socket.leave(socket.data.roomId); await roomService.removeUser(socket.id); }
      const { user } = await roomService.joinRoom(roomId, { socketId: socket.id, identityId: socket.data.identityId, username });
      await socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.user = user;
      const game = roomManager.rooms.get(roomId);
      const character = game.characters.find(c => c.ownerId === user.identityId) || null;
      if (character) character.socketId = socket.id;
      const room = { id: roomId, users: roomService.getRoom(roomId).users.map(({ identityId, ...u }) => u) };
      const characters = roomManager.getCharacters(roomId);
      io.to(roomId).emit('room:user_joined', { room, user, characters, isSaved: game.isSaved });
      io.to(roomId).emit('char:sync_all', { roomId, characters });
      callback?.({ success: true, room, user, character, characters, map: roomManager.getMapState(roomId), isSaved: game.isSaved, epoch: game.epoch });
    } catch (error) { callback?.({ success: false, error: error.message }); }
  });
  socket.on('room:save', async (data, callback) => {
    try {
      await roomManager.saveRoom(socket.data.roomId);
      io.to(socket.data.roomId).emit('room:saved', { roomId: socket.data.roomId, timestamp: new Date().toISOString() });
      callback?.({ success: true });
    } catch (error) { callback?.({ success: false, error: error.message }); }
  });
  socket.on('room:invite', async (data, callback) => {
    try { callback?.({ success: true, code: await roomService.invite(socket.data.roomId, socket.data.identityId, data?.characterId) }); }
    catch (error) { callback?.({ success: false, error: error.message }); }
  });
  socket.on('room:revoke', async (data, callback) => {
    try {
      const room = roomManager.rooms.get(socket.data.roomId);
      if (data.identityId === room.access.ownerId) throw new Error('Impossible de révoquer le propriétaire.');
      if (data.identityId) delete room.access.members[data.identityId];
      if (data.invitations) room.access.invitations = {};
      await roomManager.persist();
      callback?.({ success: true });
    } catch (error) { callback?.({ success: false, error: error.message }); }
  });
  socket.on('disconnect', async () => {
    const result = await roomService.removeUser(socket.id);
    if (!result) return;
    io.to(result.roomId).emit('room:user_left', { user: result.user, room: { id: result.roomId, users: result.room.users }, characters: roomManager.getCharacters(result.roomId) });
  });
}
module.exports = registerRoomHandlers;
