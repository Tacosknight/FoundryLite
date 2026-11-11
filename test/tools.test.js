'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { RoomManager } = require('../src/state/RoomManager');
const { createCampaignTools } = require('../src/services/campaignTools');
const registerTools = require('../src/sockets/tools.handler');

function setup() {
  const manager = new RoomManager();
  let saves = 0;
  manager.persist = async () => { saves++; };
  manager.createRoom('x');
  return { manager, tools: createCampaignTools(manager), saves: () => saves };
}

test('snapshots restore game, preserve access and ownership, advance generation', async () => {
  const { manager, tools, saves } = setup();
  const r = manager.getRoom('x'); r.access = { secret: 'keep' }; r.password = 'pw';
  r.characters = [{ slot: 0, name: 'A', socketId: 'connected', hp: 10 }];
  const oldEpoch = r.epoch;
  const snapshot = await tools.createSnapshot('x', 'Initial');
  r.characters[0].hp = 1;
  r.characters[0].slot = 9;
  const state = await tools.restoreSnapshot('x', snapshot.id);
  assert.equal(state.characters[0].hp, 10); assert.equal(state.characters[0].socketId, 'connected');
  assert.deepEqual(r.access, { secret: 'keep' }); assert.equal(r.password, 'pw');
  assert.equal(state.generation, 1); assert.equal(state.revision, 1); assert.notEqual(state.epoch, oldEpoch);
  assert.equal((await tools.listSnapshots('x')).length, 2);
  assert.ok(saves() >= 2);
  const archive = await tools.exportGame('x');
  assert.ok(!JSON.stringify(archive).includes('connected')); assert.ok(!JSON.stringify(archive).includes('secret'));
  await assert.rejects(tools.importGame('x', { schemaVersion: 1, game: { scenes: [] } }));
});

test('restore waits for pending persistence and rolls back on failure', async () => {
  const { manager, tools } = setup(); const r = manager.getRoom('x');
  r.characters = [{ id: 'hero', slot: 0, ownerId: 'alice', hp: 10 }];
  const snapshot = await tools.createSnapshot('x', 'before');
  r.characters[0].hp = 2;
  const oldEpoch = r.epoch;
  let release;
  manager.repository.queue = new Promise(resolve => { release = resolve; });
  manager.persist = async () => { throw new Error('disk error'); };
  const restoring = tools.restoreSnapshot('x', snapshot.id);
  assert.equal(r._restoring, true);
  assert.equal(r.characters[0].hp, 2);
  release();
  await assert.rejects(restoring, /disk error/);
  assert.equal(r._restoring, undefined);
  assert.equal(r.characters[0].hp, 2);
  assert.equal(r.characters[0].ownerId, 'alice');
  assert.equal(r.epoch, oldEpoch);
  assert.equal((await tools.listSnapshots('x')).length, 1);
});

test('scene duplication remaps references and resets state', async () => {
  const { manager, tools } = setup(); const r = manager.getRoom('x'); const s = r.map;
  s.walls = [{ id: 'wall' }]; s.props = [{ id: 'prop', linkedDoorId: 'wall' }];
  s.tokens = [{ id: 'p', type: 'player' }, { id: 'm', type: 'monster' }];
  s.teleporters = [{ id: 'a', targetSceneId: s.id, active: true }, { id: 'b', targetSceneId: 'else', active: true }];
  s.revealedAreas = [{ x: 1 }]; s.turnSystem.active = true;
  const d = await tools.duplicateScene('x', s.id);
  assert.equal(d.tokens.length, 1); assert.notEqual(d.tokens[0].id, 'm');
  assert.equal(d.props[0].linkedDoorId, d.walls[0].id);
  assert.equal(d.teleporters[0].targetSceneId, d.id); assert.equal(d.teleporters[1].active, false);
  assert.deepEqual(d.revealedAreas, []); assert.equal(d.turnSystem.active, false);
});

test('encounters instantiate independent reset tokens and history filters before pagination', async () => {
  const { manager, tools } = setup(); const s = manager.getRoom('x').map;
  s.tokens.push({ id: 'monster', type: 'monster', x: 3, y: 4, hp: 1, maxHp: 10, conditions: ['poison'] });
  const e = await tools.createLibrary('x', { type: 'encounter', name: 'Ambush', tokenIds: ['monster'] });
  const a = await tools.instantiateLibrary('x', e.id, { x: 10, y: 20 });
  const b = await tools.instantiateLibrary('x', e.id, { x: 10, y: 20 });
  assert.notEqual(a[0].id, b[0].id); assert.equal(a[0].x, 13); assert.equal(a[0].hp, 10); assert.deepEqual(a[0].conditions, []);
  await tools.appendHistory('x', { actor: 'GM', action: 'secret', audience: 'gm' });
  await tools.appendHistory('x', { actor: 'GM', action: 'public', audience: 'all' });
  assert.equal((await tools.listHistory('x')).total, 1); assert.equal((await tools.listHistory('x', { isGM: true })).total, 2);
});

test('socket handlers reject forged roles and send restored via adapter', async () => {
  const { manager, tools } = setup(); const handlers = {}; const emits = [];
  const socket = { id: 's', data: { roomId: 'x', user: { role: 'player', username: 'P' } }, on: (name, fn) => { handlers[name] = fn; } };
  const io = { to: room => ({ emit: (event, payload) => emits.push({ room, event, payload }) }) };
  registerTools(io, socket, { roomManager: manager, tools });
  let response;
  await handlers['room:snapshot:create']({ role: 'mj', name: 'S' }, r => { response = r; });
  assert.equal(response.success, false);
  socket.data.user.role = 'mj';
  await handlers['room:snapshot:create']({ name: 'S' }, r => { response = r; });
  const snapshotId = response.result.id;
  await handlers['room:snapshot:restore']({ snapshotId }, r => { response = r; });
  assert.equal(response.success, true); assert.equal(emits[0].event, 'room:restored');
  assert.ok(emits[0].payload.map); assert.ok(emits[0].payload.investigation);
  await handlers['history:list']({ roomId: 'other' }, r => { response = r; });
  assert.equal(response.success, false);
});
