'use strict';

const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const sharp = require('sharp');
const CampaignRepository = require('../src/persistence/CampaignRepository');
const { DEFAULT_MAX_BYTES, DEFAULT_QUOTA } = require('../src/services/assetService');

const usage = 'Usage: node scripts/migrate-legacy-media.js --data-directory DIR --uploads-directory DIR [--apply]\nOffline only: stop the server and all other processes using these directories.';
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);

async function directory(dir) {
  const stat = await fs.lstat(dir);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Not a real directory: ${dir}`);
  return fs.realpath(dir);
}
async function optionalDirectory(dir) {
  try { await directory(dir); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
async function readRegular(file, max = Infinity) {
  const handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > max) throw new Error(`Not a regular file or too large: ${file}`);
    const data = await handle.readFile();
    if (data.length > max) throw new Error(`File too large: ${file}`);
    return data;
  } finally { await handle.close(); }
}
function references(value, found, roomId) {
  if (typeof value === 'string') {
    if (/\/uploads/i.test(value)) {
      if (!/^\/uploads\/asset-\d+-\d+\.[a-z0-9]+$/.test(value)) throw new Error(`Ambiguous legacy reference in ${roomId}: ${value}`);
      found.add(value);
    }
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (/\/uploads/i.test(key)) throw new Error(`Legacy reference in object key in ${roomId}`);
      references(child, found, roomId);
    }
  }
}
function replace(value, mapping) {
  if (typeof value === 'string') return mapping.get(value) || value;
  if (Array.isArray(value)) return value.map(v => replace(v, mapping));
  if (object(value)) for (const key of Object.keys(value)) value[key] = replace(value[key], mapping);
  return value;
}
async function main(argv) {
  if (argv.length === 1 && argv[0] === '--help') { console.log(usage); return; }
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!['--data-directory', '--uploads-directory', '--apply'].includes(key) || Object.hasOwn(args, key)) throw new Error(`Invalid or duplicate option: ${key}`);
    if (key === '--apply') args[key] = true;
    else if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`Missing value for ${key}`);
    else args[key] = argv[++i];
  }
  if (!args['--data-directory'] || !args['--uploads-directory']) throw new Error('Both directories are required');
  const dataDir = await directory(path.resolve(args['--data-directory']));
  const uploadsDir = await directory(path.resolve(args['--uploads-directory']));
  const assetsDir = path.join(dataDir, 'assets');
  const backupDir = path.join(dataDir, 'backups');
  await optionalDirectory(assetsDir);
  await optionalDirectory(backupDir);
  const roomsFile = path.join(dataDir, 'rooms.json');
  const original = await readRegular(roomsFile);
  const { envelope } = CampaignRepository.parseDocument(original.toString('utf8'));
  if (envelope.revision === Number.MAX_SAFE_INTEGER) throw new Error('Campaign revision cannot be incremented');
  const plans = [];
  for (const [roomId, room] of Object.entries(envelope.rooms)) {
    const refs = new Set(); references(room, refs, roomId);
    if (!refs.size) continue;
    if (Object.hasOwn(room, 'assets') && !object(room.assets)) throw new Error(`Invalid assets in ${roomId}`);
    let used = 0;
    for (const asset of Object.values(room.assets || {})) {
      if (!object(asset) || !Number.isSafeInteger(asset.size) || asset.size < 0) throw new Error(`Invalid asset metadata in ${roomId}`);
      used += asset.size;
      if (!Number.isSafeInteger(used)) throw new Error(`Invalid asset quota in ${roomId}`);
    }
    const mapping = new Map();
    for (const ref of refs) {
      const input = await readRegular(path.join(uploadsDir, ref.slice('/uploads/'.length)), DEFAULT_MAX_BYTES);
      let output;
      try {
        const image = sharp(input, { limitInputPixels: 40e6, animated: true, failOn: 'warning' });
        const meta = await image.metadata();
        if (!['png', 'jpeg', 'webp'].includes(meta.format) || (meta.pages || 1) !== 1 || !meta.width || !meta.height || meta.width * meta.height > 40e6) throw new Error('unsupported');
        output = await image.rotate().webp().toBuffer();
      } catch { throw new Error(`Unsupported or invalid image: ${ref}`); }
      used += output.length;
      if (used > DEFAULT_QUOTA) throw new Error(`Asset quota exceeded in ${roomId}`);
      const id = randomUUID();
      mapping.set(ref, `/api/assets/${id}?roomId=${encodeURIComponent(roomId)}`);
      plans.push({ roomId, ref, id, output });
    }
    replace(room, mapping);
  }
  if (!plans.length) { console.log('No legacy media found. No files changed.'); return; }
  for (const plan of plans) console.log(`${JSON.stringify(plan.roomId)} ${plan.ref} -> ${plan.id}`);
  if (!args['--apply']) { console.log('Dry run only; no files changed. IDs will differ on apply.'); return; }
  // Recheck the source before making any changes. All writers must be stopped.
  if (!(await readRegular(roomsFile)).equals(original)) throw new Error('rooms.json changed during migration');
  await fs.mkdir(assetsDir, { recursive: true, mode: 0o700 });
  await directory(assetsDir);
  for (const plan of plans) {
    const room = envelope.rooms[plan.roomId];
    if (!room.assets) room.assets = {};
    if (Object.hasOwn(room.assets, plan.id)) throw new Error('Asset ID collision');
    await fs.writeFile(path.join(assetsDir, `${plan.id}.webp`), plan.output, { flag: 'wx', mode: 0o600 });
    room.assets[plan.id] = { id: plan.id, size: plan.output.length, contentType: 'image/webp', createdAt: new Date().toISOString() };
  }
  envelope.revision++;
  const repo = new CampaignRepository(roomsFile, { retention: Number.MAX_SAFE_INTEGER });
  await repo.save(envelope);
  console.log(`Migrated ${plans.length} campaign media references. Original rooms.json backed up in ${backupDir}; source media unchanged.`);
}

main(process.argv.slice(2)).catch(error => {
  console.error(`Error: ${error.message}\n${usage}\nIf apply failed, inspect backups and any orphaned assets before retrying.`);
  process.exitCode = 1;
});
