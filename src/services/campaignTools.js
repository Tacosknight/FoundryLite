'use strict';

const { randomUUID } = require('crypto');
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_HISTORY = 1000;
const id = () => randomUUID();
const copy = value => JSON.parse(JSON.stringify(value));
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const forbidden = /^(?:password|access|auth|session|socketId|owner|ownerId|owners|snapshots|history|library|revision|generation|epoch|__proto__|constructor|prototype)$/i;

// Only game data is portable; session and authorization data never enter an archive.
function clean(value) {
  if (Array.isArray(value)) return value.map(clean);
  if (!value || typeof value !== 'object') return value;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (!forbidden.test(key)) result[key] = clean(item);
  }
  return result;
}
function bounded(value) {
  const json = JSON.stringify(value);
  if (!json || Buffer.byteLength(json) > MAX_BYTES) throw new Error('Données trop volumineuses ou invalides');
  return JSON.parse(json);
}
function gameOf(room) {
  return bounded(clean({ scenes: room.scenes, activeSceneId: room.activeSceneId,
    characters: room.characters, investigation: room.investigation }));
}
function validateGame(input) {
  const game = bounded(input);
  if (!game || typeof game !== 'object' || Array.isArray(game) || !Array.isArray(game.scenes) || !game.scenes.length || !Array.isArray(game.characters) || !game.investigation || !Array.isArray(game.investigation.clues) || !Array.isArray(game.investigation.links)) throw new Error('Schéma de partie invalide');
  if (game.characters.some(c => !c || typeof c !== 'object' || Array.isArray(c))) throw new Error('Personnage invalide');
  const ids = new Set();
  for (const scene of game.scenes) {
    if (!scene || !validId(scene.id) || ids.has(scene.id)) throw new Error('Identifiant de scène invalide ou dupliqué');
    ids.add(scene.id);
    for (const key of ['tokens', 'walls', 'lights', 'zones', 'traps', 'teleporters', 'drawings', 'props', 'revealedAreas']) {
      if (scene[key] !== undefined && !Array.isArray(scene[key])) throw new Error('Contenu de scène invalide');
      const seen = new Set();
      for (const item of scene[key] || []) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Élément de scène invalide');
        if (item.id !== undefined && (!validId(item.id) || seen.has(item.id))) throw new Error('Identifiant invalide ou dupliqué');
        if (item.id) seen.add(item.id);
      }
    }
  }
  if (!ids.has(game.activeSceneId)) throw new Error('Scène active invalide');
  return clean(game);
}
function resetToken(token) {
  const result = clean(token);
  result.id = id();
  if (typeof result.maxHp === 'number') result.hp = result.maxHp;
  result.conditions = [];
  return result;
}
function duplicateScene(source, name) {
  const scene = bounded(clean(source));
  const oldSceneId = scene.id;
  scene.id = id();
  scene.name = name || `${scene.name || 'Scène'} (copie)`;
  const remaps = {};
  for (const key of ['tokens', 'walls', 'lights', 'zones', 'traps', 'teleporters', 'drawings', 'props']) {
    scene[key] = (scene[key] || []).filter(item => key !== 'tokens' || item.type !== 'player');
    remaps[key] = new Map();
    for (const item of scene[key]) {
      const old = item.id;
      item.id = id();
      if (old) remaps[key].set(old, item.id);
    }
  }
  for (const prop of scene.props) if (prop.linkedDoorId) prop.linkedDoorId = remaps.walls.get(prop.linkedDoorId) || null;
  for (const portal of scene.teleporters) {
    if (portal.targetSceneId === oldSceneId) portal.targetSceneId = scene.id;
    else if (portal.targetSceneId) { portal.targetSceneId = null; portal.active = false; }
  }
  scene.revealedAreas = [];
  scene.currentTurn = null;
  scene.turnSystem = { round: 1, turnOrder: [], currentIndex: 0, active: false };
  return scene;
}

function createCampaignTools(roomManager) {
  if (!roomManager || typeof roomManager.getRoom !== 'function' || typeof roomManager.persist !== 'function') throw new Error('RoomManager requis');
  const room = roomId => roomManager.getRoom(roomId);
  const save = async () => { await roomManager.persist(); };
  const snapshots = r => (r.snapshots ||= []);
  const library = r => (r.library ||= []);
  function requireEntry(entries, entryId) {
    if (!validId(entryId)) throw new Error('Identifiant invalide');
    const item = entries.find(entry => entry.id === entryId);
    if (!item) throw new Error('Élément introuvable');
    return item;
  }
  function makeSnapshot(r, name) {
    if (typeof name !== 'string' || !name.trim() || name.length > 200) throw new Error('Nom invalide');
    for (const character of r.characters || []) if (!validId(character.id)) character.id = id();
    const item = { id: id(), name: name.trim(), createdAt: new Date().toISOString(), game: gameOf(r) };
    snapshots(r).push(item);
    return item;
  }
  async function applyGame(r, input) {
    const game = validateGame(input);
    if (r._restoring) throw new Error('Restauration en cours');
    r._restoring = true;
    const before = { scenes: r.scenes, activeSceneId: r.activeSceneId, map: r.map,
      characters: r.characters, investigation: r.investigation, generation: r.generation,
      revision: r.revision, epoch: r.epoch, snapshots: r.snapshots };
    try {
      // Drain previously queued writes before changing the room; block incoming mutations.
      if (roomManager.repository?.queue) await roomManager.repository.queue;
      const backup = { id: id(), name: 'Sauvegarde avant restauration', createdAt: new Date().toISOString(), game: gameOf(r) };
      const owners = new Map((r.characters || []).filter(c => validId(c.id)).map(c => [c.id, c]));
      game.characters.forEach(c => {
        const old = validId(c.id) && owners.get(c.id);
        if (old) for (const key of ['socketId', 'owner', 'ownerId', 'owners']) if (Object.hasOwn(old, key)) c[key] = copy(old[key]);
      });
      r.snapshots = [...(r.snapshots || []), backup];
      r.scenes = game.scenes; r.activeSceneId = game.activeSceneId;
      r.map = r.scenes.find(s => s.id === r.activeSceneId);
      r.characters = game.characters; r.investigation = game.investigation;
      r.generation = (Number.isSafeInteger(r.generation) ? r.generation : 0) + 1;
      r.revision = (Number.isSafeInteger(r.revision) ? r.revision : 0) + 1;
      r.epoch = id();
      await save();
      return { map: copy(r.map), scenes: copy(r.scenes), activeSceneId: r.activeSceneId, characters: copy(r.characters), investigation: copy(r.investigation), generation: r.generation, revision: r.revision, epoch: r.epoch };
    } catch (error) {
      for (const [key, value] of Object.entries(before)) {
        if (value === undefined) delete r[key]; else r[key] = value;
      }
      throw error;
    } finally { delete r._restoring; }
  }
  return {
    async listSnapshots(roomId) { return snapshots(room(roomId)).map(({ game, ...meta }) => copy(meta)); },
    async createSnapshot(roomId, name) { const r = room(roomId); const { game, ...meta } = makeSnapshot(r, name); await save(); return copy(meta); },
    async deleteSnapshot(roomId, snapshotId) { const list = snapshots(room(roomId)); const item = requireEntry(list, snapshotId); list.splice(list.indexOf(item), 1); await save(); },
    async restoreSnapshot(roomId, snapshotId) { const r = room(roomId); return applyGame(r, requireEntry(snapshots(r), snapshotId).game); },
    async appendHistory(roomId, { actor, audience = 'gm', action, details = null }) {
      if (!actor || typeof actor !== 'string' || typeof action !== 'string' || !action || !['gm', 'all'].includes(audience)) throw new Error('Entrée de journal invalide');
      const r = room(roomId); const list = (r.history ||= []);
      const entry = bounded({ id: id(), timestamp: new Date().toISOString(), actor: actor.slice(0, 200), audience, action: action.slice(0, 200), details: clean(details) });
      list.push(entry); if (list.length > MAX_HISTORY) list.splice(0, list.length - MAX_HISTORY);
      await save(); return copy(entry);
    },
    async listHistory(roomId, { offset = 0, limit = 50, isGM = false } = {}) {
      if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('Pagination invalide');
      const entries = (room(roomId).history || []).filter(e => isGM || e.audience === 'all').slice().reverse();
      return { entries: copy(entries.slice(offset, offset + limit)), total: entries.length, offset, limit };
    },
    async duplicateScene(roomId, sceneId, name) { const r = room(roomId); const scene = duplicateScene(requireEntry(r.scenes, sceneId), name); r.scenes.push(scene); await save(); return copy(scene); },
    async listLibrary(roomId) { return copy(library(room(roomId))); },
    async createLibrary(roomId, { type, name, data, sceneId, tokenIds } = {}) {
      const r = room(roomId);
      if (!['map', 'token', 'encounter'].includes(type) || typeof name !== 'string' || !name.trim() || name.length > 200) throw new Error('Modèle invalide');
      if (type === 'encounter') {
        const scene = requireEntry(r.scenes, sceneId || r.activeSceneId);
        if (!Array.isArray(tokenIds) || !tokenIds.length || new Set(tokenIds).size !== tokenIds.length) throw new Error('Pions invalides');
        data = tokenIds.map(tokenId => { const token = requireEntry(scene.tokens, tokenId); if (token.type === 'player') throw new Error('Pion joueur interdit'); return resetToken(token); });
      }
      if (!data || typeof data !== 'object' || (type === 'encounter' ? !Array.isArray(data) : Array.isArray(data))) throw new Error('Données de modèle invalides');
      if (type === 'token' && data.type === 'player') throw new Error('Pion joueur interdit');
      const entry = bounded({ id: id(), type, name: name.trim(), data: clean(data) });
      library(r).push(entry); await save(); return copy(entry);
    },
    async updateLibrary(roomId, entryId, fields = {}) {
      const entry = requireEntry(library(room(roomId)), entryId);
      if (typeof fields.name !== 'string' || !fields.name.trim() || fields.name.length > 200) throw new Error('Nom invalide');
      if (fields.data !== undefined) {
        const data = bounded(fields.data);
        if (!data || typeof data !== 'object' || (entry.type === 'encounter' ? !Array.isArray(data) || data.some(t => !t || typeof t !== 'object' || t.type === 'player') : Array.isArray(data)) || (entry.type === 'token' && data.type === 'player')) throw new Error('Données de modèle invalides');
        entry.data = clean(data);
      }
      entry.name = fields.name.trim(); await save(); return copy(entry);
    },
    async deleteLibrary(roomId, entryId) { const list = library(room(roomId)); const entry = requireEntry(list, entryId); list.splice(list.indexOf(entry), 1); await save(); },
    async instantiateLibrary(roomId, entryId, { sceneId, x = 0, y = 0 } = {}) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Position invalide');
      const r = room(roomId); const entry = requireEntry(library(r), entryId);
      let result;
      if (entry.type === 'map') { result = duplicateScene(entry.data, entry.name); r.scenes.push(result); }
      else {
        const scene = requireEntry(r.scenes, sceneId || r.activeSceneId);
        const templates = entry.type === 'encounter' ? entry.data : [entry.data];
        result = templates.map(t => { const token = resetToken(t); token.x = (Number(t.x) || 0) + x; token.y = (Number(t.y) || 0) + y; return token; });
        scene.tokens ||= []; scene.tokens.push(...result);
      }
      await save(); return copy(result);
    },
    async exportGame(roomId) { return { schemaVersion: 1, game: gameOf(room(roomId)) }; },
    async importGame(roomId, archive) { const data = bounded(archive); if (!data || data.schemaVersion !== 1) throw new Error('Version invalide'); return applyGame(room(roomId), data.game); }
  };
}
module.exports = { createCampaignTools, MAX_BYTES, MAX_HISTORY };
