'use strict';
const { projectMap } = require('./projections');
const pick = (o, keys) => Object.fromEntries(keys.filter(k => o && Object.hasOwn(o, k)).map(k => [k, structuredClone(o[k])]));
const CHARACTER = ['id','slot','name','title','created','raceId','race','raceIcon','classId','class','classIcon','hp','maxHp','energy','maxEnergy','attributes','stats','color','inventory','portraitUrl','imageUrl','movementSpeed','speed','perception'];
const CLUE = ['id','type','title','content','author','authorRole','color','x','y','image','status','isSealed','sealedBy','unsealedBy','unsealedAt','deductions','createdAt','updatedAt'];
function safeClue(c) {
  if (!c || c.hidden) return null;
  const out = pick(c, CLUE);
  if (c.isSealed) { delete out.content; delete out.image; delete out.deductions; }
  return out;
}
function stripPrivate(value, retainGameSecrets = false) {
  if (Array.isArray(value)) return value.map(item => stripPrivate(item, retainGameSecrets));
  if (!value || typeof value !== 'object') return value;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (/^(access|password|recoveryHash|sessions|invitations|ownerId|identityId|socketId|__proto__|constructor|prototype)$/.test(key) || (key === 'secretNotes' && !retainGameSecrets)) continue;
    result[key] = stripPrivate(item, retainGameSecrets);
  }
  return result;
}
function project(value, socket, roomManager, event = '') {
  if (!value || typeof value !== 'object') return value;
  const room = roomManager.rooms.get(socket.data.roomId);
  const viewer = { role: socket.data.user?.role, identityId: socket.data.identityId };
  if (!room) return stripPrivate(value);
  if (viewer.role === 'mj') return stripPrivate(value, true);
  const map = projectMap(room, viewer);
  const privateEvents = /^(scene:(created|updated|deleted)|library:|room:snapshot:)/;
  if (privateEvents.test(event)) return null;
  if (event === 'history:entry' && value.audience !== 'all') return null;
  if (event === 'chat:broadcast' && !value.id) return null;
  const visibleClues = (room.investigation?.clues || []).filter(c => !c.hidden);
  const visibleClueIds = new Set(visibleClues.map(c => c.id));
  const linkVisible = link => visibleClueIds.has(link.fromId) && visibleClueIds.has(link.toId);
  if (event.startsWith('investigation:') && value.clueId && !visibleClueIds.has(value.clueId)) return null;
  if (value.link && !linkVisible(value.link)) return null;
  if (event === 'investigation:link_deleted') return null;
  if (event.startsWith('scene:teleporter_')) return null;
  const walk = (input, key = '') => {
    if (input == null || typeof input !== 'object') return input;
    if (key === 'map' || key === 'scene') return structuredClone(map);
    if (key === 'room') return { id: room.id, users: stripPrivate(input.users || []) };
    if (key === 'character') return pick(input, CHARACTER);
    if (key === 'characters') return input.map(c => pick(c, CHARACTER));
    if (key === 'scenes') return [{ id: room.activeSceneId, name: room.map.name }];
    if (key === 'clue') return safeClue(input);
    if (key === 'clues') return input.map(safeClue).filter(Boolean);
    if (key === 'investigation') {
      const clues = (input.clues || []).map(safeClue).filter(Boolean);
      const ids = new Set(clues.map(c => c.id));
      return { clues, links: stripPrivate((input.links || []).filter(l => ids.has(l.fromId) && ids.has(l.toId))) };
    }
    if (key === 'currentTurn') return map.currentTurn;
    if (key === 'turnOrder') return map.turnSystem?.turnOrder || [];
    if (key === 'zone') return map.zones.find(z => z.id === input.id) || null;
    if (key === 'zones') return map.zones;
    if (key === 'prop') return map.props.find(p => p.id === input.id) || null;
    if (key === 'props') return map.props;
    if (key === 'token') return map.tokens.find(t => t.id === input.id) || null;
    if (key === 'tokens' || key === 'updatedTokens' || key === 'transportedTokens') return input.map(t => map.tokens.find(p => p.id === t.id)).filter(Boolean);
    if (key === 'trap') return map.traps.find(t => t.id === input.id) || null;
    if (key === 'traps') return map.traps;
    if (Array.isArray(input)) return input.map(v => walk(v));
    const out = {};
    for (const [k, item] of Object.entries(input)) {
      if (/^(access|password|recoveryHash|sessions|invitations|secretNotes|ownerId|identityId|socketId|__proto__|constructor|prototype)$/.test(k)) continue;
      if (k === 'ownCharacterId' || k === 'ownSlot') {
        const own = (room.characters || []).find(c => viewer.identityId && c.ownerId === viewer.identityId);
        out[k] = (k === 'ownSlot' ? own?.slot : own?.id) ?? null;
        continue;
      }
      if (k === 'revealedDoc' && !input.isDocRevealed) continue;
      if ((k === 'content' || k === 'image' || k === 'deductions') && input.isSealed) continue;
      out[k] = walk(item, k);
    }
    return out;
  };
  for (const [key, list] of [['tokenId', map.tokens], ['trapId', map.traps], ['propId', map.props], ['zoneId', map.zones]]) {
    if (value[key] && !list.some(item => item.id === value[key])) return null;
  }
  if (value.clue?.hidden) return null;
  return walk(value);
}
function createOutbound(io, roomManager, roomService, sessions) {
  function send(target, excluded, event, payload) {
    for (const socket of io.sockets.sockets.values()) {
      if (excluded === socket.id || (target && !socket.rooms.has(target) && target !== socket.id)) continue;
      if (sessions && sessions.fromRequest(socket.request) !== socket.data.identityId) continue;
      const member = roomService.membership(socket.data.roomId, socket.data.identityId);
      if (!member) continue;
      socket.data.user.role = member.role;
      const safe = project(payload, socket, roomManager, event);
      if (safe !== null) socket.emit(event, safe);
    }
  }
  return {
    to: target => ({ emit: (event, payload) => send(target, null, event, payload) }),
    in: target => ({ fetchSockets: () => io.in(target).fetchSockets() }),
    emit: () => { throw new Error('Global broadcasts are forbidden'); },
    socketFor(socket) {
      return new Proxy(socket, { get(target, key) {
        if (key === 'to') return destination => ({ emit: (event, payload) => send(destination, socket.id, event, payload) });
        const value = target[key];
        return typeof value === 'function' ? value.bind(target) : value;
      } });
    }
  };
}
module.exports = { project, createOutbound, stripPrivate };
