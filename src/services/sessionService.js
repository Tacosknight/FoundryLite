'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const secret = () => crypto.randomBytes(32).toString('base64url');

class SessionService {
  constructor(filePath, { secure = false, ttl = 30 * 86400000 } = {}) {
    if (!filePath) throw new Error('Session storage path required');
    this.filePath = filePath;
    this.secure = secure;
    this.ttl = ttl;
    this.state = { version: 1, identities: {}, sessions: {} };
    this.queue = Promise.resolve();
  }
  async init() {
    try {
      const value = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
      if (value.version !== 1 || !value.identities || !value.sessions) throw new Error('Invalid identity storage');
      this.state = value;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  async persist() {
    const snapshot = JSON.stringify(this.state);
    const write = this.queue.catch(() => {}).then(async () => {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const temp = `${this.filePath}.${crypto.randomUUID()}.tmp`;
      try {
        const handle = await fs.open(temp, 'wx', 0o600);
        try { await handle.writeFile(snapshot); await handle.sync(); } finally { await handle.close(); }
        await fs.rename(temp, this.filePath);
      } finally { await fs.rm(temp, { force: true }); }
    });
    this.queue = write;
    return write;
  }
  tokenFromRequest(req) {
    const cookie = req.headers.cookie || '';
    const entry = cookie.split(';').map(s => s.trim()).find(s => s.startsWith('vtt_session='));
    return entry ? entry.slice('vtt_session='.length) : null;
  }
  resolve(token) {
    if (typeof token !== 'string' || token.length > 128) return null;
    const entry = this.state.sessions[hash(token)];
    if (!entry || entry.expiresAt <= Date.now()) return null;
    return this.state.identities[entry.identityId] ? entry.identityId : null;
  }
  fromRequest(req) { return this.resolve(this.tokenFromRequest(req)); }
  cookie(token) {
    return `vtt_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(this.ttl / 1000)}${this.secure ? '; Secure' : ''}`;
  }
  async issue(identityId) {
    const token = secret();
    this.state.sessions[hash(token)] = { identityId, expiresAt: Date.now() + this.ttl };
    await this.persist();
    return token;
  }
  async create() {
    const identityId = crypto.randomUUID();
    const recoveryCode = secret();
    this.state.identities[identityId] = { recoveryHash: hash(recoveryCode), createdAt: new Date().toISOString() };
    const token = await this.issue(identityId);
    return { identityId, token, recoveryCode };
  }
  async recover(code) {
    if (typeof code !== 'string' || code.length > 128) throw new Error('Code de récupération invalide.');
    const digest = hash(code);
    const found = Object.entries(this.state.identities).find(([, value]) => value.recoveryHash === digest);
    if (!found) throw new Error('Code de récupération invalide.');
    const [identityId, identity] = found;
    for (const [key, session] of Object.entries(this.state.sessions)) if (session.identityId === identityId) delete this.state.sessions[key];
    const recoveryCode = secret();
    identity.recoveryHash = hash(recoveryCode);
    return { identityId, token: await this.issue(identityId), recoveryCode };
  }
  async revoke(token) { if (token) delete this.state.sessions[hash(token)]; await this.persist(); }
  async flush() { await this.queue; }
}
module.exports = { SessionService, hash, secret };
