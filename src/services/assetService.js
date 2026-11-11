'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const sharp = require('sharp');
const { projectMap } = require('../security/projections');

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_QUOTA = 200 * 1024 * 1024;
const validId = id => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
const urlFor = (roomId, id) => `/api/assets/${id}?roomId=${encodeURIComponent(roomId)}`;
function fail(status, message) { const error = new Error(message); error.status = status; return error; }

class AssetService {
  constructor({ directory, roomManager, roomService, maxBytes = DEFAULT_MAX_BYTES, maxPixels = 40e6, quota = DEFAULT_QUOTA }) {
    if (!directory || !roomManager || !roomService || ![maxBytes, maxPixels, quota].every(n => Number.isSafeInteger(n) && n > 0)) throw new Error('Configuration des assets invalide');
    Object.assign(this, { directory: path.resolve(directory), roomManager, roomService, maxBytes, maxPixels, quota });
    this.queue = Promise.resolve();
  }
  async init() { await fs.mkdir(this.directory, { recursive: true, mode: 0o700 }); }
  authorize(roomId, identityId) {
    if (typeof roomId !== 'string' || !roomId || typeof identityId !== 'string' || !identityId) throw fail(403, 'Accès refusé');
    // getRoom creates rooms; never use it for an untrusted ID.
    const room = this.roomManager.rooms.get(roomId);
    const member = room && this.roomService.membership(roomId, identityId);
    if (!room || !member || !['mj', 'player'].includes(member.role)) throw fail(403, 'Accès refusé');
    return { room, member };
  }
  async upload(roomId, identityId, file) {
    const task = this.queue.catch(() => {}).then(() => this.uploadInternal(roomId, identityId, file));
    this.queue = task;
    return task;
  }
  async uploadInternal(roomId, identityId, file) {
    const { room } = this.authorize(roomId, identityId);
    const buffer = file?.buffer;
    if (!Buffer.isBuffer(buffer) || !buffer.length) throw fail(400, 'Image manquante');
    if (buffer.length > this.maxBytes) throw fail(413, 'Image trop volumineuse');
    let output;
    try {
      const image = sharp(buffer, { limitInputPixels: this.maxPixels, animated: true, failOn: 'warning' });
      const meta = await image.metadata();
      if (!['png', 'jpeg', 'webp'].includes(meta.format) || (meta.pages || 1) !== 1 || !meta.width || !meta.height || meta.width * meta.height > this.maxPixels) throw new Error('unsupported');
      output = await image.rotate().webp().toBuffer();
    } catch (_) { throw fail(400, 'Image invalide, animée ou non prise en charge'); }
    // Check again after decoding in case membership changed during the await.
    this.authorize(roomId, identityId);
    const assets = room.assets || (room.assets = {});
    const used = Object.values(assets).reduce((total, asset) => total + (Number.isSafeInteger(asset?.size) && asset.size >= 0 ? asset.size : this.quota), 0);
    if (used + output.length > this.quota) throw fail(413, 'Quota de campagne dépassé');
    const id = randomUUID();
    const filename = `${id}.webp`;
    const target = path.join(this.directory, filename);
    await fs.writeFile(target, output, { flag: 'wx', mode: 0o600 });
    assets[id] = { id, size: output.length, contentType: 'image/webp', createdAt: new Date().toISOString() };
    try { await this.roomManager.persist(); }
    catch (error) { delete assets[id]; await fs.rm(target, { force: true }); throw error; }
    return { assetId: id, url: urlFor(roomId, id) };
  }
  async get(roomId, identityId, id) {
    const { room, member } = this.authorize(roomId, identityId);
    if (!validId(id) || !Object.hasOwn(room.assets || {}, id)) throw fail(404, 'Asset introuvable');
    if (member.role !== 'mj' && !this.visible(room, identityId, urlFor(roomId, id))) throw fail(404, 'Asset introuvable');
    try { return await fs.readFile(path.join(this.directory, `${id}.webp`)); }
    catch (error) { if (error.code === 'ENOENT') throw fail(404, 'Asset introuvable'); throw error; }
  }
  visible(room, identityId, url) {
    const map = projectMap(room, { role: 'player', identityId });
    if (map.backgroundUrl === url) return true;
    const own = (room.characters || []).filter(c => c.ownerId === identityId);
    if (own.some(c => [c.image, c.imageUrl, c.portrait, c.portraitUrl, c.avatar, c.avatarUrl].includes(url))) return true;
    if ((map.tokens || []).some(t => [t.image, t.imageUrl].includes(url))) return true;
    // Character inventories are already shared in the player character projection.
    if ((room.characters || []).some(c => [c.imageUrl, c.portraitUrl, ...(c.inventory || []).map(item => item.imgUrl)].includes(url))) return true;
    if ((map.props || []).some(p => p.imageUrl === url)) return true;
    return (room.investigation?.clues || []).some(c => !c.hidden && !c.isSealed && c.image === url);
  }
}

module.exports = { AssetService, DEFAULT_MAX_BYTES, DEFAULT_QUOTA };
