'use strict';
const { captureBefore } = require('./commandJournal');
const MEMBER_EVENTS = new Set([
  'char:create', 'char:rename', 'char:roll_stats', 'char:get_all', 'chat:message',
  'inv:add_item', 'inv:remove_item', 'inv:update_qty', 'map:get_state', 'map:move_token', 'map:explore_fog',
  'turn:finish', 'map:measure', 'map:clear_measure', 'map:toggle_door', 'map:toggle_torch',
  'token:get_conditions_catalogue', 'scene:list', 'scene:trigger_teleporter', 'investigation:get',
  'investigation:add_clue', 'investigation:add_deduction', 'investigation:add_link',
  'draw:stroke', 'map:ping', 'prop:trigger_door', 'prop:export_investigation', 'history:list'
]);
const BOOTSTRAP = new Set(['room:create', 'room:join']);
// One command queue per server instance: gameplay and its journal finish before
// the next command can observe or mutate the campaigns (four-player tables).
const commandQueues = new WeakMap();
function authorize(event, socket, data, services) {
  const { sessions, roomService, roomManager } = services;
  if (services.closing) throw new Error('Arrêt du serveur en cours.');
  const identityId = sessions.fromRequest(socket.request);
  if (!identityId || identityId !== socket.data.identityId) throw new Error('Session expirée. Reconnectez-vous.');
  if (BOOTSTRAP.has(event)) return;
  const roomId = socket.data.roomId;
  if (!roomId || (data?.roomId && data.roomId !== roomId)) throw new Error('Accès à cette campagne refusé.');
  const membership = roomService.membership(roomId, identityId);
  if (!membership) throw new Error('Appartenance révoquée.');
  socket.data.user.role = membership.role;
  const room = roomManager.rooms.get(roomId);
  if (room?._restoring) throw new Error('Restauration en cours.');
  if (data?.epoch && data.epoch !== room.epoch) throw new Error('État périmé. Rechargez la campagne.');
  if (membership.role === 'mj') return;
  if (!MEMBER_EVENTS.has(event)) throw new Error('Action réservée au MJ.');
  const character = room.characters.find(c => c.ownerId === identityId);
  if (event.startsWith('inv:') && (!character || Number(data.slot) !== character.slot)) throw new Error('Cet inventaire ne vous appartient pas.');
  if (event === 'char:create' && character?.created) throw new Error('Vous possédez déjà un personnage.');
  if (event === 'investigation:add_clue' && (data?.isSealed || data?.clue?.isSealed)) throw new Error('Action réservée au MJ.');
  const publicClue = id => room.investigation?.clues?.some(c => c.id === id && !c.hidden && !c.isSealed);
  if (event === 'investigation:add_deduction' && !publicClue(data.clueId)) throw new Error('Indice inaccessible.');
  if (event === 'investigation:add_link' && (!publicClue(data.link?.fromId) || !publicClue(data.link?.toId))) throw new Error('Indice inaccessible.');
  if (event === 'prop:export_investigation' || event === 'prop:trigger_door') {
    const { projectMap } = require('./projections');
    const visible = projectMap(room, { role: 'player', identityId });
    if (!visible.props.some(p => p.id === data.propId)) throw new Error('Objet inaccessible.');
  }
}
function installGuard(socket, services, project = value => value, afterCommand = async () => {}) {
  const originalOn = socket.on.bind(socket);
  socket.on = function on(event, handler) {
    if (!event.includes(':')) return originalOn(event, handler);
    return originalOn(event, (...args) => {
      const execute = async () => {
      const callback = typeof args.at(-1) === 'function' ? args.pop() : null;
      const data = args[0] && typeof args[0] === 'object' ? args[0] : {};
      let result;
      let replied = false;
      const reply = value => {
        if (replied) return;
        replied = true; result = value;
        if (callback) callback(project(value, socket));
      };
      try {
        if (JSON.stringify(data).length > 256000) throw new Error('Message trop volumineux.');
        const now = Date.now();
        if (!socket.data.rate || now - socket.data.rate.start >= 1000) socket.data.rate = { start: now, count: 0 };
        if (++socket.data.rate.count > 100) throw new Error('Trop de commandes.');
        authorize(event, socket, data, services);
        delete data.role; delete data.isMJ;
        if (socket.data.roomId && !BOOTSTRAP.has(event)) data.roomId = socket.data.roomId;
        if (event.startsWith('chat:') || event.startsWith('dice:')) data.sender = socket.data.user?.username;
        if (event.startsWith('investigation:')) {
          data.author = socket.data.user?.username; data.authorRole = socket.data.user?.role;
          for (const key of ['clue', 'deduction']) if (data[key] && typeof data[key] === 'object') {
            data[key].author = data.author; data[key].authorRole = data.authorRole;
          }
        }
        const before = captureBefore(event, data, services.roomManager.rooms.get(socket.data.roomId));
        if (args.length === 0) await handler(reply);
        else await handler(data, reply);
        try { await afterCommand({ event, data, result, before }); }
        catch (error) {
          services.roomManager.lastPersistenceError = error;
          services.roomManager.onPersistenceError(error);
        }
      } catch (error) { reply({ success: false, error: error.message }); }
      };
      const previous = commandQueues.get(services) || Promise.resolve();
      const pending = previous.then(execute, execute);
      commandQueues.set(services, pending.catch(() => {}));
      return pending;
    });
  };
}
module.exports = { authorize, installGuard, MEMBER_EVENTS, drainCommands: services => commandQueues.get(services) || Promise.resolve() };
