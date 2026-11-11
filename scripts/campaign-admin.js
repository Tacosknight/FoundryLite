'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const CampaignRepository = require('../src/persistence/CampaignRepository');

const usage = 'Usage: node scripts/campaign-admin.js --data-directory DIR --campaign ID --identity ID [--apply]\nOffline only: stop the server and all other processes using this data directory.';
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function argumentsFrom(argv) {
  const result = {};
  const options = new Set(['--data-directory', '--campaign', '--identity', '--apply']);
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!options.has(key) || Object.hasOwn(result, key)) throw new Error(`Invalid or duplicate option: ${key}`);
    if (key === '--apply') result[key] = true;
    else {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
      result[key] = value;
    }
  }
  for (const key of ['--data-directory', '--campaign', '--identity']) {
    if (!result[key]) throw new Error(`Missing required option: ${key}`);
  }
  return result;
}

async function main(argv) {
  if (argv.length === 1 && argv[0] === '--help') { console.log(usage); return; }
  const args = argumentsFrom(argv);
  const dir = path.resolve(args['--data-directory']);
  const identities = JSON.parse(await fs.readFile(path.join(dir, 'identities.json'), 'utf8'));
  const identity = args['--identity'];
  if (!isObject(identities) || identities.version !== 1 || !isObject(identities.identities) || !isObject(identities.sessions) ||
      !Object.hasOwn(identities.identities, identity) || !isObject(identities.identities[identity])) {
    throw new Error('Identity storage invalid or identity not found');
  }
  const file = path.join(dir, 'rooms.json');
  // load() otherwise treats a missing file as an empty store.
  await fs.access(file);
  // Loading a legacy document normally writes a copy. Suppress only those load
  // side effects so dry runs and rejected operations never change storage.
  const repository = new CampaignRepository(file, { retention: Number.MAX_SAFE_INTEGER });
  const writeExclusive = repository.writeExclusive;
  const syncDir = repository.syncDir;
  const originalFs = repository.fs;
  repository.fs = { ...originalFs, mkdir: async () => {} };
  repository.writeExclusive = async () => {};
  repository.syncDir = async () => {};
  let envelope;
  try { envelope = await repository.load(); }
  finally { repository.fs = originalFs; repository.writeExclusive = writeExclusive; repository.syncDir = syncDir; }
  const campaign = args['--campaign'];
  if (!Object.hasOwn(envelope.rooms, campaign)) throw new Error('Campaign not found');
  const room = envelope.rooms[campaign];
  // Any access record is ambiguous, including a malformed or ownerless one.
  if (Object.hasOwn(room, 'access')) throw new Error('Campaign already has an access record; refusing assignment');
  if (envelope.revision === Number.MAX_SAFE_INTEGER) throw new Error('Campaign revision cannot be incremented');
  if (!args['--apply']) {
    console.log(`Dry run: would assign campaign ${JSON.stringify(campaign)} to identity ${JSON.stringify(identity)} as owner and MJ. No files changed.`);
    return;
  }
  room.access = { ownerId: identity, members: { [identity]: { role: 'mj' } }, invitations: {} };
  envelope.revision++;
  await repository.save(envelope);
  console.log(`Assigned campaign ${JSON.stringify(campaign)} to identity ${JSON.stringify(identity)}. Original rooms.json backed up in ${repository.backupDir}.`);
}

main(process.argv.slice(2)).catch(error => {
  console.error(`Error: ${error.message}\n${usage}`);
  process.exitCode = 1;
});
