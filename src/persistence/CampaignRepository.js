'use strict';

const defaultFs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function validateRooms(rooms) {
  if (!isObject(rooms)) throw new Error('Invalid rooms object');
  for (const [id, room] of Object.entries(rooms)) {
    if (!isObject(room)) throw new Error(`Invalid room: ${id}`);
    const campaignFields = ['characters', 'map', 'scenes', 'investigation', 'isSaved', 'activeSceneId'];
    if (!campaignFields.some(field => has(room, field))) {
      const error = new Error(`Incompatible or presence-only room: ${id}`);
      error.code = 'INCOMPATIBLE_ROOM';
      error.roomId = id;
      throw error;
    }
    if ((has(room, 'characters') && !Array.isArray(room.characters)) ||
        (has(room, 'scenes') && !Array.isArray(room.scenes)) ||
        (has(room, 'map') && !isObject(room.map)) ||
        (has(room, 'investigation') && !isObject(room.investigation)) ||
        (has(room, 'isSaved') && typeof room.isSaved !== 'boolean') ||
        (has(room, 'activeSceneId') && typeof room.activeSceneId !== 'string')) {
      throw new Error(`Invalid campaign room: ${id}`);
    }
  }
}

function parseDocument(text) {
  const data = JSON.parse(text);
  if (!isObject(data)) throw new Error('Invalid campaign document');
  // A legacy room may itself be named "schemaVersion"; only a scalar marks an envelope.
  const versioned = has(data, 'schemaVersion') && !isObject(data.schemaVersion);
  if (versioned) {
    if (data.schemaVersion !== 1 || !Number.isSafeInteger(data.revision) || data.revision < 0) {
      throw new Error('Invalid or unsupported campaign schema');
    }
    validateRooms(data.rooms);
    return { envelope: data, legacy: false };
  }
  // Partial envelopes must not be mistaken for a legacy document.
  if ((has(data, 'revision') && !isObject(data.revision)) ||
      (has(data, 'rooms') && !isObject(data.rooms))) throw new Error('Invalid campaign envelope');
  validateRooms(data);
  return { envelope: { schemaVersion: 1, revision: 0, rooms: data }, legacy: true };
}

class CampaignRepository {
  constructor(filePath, { backupDir, retention = 5, fs = defaultFs } = {}) {
    if (typeof filePath !== 'string' || !filePath) throw new TypeError('filePath is required');
    if (!Number.isSafeInteger(retention) || retention < 0) throw new TypeError('Invalid retention');
    this.filePath = path.resolve(filePath);
    this.backupDir = path.resolve(backupDir || path.join(path.dirname(this.filePath), 'backups'));
    this.retention = retention;
    this.fs = fs;
    this.prefix = `${path.basename(this.filePath)}.backup-`;
    this.queue = Promise.resolve();
    this.lastError = null;
    this.lastLoadMetadata = null;
  }

  async syncDir(dir) {
    const handle = await this.fs.open(dir, 'r');
    try { await handle.sync(); } finally { await handle.close(); }
  }

  async writeExclusive(file, content) {
    let handle;
    let created = false;
    try {
      handle = await this.fs.open(file, 'wx', 0o600);
      created = true;
      await handle.writeFile(content);
      await handle.sync();
      await handle.close();
      handle = null;
    } catch (error) {
      if (handle) await handle.close().catch(() => {});
      if (created) await this.fs.unlink(file).catch(() => {});
      throw error;
    }
  }

  async load() {
    this.lastLoadMetadata = null;
    let text;
    try { text = await this.fs.readFile(this.filePath, 'utf8'); }
    catch (error) {
      if (error.code === 'ENOENT') return { schemaVersion: 1, revision: 0, rooms: {} };
      throw error;
    }
    const { envelope, legacy } = parseDocument(text);
    if (legacy) {
      await this.fs.mkdir(this.backupDir, { recursive: true });
      const copyPath = path.join(this.backupDir, `${path.basename(this.filePath)}.legacy-${randomUUID()}.json`);
      await this.writeExclusive(copyPath, text);
      await this.syncDir(this.backupDir);
      this.lastLoadMetadata = { legacy: true, copyPath };
    } else {
      this.lastLoadMetadata = { legacy: false };
    }
    return envelope;
  }

  save(envelope) {
    // JSON serialization takes the snapshot synchronously, before the queue advances.
    let text;
    let snapshotError;
    try {
      text = JSON.stringify(envelope, null, 2);
      const parsed = parseDocument(text);
      if (parsed.legacy) throw new Error('save requires a versioned envelope');
    } catch (error) { snapshotError = error; }
    const operation = this.queue.then(async () => {
      if (snapshotError) throw snapshotError;
      await this.commit(text);
    });
    this.queue = operation.then(
      () => { this.lastError = null; },
      error => { this.lastError = error; }
    );
    return operation;
  }

  async commit(text) {
    const dir = path.dirname(this.filePath);
    let old;
    try { old = await this.fs.readFile(this.filePath, 'utf8'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (old !== undefined) parseDocument(old); // Never overwrite corrupt/incompatible data.
    await this.fs.mkdir(dir, { recursive: true });
    if (old !== undefined && this.retention > 0) {
      await this.fs.mkdir(this.backupDir, { recursive: true });
      const existing = (await this.fs.readdir(this.backupDir)).filter(name => name.startsWith(this.prefix) && name.endsWith('.json'));
      const latest = existing.reduce((max, name) => {
        const match = name.slice(this.prefix.length).match(/^(\d{16})-/);
        return match ? Math.max(max, Number(match[1])) : max;
      }, 0);
      const timestamp = Math.max(Date.now(), latest + 1).toString().padStart(16, '0');
      const backup = path.join(this.backupDir, `${this.prefix}${timestamp}-${randomUUID()}.json`);
      await this.writeExclusive(backup, old);
      await this.syncDir(this.backupDir);
      const names = (await this.fs.readdir(this.backupDir)).filter(name => name.startsWith(this.prefix) && name.endsWith('.json')).sort();
      // The just-created backup is always retained, even when timestamps tie.
      const others = names.filter(name => name !== path.basename(backup));
      for (const name of others.slice(0, Math.max(0, names.length - this.retention))) {
        await this.fs.unlink(path.join(this.backupDir, name));
      }
      await this.syncDir(this.backupDir);
    }
    const temp = path.join(dir, `.${path.basename(this.filePath)}.${randomUUID()}.tmp`);
    let created = false;
    try {
      await this.writeExclusive(temp, text);
      created = true;
      await this.fs.rename(temp, this.filePath);
      created = false;
      await this.syncDir(dir);
    } finally {
      if (created) await this.fs.unlink(temp).catch(() => {});
    }
  }

  async flush() {
    // Include operations enqueued while an earlier operation was running.
    let pending;
    do { pending = this.queue; await pending; } while (pending !== this.queue);
    if (this.lastError) throw this.lastError;
  }
}

module.exports = CampaignRepository;
module.exports.parseDocument = parseDocument;
