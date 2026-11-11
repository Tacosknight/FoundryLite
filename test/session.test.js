'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { SessionService } = require('../src/services/sessionService');

async function fixture(t, options) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'foundry-session-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'identities.json');
  const sessions = new SessionService(file, options);
  await sessions.init();
  return { sessions, file };
}

test('opaque session and recovery secrets are hashed and survive reload', async t => {
  const { sessions, file } = await fixture(t, { secure: true });
  const identity = await sessions.create();
  assert.equal(sessions.resolve(identity.token), identity.identityId);
  assert.match(sessions.cookie(identity.token), /HttpOnly; SameSite=Strict; Path=\//);
  assert.match(sessions.cookie(identity.token), /; Secure$/);
  const stored = await fs.readFile(file, 'utf8');
  assert.ok(!stored.includes(identity.token));
  assert.ok(!stored.includes(identity.recoveryCode));
  const loaded = new SessionService(file);
  await loaded.init();
  assert.equal(loaded.resolve(identity.token), identity.identityId);
  assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
});

test('recovery rotates its code and revokes every prior session', async t => {
  const { sessions } = await fixture(t);
  const original = await sessions.create();
  const second = await sessions.issue(original.identityId);
  const recovered = await sessions.recover(original.recoveryCode);
  assert.equal(recovered.identityId, original.identityId);
  assert.equal(sessions.resolve(original.token), null);
  assert.equal(sessions.resolve(second), null);
  assert.equal(sessions.resolve(recovered.token), original.identityId);
  await assert.rejects(sessions.recover(original.recoveryCode), /invalide/);
  await sessions.revoke(recovered.token);
  assert.equal(sessions.resolve(recovered.token), null);
});

test('expiry is checked on every resolve and corrupt storage is not overwritten', async t => {
  const { sessions, file } = await fixture(t);
  const identity = await sessions.create();
  for (const session of Object.values(sessions.state.sessions)) session.expiresAt = Date.now() - 1;
  assert.equal(sessions.resolve(identity.token), null);
  await fs.writeFile(file, '{corrupt');
  await assert.rejects(new SessionService(file).init());
  assert.equal(await fs.readFile(file, 'utf8'), '{corrupt');
});
