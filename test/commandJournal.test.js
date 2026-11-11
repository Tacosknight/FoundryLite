'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { captureBefore, recordCommand } = require('../src/security/commandJournal');
const { createCampaignTools, MAX_HISTORY } = require('../src/services/campaignTools');

function fixture() {
  const room = { activeSceneId: 'scene', characters: [{ id: 'hero', slot: 0, hp: 8, maxHp: 10, energy: 3, maxEnergy: 5 }],
    map: { tokens: [{ id: 'token', x: 0, y: 1, conditions: [] }], walls: [{ id: 'door', isOpen: false, isLocked: true }], props: [{ id: 'lever', linkedDoorId: 'door' }] } };
  let saved;
  const manager = { getRoom: () => room, persist: async () => { saved = JSON.parse(JSON.stringify(room)); } };
  const services = { tools: createCampaignTools(manager) };
  const socket = { id: 's', data: { roomId: 'room', identityId: 'identity', user: { username: 'GM' } } };
  const run = (event, data, result, before) => recordCommand({ event, data, result, before, socket, services });
  return { room, services, run, saved: () => saved };
}

test('vitals snapshot is independent and persisted with resulting state', async () => {
  const f = fixture();
  const before = captureBefore('char:update_vitals', { slot: 0 }, f.room);
  f.room.characters[0].hp = 4;
  await f.run('char:update_vitals', { slot: 0, password: 'secret' }, { success: true, character: f.room.characters[0] }, before);
  const entry = f.saved().history[0];
  assert.equal(entry.details.before.hp, 8);
  assert.equal(entry.details.after.hp, 4);
  assert.equal(f.saved().characters[0].hp, 4);
  assert.equal(entry.audience, 'gm');
  assert.ok(!JSON.stringify(entry).includes('secret'));
  assert.equal((await f.services.tools.listHistory('room')).total, 0);
});

test('movement retry is journaled once while distinct moves are retained', async () => {
  const f = fixture(), data = { tokenId: 'token', operationId: 'one' };
  const before = captureBefore('map:move_token', data, f.room);
  f.room.map.tokens[0].x = 3;
  const result = { success: true, token: { ...f.room.map.tokens[0] } };
  await f.run('map:move_token', data, result, before);
  await f.run('map:move_token', data, result, captureBefore('map:move_token', data, f.room));
  const nextBefore = captureBefore('map:move_token', data, f.room);
  f.room.map.tokens[0].x = 7;
  await f.run('map:move_token', { tokenId: 'token', operationId: 'two' }, { success: true, token: f.room.map.tokens[0] }, nextBefore);
  assert.equal(f.room.history.length, 2);
  assert.deepEqual(f.room.history[0].details.before, { x: 0, y: 1 });
  assert.deepEqual(f.room.history[0].details.after, { x: 3, y: 1 });
});

test('accepted dice, door and condition events contain bounded selected data', async () => {
  const f = fixture();
  await f.run('dice:roll', { secret: 'not stored' }, { success: true, result: { formula: '1d20', rolls: [17], total: 17, modifier: 0, target: { secret: 'not stored' } } });
  const doorBefore = captureBefore('prop:trigger_door', { propId: 'lever' }, f.room);
  Object.assign(f.room.map.walls[0], { isOpen: true, isLocked: false });
  await f.run('prop:trigger_door', { propId: 'lever' }, { success: true, door: f.room.map.walls[0] }, doorBefore);
  const conditionBefore = captureBefore('token:set_condition', { tokenId: 'token' }, f.room);
  f.room.map.tokens[0].conditions.push({ id: 'poison', name: 'Poison', duration: 3, secret: 'not stored' });
  await f.run('token:set_condition', { tokenId: 'token' }, { success: true, token: f.room.map.tokens[0] }, conditionBefore);
  assert.equal(f.room.history.length, 3);
  assert.deepEqual(f.room.history[1].details.before, { isOpen: false, isLocked: true });
  assert.deepEqual(f.room.history[2].details.after, [{ id: 'poison', name: 'Poison', duration: 3 }]);
  assert.ok(!JSON.stringify(f.room.history).includes('not stored'));
  assert.ok(f.room.history.every(entry => entry.audience === 'gm'));
});

test('failed, unacknowledged, preview, and unrelated commands are ignored', async () => {
  const f = fixture();
  for (const [event, data, result] of [
    ['dice:roll', {}, { success: false }], ['dice:roll', {}, undefined],
    ['map:move_token', { preview: true }, { success: true }],
    ['map:move_token', {}, { success: true, preview: true }],
    ['chat:message', {}, { success: true }]
  ]) await f.run(event, data, result, null);
  assert.equal(f.room.history, undefined);
});

test('history retention is bounded', async () => {
  const f = fixture();
  f.room.history = Array.from({ length: MAX_HISTORY }, (_, i) => ({ action: String(i) }));
  await f.run('dice:roll', {}, { success: true, result: { formula: 'd6', rolls: [2], total: 2 } });
  assert.equal(f.room.history.length, MAX_HISTORY);
  assert.equal(f.room.history[0].action, '1');
});
