'use strict';

// The caller must register these handlers behind the application's central guard and
// supply its viewer-projecting io adapter. Client-supplied roles are never trusted.
function registerTools(io, socket, { roomManager, tools }) {
  if (!roomManager || !tools) throw new Error('Dépendances manquantes');
  const events = {
    'room:snapshot:list': [true, (r) => tools.listSnapshots(r)],
    'room:snapshot:create': [true, (r, d) => tools.createSnapshot(r, d.name)],
    'room:snapshot:delete': [true, (r, d) => tools.deleteSnapshot(r, d.snapshotId)],
    'room:snapshot:restore': [true, (r, d) => tools.restoreSnapshot(r, d.snapshotId)],
    'history:list': [false, (r, d, gm) => tools.listHistory(r, { offset: d.offset, limit: d.limit, isGM: gm })],
    'scene:duplicate': [true, (r, d) => tools.duplicateScene(r, d.sceneId, d.name)],
    'library:list': [true, r => tools.listLibrary(r)],
    'library:create': [true, (r, d) => tools.createLibrary(r, d)],
    'library:update': [true, (r, d) => tools.updateLibrary(r, d.id, d.fields)],
    'library:delete': [true, (r, d) => tools.deleteLibrary(r, d.id)],
    'library:instantiate': [true, (r, d) => tools.instantiateLibrary(r, d.id, d)],
    'room:export': [true, r => tools.exportGame(r)],
    'room:import': [true, (r, d) => tools.importGame(r, d.archive)]
  };
  const mutations = new Set(['room:snapshot:create', 'room:snapshot:delete', 'room:snapshot:restore', 'scene:duplicate', 'library:create', 'library:update', 'library:delete', 'library:instantiate', 'room:import']);
  for (const [event, [requiresGM, run]] of Object.entries(events)) {
    socket.on(event, async (data, callback) => {
      try {
        const d = data && typeof data === 'object' ? data : {};
        const roomId = socket.data?.roomId;
        if (!roomId || (d.roomId && d.roomId !== roomId)) throw new Error('Salle non autorisée');
        const gm = ['mj', 'gm'].includes(socket.data?.user?.role);
        if (requiresGM && !gm) throw new Error('Action réservée au MJ');
        const result = await run(roomId, d, gm);
        if (event === 'room:snapshot:restore' || event === 'room:import') {
          io.to(roomId).emit('room:restored', { roomId, ...result });
        }
        if (mutations.has(event)) {
          await tools.appendHistory(roomId, { actor: socket.data.user.username || socket.id, action: event, audience: 'gm' });
        }
        if (typeof callback === 'function') callback({ success: true, result });
      } catch (error) {
        if (typeof callback === 'function') callback({ success: false, error: error.message });
      }
    });
  }
}
module.exports = registerTools;
module.exports.registerTools = registerTools;
