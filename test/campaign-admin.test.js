'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const script = path.join(__dirname, '../scripts/campaign-admin.js');
async function fixture(t, rooms) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'campaign-admin-test-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await fs.writeFile(path.join(dir, 'identities.json'), JSON.stringify({ version: 1, identities: { alice: { recoveryHash: 'synthetic' } }, sessions: {} }));
  const source = JSON.stringify(rooms, null, 2);
  await fs.writeFile(path.join(dir, 'rooms.json'), source);
  return { dir, source };
}
function run(dir, ...extra) {
  return spawnSync(process.execPath, [script, '--data-directory', dir, '--campaign', 'alpha', '--identity', 'alice', ...extra], { encoding: 'utf8' });
}

test('legacy dry run is read-only and apply saves an exact source backup', async t => {
  const { dir, source } = await fixture(t, { alpha: { characters: [], map: { tokens: [] }, password: 'old' }, beta: { scenes: [] } });
  const before = await fs.readdir(dir);
  const dry = run(dir);
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /Dry run/);
  assert.deepEqual(await fs.readdir(dir), before);
  assert.equal(await fs.readFile(path.join(dir, 'rooms.json'), 'utf8'), source);
  const applied = run(dir, '--apply');
  assert.equal(applied.status, 0, applied.stderr);
  const result = JSON.parse(await fs.readFile(path.join(dir, 'rooms.json'), 'utf8'));
  assert.equal(result.revision, 1);
  assert.deepEqual(result.rooms.alpha.access, { ownerId: 'alice', members: { alice: { role: 'mj' } }, invitations: {} });
  assert.deepEqual(result.rooms.beta, { scenes: [] });
  assert.equal(result.rooms.alpha.password, 'old');
  const backups = await fs.readdir(path.join(dir, 'backups'));
  assert.equal(backups.length, 1);
  assert.equal(await fs.readFile(path.join(dir, 'backups', backups[0]), 'utf8'), source);
  const again = run(dir, '--apply');
  assert.notEqual(again.status, 0);
  assert.match(again.stderr, /access record/);
});

test('versioned documents preserve other fields and increment revision', async t => {
  const { dir, source } = await fixture(t, { schemaVersion: 1, revision: 7, extra: 'keep', rooms: { alpha: { characters: [] } } });
  const applied = run(dir, '--apply');
  assert.equal(applied.status, 0, applied.stderr);
  const result = JSON.parse(await fs.readFile(path.join(dir, 'rooms.json'), 'utf8'));
  assert.equal(result.revision, 8);
  assert.equal(result.extra, 'keep');
  const backups = await fs.readdir(path.join(dir, 'backups'));
  assert.equal(await fs.readFile(path.join(dir, 'backups', backups[0]), 'utf8'), source);
});

test('refuses ambiguous access, bad identity, missing room and malformed documents without writes', async t => {
  for (const access of [null, {}, { ownerId: 'other' }]) {
    const { dir, source } = await fixture(t, { alpha: { characters: [], access } });
    assert.notEqual(run(dir, '--apply').status, 0);
    assert.equal(await fs.readFile(path.join(dir, 'rooms.json'), 'utf8'), source);
    assert.deepEqual((await fs.readdir(dir)).sort(), ['identities.json', 'rooms.json']);
  }
  const { dir } = await fixture(t, { beta: { characters: [] } });
  assert.notEqual(run(dir, '--apply').status, 0);
  assert.notEqual(run(dir, '--identity', 'bob', '--apply').status, 0);
  await fs.writeFile(path.join(dir, 'identities.json'), JSON.stringify({ version: 1, identities: {}, sessions: {} }));
  assert.match(run(dir, '--apply').stderr, /identity not found/);
  await fs.writeFile(path.join(dir, 'identities.json'), JSON.stringify({ version: 1, identities: { alice: {} }, sessions: {} }));
  await fs.writeFile(path.join(dir, 'rooms.json'), '{broken');
  assert.notEqual(run(dir, '--apply').status, 0);
  assert.equal(await fs.readFile(path.join(dir, 'rooms.json'), 'utf8'), '{broken');
  assert.deepEqual((await fs.readdir(dir)).sort(), ['identities.json', 'rooms.json']);
});

test('requires explicit arguments and rejects unknown or duplicate flags', () => {
  for (const args of [[], ['--apply'], ['--help', '--apply'], ['--bogus']]) {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
  }
});
