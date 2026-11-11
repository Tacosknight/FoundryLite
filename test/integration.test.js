'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { io } = require('socket.io-client');
const { createServer } = require('../src/createServer');
async function setup(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'foundry-integration-'));
  const instance = await createServer({ dataDirectory: directory });
  await new Promise(resolve => instance.server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${instance.server.address().port}`;
  const clients = [];
  t.after(async () => { clients.forEach(s => s.disconnect()); await instance.close(); await fs.rm(directory, { recursive: true, force: true }); });
  async function client() {
    const response = await fetch(`${url}/api/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const cookie = response.headers.get('set-cookie').split(';')[0];
    const socket = io(url, { extraHeaders: { Cookie: cookie }, transports: ['websocket'], reconnection: false });
    clients.push(socket);
    await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
    return { socket, cookie, identity: instance.services.sessions.resolve(cookie.split('=')[1]) };
  }
  return { ...instance, directory, url, client };
}
const call = (socket, event, data = {}) => new Promise((resolve, reject) => {
  socket.timeout(4000).emit(event, data, (error, result) => error ? reject(error) : resolve(result));
});
test('session, campaign isolation, invitations, privacy and restart persistence', async t => {
  const app = await setup(t);
  const gm = await app.client(); const player = await app.client(); const other = await app.client();
  assert.equal((await call(gm.socket, 'room:create', { roomId: 'alpha' })).success, true);
  assert.equal((await call(gm.socket, 'room:join', { roomId: 'alpha', username: 'MJ' })).success, true);
  assert.equal((await call(other.socket, 'room:join', { roomId: 'alpha', username: 'MJ', role: 'mj' })).success, false);
  const invitation = await call(gm.socket, 'room:invite');
  assert.equal((await call(player.socket, 'room:join', { roomId: 'alpha', username: 'A', invitationCode: invitation.code })).success, true);
  const room = app.services.roomManager.getRoom('alpha');
  room.map.props.push({ id: 'secret', x: 1, y: 1, name: 'Box', secretNotes: 'SENTINEL', revealedDoc: 'SEALED', isDocRevealed: false });
  room.map.traps.push({ id: 'hidden', name: 'HIDDEN_SENTINEL', x: 2, y: 2, revealed: false });
  const state = await call(player.socket, 'map:get_state');
  assert.equal(state.success, true);
  assert.ok(!JSON.stringify(state).includes('SENTINEL'));
  assert.ok(!JSON.stringify(state).includes('SEALED'));
  assert.equal((await call(player.socket, 'map:add_token', { role: 'mj', token: { name: 'bad' } })).success, false);
  assert.equal((await call(player.socket, 'map:get_state', { roomId: 'different' })).success, false);
  assert.equal((await call(gm.socket, 'room:save')).success, true);
  const disk = JSON.parse(await fs.readFile(path.join(app.directory, 'rooms.json'), 'utf8'));
  assert.equal(disk.schemaVersion, 1);
  assert.equal(disk.rooms.alpha.map, undefined);
  assert.equal(disk.rooms.alpha.scenes[0].props[0].secretNotes, 'SENTINEL');
  const { RoomManager } = require('../src/state/RoomManager');
  const reload = new RoomManager(path.join(app.directory, 'rooms.json'));
  await reload.init();
  assert.equal(reload.getRoom('alpha').map, reload.getRoom('alpha').scenes[0]);
  assert.equal(reload.getRoom('alpha').access.ownerId, gm.identity);
});
test('authoritative replacements, ownership, movement budget and revocation', async t => {
  const app = await setup(t);
  const gm = await app.client(); const player = await app.client();
  await call(gm.socket, 'room:create', { roomId: 'movement' });
  await call(gm.socket, 'room:join', { roomId: 'movement', username: 'MJ' });
  const invitation = await call(gm.socket, 'room:invite');
  await call(player.socket, 'room:join', { roomId: 'movement', username: 'Hero', invitationCode: invitation.code });
  const forged = await call(player.socket, 'char:create', { name: 'Hero', raceId: 'humain', classId: 'guerrier', attributes: { force: 18, dexterite: 18, intelligence: 8, charisme: 8 } });
  assert.equal(forged.success, true);
  const room = app.services.roomManager.getRoom('movement');
  const slot = forged.character.slot;
  room.map.tokens = [{ id: 'hero', type: 'player', slot, x: 0, y: 0, size: 40 }, { id: 'hidden', type: 'monster', x: 100, y: 100, hidden: true, name: 'PRIVATE_SENTINEL' }];
  room.map.currentTurn = { slot, round: 1, timestamp: 1 };
  const updates = [];
  player.socket.on('campaign:authoritative', state => updates.push(state));
  const moved = await call(player.socket, 'map:move_token', { tokenId: 'hero', x: 200, y: 0, operationId: 'first' });
  assert.equal(moved.success, true);
  // Same operation is replayed without reapplying effects or consuming budget.
  assert.equal((await call(player.socket, 'map:move_token', { tokenId: 'hero', x: 200, y: 0, operationId: 'first' })).success, true);
  assert.equal((await call(player.socket, 'map:move_token', { tokenId: 'hero', x: 350, y: 0 })).success, false);
  assert.equal(room.map.tokens[0].x, 200);
  const authoritative = await new Promise(resolve => {
    if (updates.length >= 3) return resolve(updates.at(-1));
    player.socket.once('campaign:authoritative', resolve);
  });
  assert.equal(authoritative.ownCharacterId, forged.character.id);
  assert.equal(authoritative.map.tokens.find(token => token.id === 'hero').x, 200);
  assert.ok(!JSON.stringify(authoritative).includes('PRIVATE_SENTINEL'));
  assert.equal((await call(player.socket, 'map:move_token', { tokenId: 'hero', x: 201, y: 0, epoch: 'old' })).success, false);
  room.investigation.clues.push({ id: 'sealed', isSealed: true, content: 'SECRET' });
  assert.equal((await call(player.socket, 'investigation:add_deduction', { clueId: 'sealed', deduction: { text: 'bad', authorRole: 'mj' } })).success, false);
  room.investigation.clues.push({ id: 'public', deductions: [] });
  const deduction = await call(player.socket, 'investigation:add_deduction', { clueId: 'public', deduction: { text: 'test', author: 'forged', authorRole: 'mj' } });
  assert.equal(deduction.deduction.author, 'Hero');
  assert.equal(deduction.deduction.authorRole, 'player');
  await call(gm.socket, 'room:revoke', { identityId: player.identity });
  assert.equal((await call(player.socket, 'map:get_state')).success, false);
});

test('two server instances remain independent and unauthorized uploads are rejected', async t => {
  const a = await setup(t); const b = await setup(t);
  assert.notEqual(a.services.roomManager, b.services.roomManager);
  const response = await fetch(`${a.url}/api/upload?roomId=x`, { method: 'POST' });
  assert.equal(response.status, 401);
  assert.equal((await fetch(`${a.url}/uploads/example.svg`)).status, 404);
});
