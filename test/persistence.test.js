'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const CampaignRepository = require('../src/persistence/CampaignRepository');

async function fixture(t, options = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'campaign-repository-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'campaign.json');
  const backups = path.join(dir, 'backup');
  return { dir, file, backups, repo: new CampaignRepository(file, { backupDir: backups, ...options }) };
}
const envelope = revision => ({ schemaVersion: 1, revision, rooms: { abc: { id: 'abc', characters: [] } } });

test('missing and corrupt loads never write', async t => {
  const { dir, file, repo } = await fixture(t);
  assert.deepEqual(await repo.load(), { schemaVersion: 1, revision: 0, rooms: {} });
  assert.deepEqual(await fs.readdir(dir), []);
  await fs.writeFile(file, '{broken');
  await assert.rejects(repo.load());
  assert.equal(await fs.readFile(file, 'utf8'), '{broken');
  assert.deepEqual(await fs.readdir(dir), ['campaign.json']);
  await assert.rejects(repo.save(envelope(1)));
  assert.equal(await fs.readFile(file, 'utf8'), '{broken');
});

test('legacy load preserves a separate original copy and rejects presence-only entries', async t => {
  const { file, repo } = await fixture(t);
  const original = '{"abc":{"id":"abc","characters":[],"map":{"tokens":[]}}}';
  await fs.writeFile(file, original);
  const loaded = await repo.load();
  assert.equal(loaded.revision, 0);
  assert.equal(repo.lastLoadMetadata.legacy, true);
  loaded.rooms.abc.characters.push({ name: 'changed' });
  assert.equal(await fs.readFile(repo.lastLoadMetadata.copyPath, 'utf8'), original);
  assert.equal(await fs.readFile(file, 'utf8'), original);
  await fs.writeFile(file, JSON.stringify({ abc: { id: 'abc', createdAt: 'now', users: [] } }));
  await assert.rejects(repo.load(), { code: 'INCOMPATIBLE_ROOM', roomId: 'abc' });
});

test('serial saves snapshot inputs and retain bounded previous backups', async t => {
  const { file, backups, repo } = await fixture(t, { retention: 2 });
  const first = envelope(1);
  const p1 = repo.save(first);
  first.rooms.abc.characters.push({ name: 'late' });
  const p2 = repo.save(envelope(2));
  const p3 = repo.save(envelope(3));
  await Promise.all([p1, p2, p3]);
  await repo.flush();
  assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).revision, 3);
  const names = await fs.readdir(backups);
  assert.equal(names.length, 2);
  const copies = await Promise.all(names.map(async name => JSON.parse(await fs.readFile(path.join(backups, name), 'utf8'))));
  assert.deepEqual(copies.map(c => c.revision).sort(), [1, 2]);
  assert.deepEqual(copies.find(c => c.revision === 1).rooms.abc.characters, []);
  assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
});

test('failure propagates, cleans temp, flush reports it, and queue can recover', async t => {
  let fail = true;
  const injected = { ...fs, async rename(...args) { if (fail) { fail = false; throw Object.assign(new Error('injected'), { code: 'EIO' }); } return fs.rename(...args); } };
  const { dir, file, repo } = await fixture(t, { fs: injected });
  await assert.rejects(repo.save(envelope(1)), /injected/);
  await assert.rejects(repo.flush(), /injected/);
  assert.deepEqual(await fs.readdir(dir), []);
  await repo.save(envelope(2));
  await repo.flush();
  assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).revision, 2);
});

test('flush waits for in-flight saves and schema validation rejects invalid inputs', async t => {
  let release;
  let started;
  const gate = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { started = resolve; });
  const injected = { ...fs, async rename(...args) { started(); await gate; return fs.rename(...args); } };
  const { repo } = await fixture(t, { fs: injected });
  const pending = repo.save(envelope(1));
  await entered;
  let flushed = false;
  const flush = repo.flush().then(() => { flushed = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(flushed, false);
  release();
  await Promise.all([pending, flush]);
  await assert.rejects(repo.save({ schemaVersion: 2, revision: 0, rooms: {} }));
  await assert.rejects(repo.flush());
});
