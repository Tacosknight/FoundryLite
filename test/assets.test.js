'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const express = require('express');
const { AssetService } = require('../src/services/assetService');
const { createUploadRouter } = require('../src/routes/uploadRoutes');

async function fixture(t, options = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'vtt-assets-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const room = { assets: {}, characters: [{ ownerId: 'player', slot: 1 }], map: { tokens: [], props: [], walls: [] }, investigation: { clues: [] } };
  const rooms = new Map([['room', room]]);
  const roomManager = { rooms, persist: async () => {} };
  const roomService = { membership: (id, identity) => rooms.has(id) && ({ gm: { role: 'mj' }, player: { role: 'player' } })[identity] };
  const service = new AssetService({ directory, roomManager, roomService, ...options });
  await service.init();
  const sessions = { fromRequest: req => req.headers['x-identity'] };
  const app = express();
  app.use('/api', createUploadRouter({ roomManager, roomService, sessions, assetService: service }));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  return { room, roomManager, service, directory, base: `http://127.0.0.1:${server.address().port}` };
}
async function image(format = 'png') { return sharp({ create: { width: 4, height: 4, channels: 3, background: '#ff0000' } }).toFormat(format).toBuffer(); }
async function upload(base, data, identity = 'gm') {
  const form = new FormData(); form.append('file', new Blob([data], { type: 'image/png' }), '../evil.svg');
  return fetch(`${base}/api/upload?roomId=room`, { method: 'POST', headers: identity ? { 'x-identity': identity } : {}, body: form });
}

test('uploads sanitized images and enforces reference visibility', async t => {
  const { room, service, base, directory } = await fixture(t);
  const response = await upload(base, await image('jpeg'));
  assert.equal(response.status, 201);
  const { assetId, url } = await response.json();
  assert.equal((await fs.readdir(directory)).length, 1);
  assert.equal((await sharp(await fs.readFile(path.join(directory, `${assetId}.webp`))).metadata()).format, 'webp');
  const get = identity => fetch(base + url, { headers: { 'x-identity': identity } });
  assert.equal((await get('player')).status, 404);
  assert.equal((await get('outsider')).status, 403);
  const gm = await get('gm'); assert.equal(gm.status, 200); assert.equal(gm.headers.get('cache-control'), 'private, no-store'); assert.equal(gm.headers.get('x-content-type-options'), 'nosniff');
  room.map.backgroundUrl = url;
  assert.equal((await get('player')).status, 200);
  room.map.backgroundUrl = null;
  room.investigation.clues.push({ image: url, isSealed: true });
  assert.equal((await get('player')).status, 404);
  room.investigation.clues[0].isSealed = false;
  assert.equal((await get('player')).status, 200);
  room.investigation.clues = [];
  room.characters[0].portrait = url;
  assert.equal((await get('player')).status, 200);
  await assert.rejects(service.get('room', 'gm', '../bad'), { status: 404 });
});

test('rejects unauthenticated uploads, malformed images, oversized files and quota overflow', async t => {
  const { base, service, directory } = await fixture(t, { maxBytes: 1024, quota: 10 });
  assert.equal((await upload(base, Buffer.from('bad'), null)).status, 401);
  assert.equal((await upload(base, Buffer.from('bad'), 'outsider')).status, 403);
  assert.equal((await upload(base, Buffer.from('<svg/>'))).status, 400);
  assert.equal((await upload(base, Buffer.alloc(1025))).status, 413);
  assert.equal((await upload(base, await image())).status, 413);
  assert.deepEqual(await fs.readdir(directory), []);
  await assert.rejects(service.upload('room', 'outsider', { buffer: await image() }), { status: 403 });
});

test('rejects animated and over-pixel-limit images', async t => {
  const { service, directory } = await fixture(t, { maxPixels: 12 });
  await assert.rejects(service.upload('room', 'gm', { buffer: await image() }), { status: 400 });
  const animated = await sharp(Buffer.from([255,0,0, 255,0,0, 255,0,0, 255,0,0, 0,0,255, 0,0,255, 0,0,255, 0,0,255]), { raw: { width: 2, height: 4, channels: 3, pageHeight: 2 } }).webp({ loop: 0, delay: [100, 100] }).toBuffer();
  assert.equal((await sharp(animated, { animated: true }).metadata()).pages, 2);
  await assert.rejects(service.upload('room', 'gm', { buffer: animated }), { status: 400 });
  assert.deepEqual(await fs.readdir(directory), []);
});

test('rolls back metadata and file when persistence fails', async t => {
  const { service, roomManager, room, directory } = await fixture(t);
  roomManager.persist = async () => { throw new Error('disk'); };
  await assert.rejects(service.upload('room', 'gm', { buffer: await image() }), /disk/);
  assert.deepEqual(room.assets, {});
  assert.deepEqual(await fs.readdir(directory), []);
});
