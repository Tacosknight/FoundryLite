'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const sharp = require('sharp');
const run = promisify(execFile);
const script = path.join(__dirname, '../scripts/migrate-legacy-media.js');
const ref = '/uploads/asset-123-456.png';
async function fixture(t, value = ref) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'legacy-media-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const data = path.join(root, 'data'), uploads = path.join(root, 'uploads');
  await fs.mkdir(data); await fs.mkdir(uploads);
  const source = JSON.stringify({ one: { map: { backgroundUrl: value }, characters: [{ portrait: value }] }, two: { map: { backgroundUrl: value } } });
  await fs.writeFile(path.join(data, 'rooms.json'), source);
  await fs.writeFile(path.join(uploads, 'asset-123-456.png'), await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).png().toBuffer());
  const args = [script, '--data-directory', data, '--uploads-directory', uploads];
  return { root, data, uploads, source, args };
}
test('dry run is read-only; apply backs up and creates per-campaign assets', async t => {
  const f = await fixture(t);
  const originalImage = await fs.readFile(path.join(f.uploads, 'asset-123-456.png'));
  await run(process.execPath, f.args);
  assert.deepEqual(await fs.readdir(f.data), ['rooms.json']);
  assert.equal(await fs.readFile(path.join(f.data, 'rooms.json'), 'utf8'), f.source);
  await run(process.execPath, [...f.args, '--apply']);
  const result = JSON.parse(await fs.readFile(path.join(f.data, 'rooms.json')));
  assert.equal(result.revision, 1);
  const a = result.rooms.one.map.backgroundUrl, b = result.rooms.two.map.backgroundUrl;
  assert.match(a, /^\/api\/assets\//); assert.notEqual(a, b);
  assert.equal(result.rooms.one.characters[0].portrait, a);
  const ids = Object.keys(result.rooms.one.assets).concat(Object.keys(result.rooms.two.assets));
  assert.equal(ids.length, 2);
  for (const id of ids) assert.equal((await sharp(path.join(f.data, 'assets', `${id}.webp`)).metadata()).format, 'webp');
  const backups = await fs.readdir(path.join(f.data, 'backups'));
  assert.equal(backups.length, 1);
  assert.equal(await fs.readFile(path.join(f.data, 'backups', backups[0]), 'utf8'), f.source);
  assert.deepEqual(await fs.readFile(path.join(f.uploads, 'asset-123-456.png')), originalImage);
  await run(process.execPath, [...f.args, '--apply']);
  assert.equal((await fs.readdir(path.join(f.data, 'backups'))).length, 1);
});
test('rejects ambiguous references, unsafe files, and unsupported images without writes', async t => {
  for (const value of ['/uploads/../secret', 'https://example.org/uploads/asset-123-456.png', '/uploads/asset-123-456.png?x=1']) {
    const f = await fixture(t, value);
    await assert.rejects(run(process.execPath, [...f.args, '--apply']));
    assert.deepEqual(await fs.readdir(f.data), ['rooms.json']);
  }
  const f = await fixture(t);
  await fs.rm(path.join(f.uploads, 'asset-123-456.png'));
  await assert.rejects(run(process.execPath, [...f.args, '--apply']));
  await fs.symlink(path.join(f.data, 'rooms.json'), path.join(f.uploads, 'asset-123-456.png'));
  await assert.rejects(run(process.execPath, [...f.args, '--apply']));
  assert.deepEqual(await fs.readdir(f.data), ['rooms.json']);
  await fs.rm(path.join(f.uploads, 'asset-123-456.png'));
  await fs.writeFile(path.join(f.uploads, 'asset-123-456.png'), '<svg/>');
  await assert.rejects(run(process.execPath, [...f.args, '--apply']));
  assert.deepEqual(await fs.readdir(f.data), ['rooms.json']);
});
test('rejects corrupt and presence-only room stores without overwriting them', async t => {
  const f = await fixture(t);
  for (const contents of ['{', JSON.stringify({ room: { players: [] } })]) {
    await fs.writeFile(path.join(f.data, 'rooms.json'), contents);
    await assert.rejects(run(process.execPath, [...f.args, '--apply']));
    assert.equal(await fs.readFile(path.join(f.data, 'rooms.json'), 'utf8'), contents);
    assert.deepEqual(await fs.readdir(f.data), ['rooms.json']);
  }
});
