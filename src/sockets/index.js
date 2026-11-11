'use strict';
const { Server } = require('socket.io');
const registerRoomHandlers = require('./roomHandler');
const registerCharHandlers = require('./char.handler');
const registerChatHandlers = require('./chat.handler');
const registerInvHandlers = require('./inv.handler');
const registerMapHandlers = require('./map.handler');
const registerTools = require('./tools.handler');
const { installGuard } = require('../security/authorization');
const { recordCommand } = require('../security/commandJournal');
const { createOutbound, project } = require('../security/outbound');

function initSocketServer(httpServer, services, { allowedOrigins = [] } = {}) {
  const allowed = origin => !origin || allowedOrigins.includes(origin);
  const io = new Server(httpServer, {
    maxHttpBufferSize: 6 * 1024 * 1024,
    allowRequest: (req, callback) => callback(null, allowed(req.headers.origin)),
    cors: { origin: (origin, callback) => callback(null, allowed(origin)), credentials: true }
  });
  const outbound = createOutbound(io, services.roomManager, services.roomService, services.sessions);
  io.use((socket, next) => {
    const identityId = services.sessions.fromRequest(socket.request);
    if (!identityId) return next(new Error('Session requise. Rechargez la page.'));
    socket.data.identityId = identityId;
    socket.data.services = services;
    next();
  });
  io.on('connection', socket => {
    installGuard(socket, services, (value, viewer) => project(value, viewer, services.roomManager), async ({ event, data, result, before }) => {
      try { await recordCommand({ event, data, result, before, socket, services }); }
      catch (error) {
        services.roomManager.lastPersistenceError = error;
        services.roomManager.onPersistenceError(error);
      }
      if (!socket.data.roomId || data.preview) return;
      const readOnly = /(:get|:get_all|:get_state|:get_conditions_catalogue|:list|:export)$/.test(event);
      if (readOnly || /^(chat:|dice:|map:(measure|clear_measure|ping))/.test(event)) return;
      const room = services.roomManager.rooms.get(socket.data.roomId);
      if (!room) return;
      // A replacement is also sent after rejected movement to undo optimistic positions.
      if (result?.success === false && event !== 'map:move_token') return;
      for (const viewer of io.sockets.sockets.values()) {
        if (!viewer.rooms.has(room.id) || services.sessions.fromRequest(viewer.request) !== viewer.data.identityId) continue;
        const member = services.roomService.membership(room.id, viewer.data.identityId);
        if (!member) continue;
        viewer.data.user.role = member.role;
        const own = room.characters.find(c => c.ownerId === viewer.data.identityId);
        viewer.emit('campaign:authoritative', project({
          epoch: room.epoch, ownCharacterId: own?.id ?? null, ownSlot: own?.slot ?? null,
          characters: room.characters, map: services.roomManager.getMapState(room.id), investigation: room.investigation
        }, viewer, services.roomManager, 'campaign:authoritative'));
      }
    });
    const guarded = outbound.socketFor(socket);
    for (const register of [registerRoomHandlers, registerCharHandlers, registerChatHandlers, registerInvHandlers, registerMapHandlers, registerTools]) register(outbound, guarded, services);
    socket.on('error', error => console.error('[Socket error]', error.message));
  });
  services.roomManager.onPersistenceError = () => {
    for (const socket of io.sockets.sockets.values()) if (socket.data.user?.role === 'mj') socket.emit('room:save_error', { error: 'Échec de sauvegarde disque. Les dernières modifications ne sont pas garanties.' });
  };
  return io;
}
module.exports = initSocketServer;
